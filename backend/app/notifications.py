"""In-app notifications for research-timeline events.

Resolvers call these helpers after changing a phase or a defense. The helpers
only add rows to the session; the caller's commit saves them together with the
change they describe, so a failed change never leaves a stray notification.
"""

from sqlalchemy import func, or_

from . import defenses, models
from .constraints import DEGREE_LEVEL_NAMES
from .utils import proposal_group_member_users

PHASE_TYPE_NAMES = {
    models.PhaseType.proposal: "Proposal",
    models.PhaseType.progress_report: "Progress report",
    models.PhaseType.defense: "Final defense",
}


def notify(db, user_ids, *, type: str, title: str, message: str, phase_id=None, paper_id=None, defense_id=None) -> int:
    """Queue one notification per distinct recipient and return how many were queued."""
    recipients = {user_id for user_id in user_ids if user_id is not None}
    for user_id in recipients:
        db.add(models.Notifications(
            user_id=user_id, type=type, title=title, message=message,
            phase_id=phase_id, paper_id=paper_id, defense_id=defense_id, is_read=False, is_sent=False,
        ))
    return len(recipients)


def phase_audience(db, phase: models.ResearchPhase) -> set:
    """Everyone a phase affects: the students at its degree level in its department,
    plus the professors involved with those students' research."""
    # Same fallback as constraints.get_degree_level: older accounts only have the
    # degree program on their student profile.
    program_id = func.coalesce(models.User.degree_program_id, models.StudentProfiles.degree_program_id)
    student_query = (
        db.query(models.User.id)
        .outerjoin(models.StudentProfiles, models.StudentProfiles.user_id == models.User.id)
        .join(models.DegreePrograms, program_id == models.DegreePrograms.id)
        .filter(models.User.role == models.Role.student, models.DegreePrograms.level == phase.degree_level)
    )
    if phase.department_id is not None:
        student_query = student_query.filter(models.User.department_id == phase.department_id)
    student_ids = [row[0] for row in student_query.all()]
    recipients = set(student_ids)

    if phase.phase_type == models.PhaseType.proposal:
        # No supervisors are assigned before proposals exist, and any professor in
        # the department may be asked to supervise one.
        professor_query = db.query(models.User.id).filter(models.User.role == models.Role.professor)
        if phase.department_id is not None:
            professor_query = professor_query.filter(models.User.department_id == phase.department_id)
        recipients.update(row[0] for row in professor_query.all())
        return recipients

    if not student_ids:
        return recipients
    joined_proposal_ids = db.query(models.ProposalCandidates.proposal_id).filter(
        models.ProposalCandidates.student_id.in_(student_ids),
        models.ProposalCandidates.status == "accepted",
    )
    proposals = db.query(models.Proposals).filter(
        models.Proposals.deleted_at.is_(None),
        or_(models.Proposals.submitted_by.in_(student_ids), models.Proposals.id.in_(joined_proposal_ids)),
    ).all()
    recipients.update(proposal.supervisor_id for proposal in proposals if proposal.supervisor_id)

    papers = db.query(models.Papers).filter(models.Papers.proposal_id.in_([proposal.id for proposal in proposals])).all()
    paper_ids = [paper.id for paper in papers]
    recipients.update(paper.supervisor_id for paper in papers)
    if paper_ids:
        recipients.update(row[0] for row in db.query(models.PaperAuthors.user_id).filter(models.PaperAuthors.paper_id.in_(paper_ids)).all())
        if phase.phase_type == models.PhaseType.defense:
            panel_rows = (
                db.query(models.DefensePanel.professor_id)
                .join(models.Defenses, models.DefensePanel.defense_id == models.Defenses.id)
                .filter(models.Defenses.paper_id.in_(paper_ids))
                .all()
            )
            recipients.update(row[0] for row in panel_rows)
    recipients.discard(None)
    return recipients


def notify_phase(db, phase: models.ResearchPhase, *, is_update: bool) -> int:
    kind = PHASE_TYPE_NAMES[phase.phase_type]
    level = DEGREE_LEVEL_NAMES[phase.degree_level]
    if phase.phase_type == models.PhaseType.defense:
        detail = f"The final defense day for {level} research has been {'rescheduled' if is_update else 'set'}."
    elif is_update:
        detail = f"The dates for this {kind.lower()} phase for {level} students have changed."
    else:
        detail = f"A new {kind.lower()} phase has been scheduled for {level} students. Submit before the deadline."
    return notify(
        db,
        phase_audience(db, phase),
        type="phase_updated" if is_update else "phase_scheduled",
        title=f"{kind} {'updated' if is_update else 'scheduled'}: {phase.label}",
        message=detail,
        phase_id=phase.id,
    )


def _defense_slot(defense: models.Defenses) -> str:
    parts = []
    if defense.scheduled_time:
        parts.append(f"at {defense.scheduled_time.strftime('%H:%M')}")
    if defense.location:
        parts.append(f"in {defense.location}")
    return f" ({' '.join(parts)})" if parts else ""


def notify_defense_planned(db, defense: models.Defenses, *, rescheduled: bool = False) -> int:
    """Tell the students, supervisor, co-authors and panel that a defense was planned."""
    subject = defenses.defense_subject(db, defense)
    kind = defenses.KIND_NAMES[subject.kind]
    verb = "rescheduled" if rescheduled else "planned"
    return notify(
        db,
        defenses.defense_stakeholders(db, defense, subject),
        type="defense_rescheduled" if rescheduled else "defense_scheduled",
        title=f"{kind} {verb}: {subject.title}",
        message=f'The {kind.lower()} for "{subject.title}" has been {verb}{_defense_slot(defense)}.',
        phase_id=defense.phase_id,
        paper_id=subject.paper.id if subject.paper else None,
        defense_id=defense.id,
    )


def notify_panel_member_added(db, defense: models.Defenses, professor_id) -> int:
    subject = defenses.defense_subject(db, defense)
    kind = defenses.KIND_NAMES[subject.kind].lower()
    return notify(
        db,
        [professor_id],
        type="defense_panel_assigned",
        title=f"Defense panel: {subject.title}",
        message=f'You have been added to the panel for the {kind} of "{subject.title}"{_defense_slot(defense)}.',
        phase_id=defense.phase_id,
        paper_id=subject.paper.id if subject.paper else None,
        defense_id=defense.id,
    )
