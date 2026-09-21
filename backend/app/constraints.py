"""Fixed supervision-capacity and grouping rules for the three degree levels.

Defined once, here, so the college can retune the numbers later without
hunting through resolvers. A professor supervises at most one active project
per degree level - one Bachelor's group, one Master's project and one PhD
project at a time - so no professor's attention is split across two projects
at the same level. Bachelor's is a 1-3 student group; Master's and PhD are
individual. MAX_TOTAL_STUDENTS_PER_PROFESSOR is enforced independently, since
a later retune of the per-level numbers could put them out of sync with the
total.
"""

from . import models

DEGREE_LEVEL_NAMES = {
    models.DegreeLevel.bachelors: "Bachelor's",
    models.DegreeLevel.masters: "Master's",
    models.DegreeLevel.phd: "PhD",
}

# One active project per degree level, per professor. A Bachelor's group counts
# as a single project however many students are in it.
MAX_PROJECTS_PER_LEVEL_PER_PROFESSOR = 1
MAX_BACHELOR_GROUP_SIZE = 3
MAX_TOTAL_STUDENTS_PER_PROFESSOR = 12

# A proposal counts toward a professor's active load unless it's been rejected
# or soft-deleted — submitted/assigned/approved/changes_requested all represent
# an ongoing supervision relationship.
# Assignment is provisional only until the professor reviews it, but it still
# reserves capacity; otherwise an admin could over-assign a professor before
# they opened their review queue. Completed, withdrawn, rejected and drafts do
# not reserve a supervision slot.
ACTIVE_SUPERVISION_STATUSES = {"assigned", "approved", "accepted", "changes_requested", "in_progress"}


def get_degree_level(db, user):
    """A user's degree level, derived from their account's degree program, or from
    their student profile for accounts created before users.degree_program_id existed.
    Returns None if the user has no student degree program on file."""
    if not user:
        return None
    program_id = user.degree_program_id or db.query(models.StudentProfiles.degree_program_id).filter(
        models.StudentProfiles.user_id == user.id
    ).scalar()
    if not program_id:
        return None
    program = db.query(models.DegreePrograms).filter(models.DegreePrograms.id == program_id).first()
    return program.level if program else None


def resolve_student_degree_program(db, department_id, degree_program_id=None, degree_level=None):
    """The degree program a student account gets.

    An explicit program must belong to the student's department. Otherwise the
    admin picks only a level, and the department's program at that level is
    used, or created (e.g. "Master's in Electronics Engineering") if the
    department doesn't offer that level yet.
    """
    if degree_program_id:
        program = db.query(models.DegreePrograms).filter(
            models.DegreePrograms.id == degree_program_id,
            models.DegreePrograms.department_id == department_id,
        ).first()
        if not program:
            raise Exception("Degree program must belong to the student's department")
        return program
    if not degree_level:
        raise Exception("Choose a degree level (Bachelor's, Master's or PhD) for student accounts")
    try:
        level = models.DegreeLevel(str(degree_level).strip().lower())
    except ValueError:
        raise Exception("Degree level must be bachelors, masters or phd")

    program = (
        db.query(models.DegreePrograms)
        .filter(models.DegreePrograms.department_id == department_id, models.DegreePrograms.level == level)
        .order_by(models.DegreePrograms.name)
        .first()
    )
    if program:
        return program
    department = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not department:
        raise Exception("Department not found")
    subject = department.name.strip()
    if subject.lower().startswith("department of "):
        subject = subject[len("department of "):]
    program = models.DegreePrograms(name=f"{DEGREE_LEVEL_NAMES[level]} in {subject}", level=level, department_id=department_id)
    db.add(program)
    db.flush()
    return program


def _active_supervised_proposals(db, supervisor_id, exclude_proposal_id=None):
    """The work a professor is currently carrying, for the cohort now running.

    Capacity is per batch: once a cohort is archived, the projects supervised
    under it stop counting, so every professor starts the new intake with their
    full allowance. Without that, a professor at their limit in one year could
    never take a student again.
    """
    from .utils import active_batch_id, batch_student_ids

    query = db.query(models.Proposals).filter(
        models.Proposals.supervisor_id == supervisor_id,
        models.Proposals.status.in_(ACTIVE_SUPERVISION_STATUSES),
        models.Proposals.deleted_at.is_(None),
    )
    if exclude_proposal_id is not None:
        query = query.filter(models.Proposals.id != exclude_proposal_id)
    batch_id = active_batch_id(db)
    if batch_id is None:
        return query.all()
    # A proposal belongs to the cohort of the student who submitted it. One with no
    # profile yet hasn't been filed under any cohort, so it counts against the
    # current one rather than escaping the limit.
    current = batch_student_ids(db, batch_id)
    filed = {
        row[0]
        for row in db.query(models.StudentProfiles.user_id).filter(models.StudentProfiles.batch_id.isnot(None)).all()
    }
    return [
        proposal for proposal in query.all()
        if proposal.submitted_by in current or proposal.submitted_by not in filed
    ]


def _proposal_student_count(db, proposal_id):
    return 1 + db.query(models.ProposalCandidates).filter(
        models.ProposalCandidates.proposal_id == proposal_id,
        models.ProposalCandidates.status == "accepted",
    ).count()


def check_group_composition(db, level, candidate_users, owner=None):
    """Validate a proposal's group against its owner's degree level: Bachelor's
    is a group of 1-3, every member also Bachelor's-level; Master's/PhD must
    have zero additional candidates (individual only)."""
    if level != models.DegreeLevel.bachelors:
        if candidate_users:
            raise Exception("Master's and PhD proposals are individual — group members aren't allowed")
        return

    if len(candidate_users) + 1 > MAX_BACHELOR_GROUP_SIZE:
        raise Exception(f"A Bachelor's group can have at most {MAX_BACHELOR_GROUP_SIZE} students")

    for candidate in candidate_users:
        if get_degree_level(db, candidate) != models.DegreeLevel.bachelors:
            raise Exception(f"{candidate.name} must be a Bachelor's-level student to join this group")
        if owner and candidate.degree_program_id != owner.degree_program_id:
            raise Exception("Bachelor's group members must belong to the same degree program")


def can_assign_supervisor(db, professor_id, degree_level, proposal_size=1, exclude_proposal_id=None):
    """Return a stable, specific capacity decision without mutating the DB.

    Callers must lock the professor's User row in their transaction before
    invoking this helper. Keeping the decision separate from the exception is
    useful for both the admin assignment and an explicit professor acceptance.
    """
    supervisor = db.query(models.User).filter(models.User.id == professor_id).first()
    if not supervisor or getattr(supervisor.role, "value", supervisor.role) != "professor":
        return False, "Supervisor must be a professor"
    """Validate that assigning this proposal keeps the professor within both
    the per-level cap and the overall cap — checked independently, since the
    two could diverge if the constants above are retuned later."""
    active_proposals = _active_supervised_proposals(db, supervisor.id, exclude_proposal_id)
    active_by_level = {}
    for proposal in active_proposals:
        owner = db.query(models.User).filter(models.User.id == proposal.submitted_by).first()
        proposal_level = get_degree_level(db, owner)
        active_by_level.setdefault(proposal_level, []).append(proposal)

    if degree_level is not None:
        projects_at_level = len(active_by_level.get(degree_level, []))
        if projects_at_level >= MAX_PROJECTS_PER_LEVEL_PER_PROFESSOR:
            level_name = DEGREE_LEVEL_NAMES.get(degree_level, str(degree_level))
            subject = "group" if degree_level == models.DegreeLevel.bachelors else "project"
            if MAX_PROJECTS_PER_LEVEL_PER_PROFESSOR == 1:
                return False, f"{supervisor.name} is already supervising a {level_name} {subject} — a professor can supervise only one project per degree level"
            return False, f"{supervisor.name} is already supervising the maximum of {MAX_PROJECTS_PER_LEVEL_PER_PROFESSOR} {level_name} {subject}s"

    total_active = sum(_proposal_student_count(db, p.id) for p in active_proposals)
    if total_active + proposal_size > MAX_TOTAL_STUDENTS_PER_PROFESSOR:
        return False, f"{supervisor.name} is already at their overall capacity of {MAX_TOTAL_STUDENTS_PER_PROFESSOR} students"
    return True, None


def check_supervisor_capacity(db, supervisor, level, proposal_size, exclude_proposal_id=None):
    """Legacy raising wrapper retained for existing call sites."""
    allowed, reason = can_assign_supervisor(db, supervisor.id, level, proposal_size, exclude_proposal_id)
    if not allowed:
        raise Exception(reason)
