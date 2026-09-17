"""Fixed supervision-capacity and grouping rules for the three degree levels.

Defined once, here, so the college can retune the numbers later without
hunting through resolvers. Bachelor's is a 1-3 student group (max 1 group per
professor); Master's and PhD are individual (max 5 / 4 students per
professor respectively); 3 + 5 + 4 = 12 is also enforced as an independent
overall ceiling, since a later retune of the per-level numbers could put them
out of sync with the total.
"""

from . import models

DEGREE_LEVEL_NAMES = {
    models.DegreeLevel.bachelors: "Bachelor's",
    models.DegreeLevel.masters: "Master's",
    models.DegreeLevel.phd: "PhD",
}

MAX_BACHELOR_GROUPS_PER_PROFESSOR = 1
MAX_BACHELOR_GROUP_SIZE = 3
MAX_MASTERS_STUDENTS_PER_PROFESSOR = 5
MAX_PHD_STUDENTS_PER_PROFESSOR = 4
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
    query = db.query(models.Proposals).filter(
        models.Proposals.supervisor_id == supervisor_id,
        models.Proposals.status.in_(ACTIVE_SUPERVISION_STATUSES),
        models.Proposals.deleted_at.is_(None),
    )
    if exclude_proposal_id is not None:
        query = query.filter(models.Proposals.id != exclude_proposal_id)
    return query.all()


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

    if degree_level == models.DegreeLevel.bachelors:
        active_groups = len(active_by_level.get(degree_level, []))
        if active_groups >= MAX_BACHELOR_GROUPS_PER_PROFESSOR:
            return False, f"{supervisor.name} is already supervising a Bachelor's group"
    elif degree_level == models.DegreeLevel.masters:
        active_students = sum(_proposal_student_count(db, p.id) for p in active_by_level.get(degree_level, []))
        if active_students + proposal_size > MAX_MASTERS_STUDENTS_PER_PROFESSOR:
            return False, f"{supervisor.name} is already supervising the maximum of {MAX_MASTERS_STUDENTS_PER_PROFESSOR} Master's students"
    elif degree_level == models.DegreeLevel.phd:
        active_students = sum(_proposal_student_count(db, p.id) for p in active_by_level.get(degree_level, []))
        if active_students + proposal_size > MAX_PHD_STUDENTS_PER_PROFESSOR:
            return False, f"{supervisor.name} is already supervising the maximum of {MAX_PHD_STUDENTS_PER_PROFESSOR} PhD students"

    total_active = sum(_proposal_student_count(db, p.id) for p in active_proposals)
    if total_active + proposal_size > MAX_TOTAL_STUDENTS_PER_PROFESSOR:
        return False, f"{supervisor.name} is already at their overall capacity of {MAX_TOTAL_STUDENTS_PER_PROFESSOR} students"
    return True, None


def check_supervisor_capacity(db, supervisor, level, proposal_size, exclude_proposal_id=None):
    """Legacy raising wrapper retained for existing call sites."""
    allowed, reason = can_assign_supervisor(db, supervisor.id, level, proposal_size, exclude_proposal_id)
    if not allowed:
        raise Exception(reason)
