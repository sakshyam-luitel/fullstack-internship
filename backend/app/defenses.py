"""What a defense is for, who is involved in it, and how it's returned over GraphQL.

A defense defends one submission: a proposal, a progress report, or a paper
whose final report was approved (the final defense). It records the phase the
submission belongs to when there is one; proposals from before the research
timeline have none. Only final defenses take a thesis upload. Panels are
chosen when the defense is planned.
"""

from dataclasses import dataclass
from typing import Optional

from sqlalchemy import or_

from . import constraints, models, schemas
from .utils import proposal_group_member_users

KIND_NAMES = {"proposal": "Proposal defense", "progress_report": "Progress defense", "defense": "Final defense"}


@dataclass
class DefenseSubject:
    kind: str  # "proposal" | "progress_report" | "defense"
    title: str
    proposal: Optional[models.Proposals]
    paper: Optional[models.Papers]
    report: Optional[models.ProgressReports]


def defense_subject(db, defense: models.Defenses) -> DefenseSubject:
    report = paper = proposal = None
    if defense.proposal_id:
        proposal = db.get(models.Proposals, defense.proposal_id)
        kind = "proposal"
    elif defense.progress_report_id:
        report = db.get(models.ProgressReports, defense.progress_report_id)
        paper = db.get(models.Papers, report.paper_id) if report else None
        kind = "progress_report"
    else:
        paper = db.get(models.Papers, defense.paper_id) if defense.paper_id else None
        kind = "defense"
    if paper is not None and proposal is None and paper.proposal_id:
        proposal = db.get(models.Proposals, paper.proposal_id)
    title = (proposal.title if proposal else None) or (paper.title if paper else None) or "Untitled research"
    return DefenseSubject(kind=kind, title=title, proposal=proposal, paper=paper, report=report)


def is_final(defense: models.Defenses) -> bool:
    return defense.paper_id is not None and defense.proposal_id is None and defense.progress_report_id is None


def subject_students(db, subject: DefenseSubject) -> list:
    return proposal_group_member_users(db, subject.proposal) if subject.proposal else []


def subject_supervisor_id(subject: DefenseSubject):
    if subject.paper is not None:
        return subject.paper.supervisor_id
    return subject.proposal.supervisor_id if subject.proposal else None


def subject_department_id(db, subject: DefenseSubject):
    """The owning student's department, falling back to the supervisor's."""
    if subject.proposal and subject.proposal.submitted_by:
        owner = db.get(models.User, subject.proposal.submitted_by)
        if owner and owner.department_id:
            return owner.department_id
    supervisor_id = subject_supervisor_id(subject)
    supervisor = db.get(models.User, supervisor_id) if supervisor_id else None
    return supervisor.department_id if supervisor else None


def subject_degree_level(db, subject: DefenseSubject):
    owner = db.get(models.User, subject.proposal.submitted_by) if subject.proposal and subject.proposal.submitted_by else None
    return constraints.get_degree_level(db, owner)


def panel_professor_ids(db, defense_id) -> set:
    return {row[0] for row in db.query(models.DefensePanel.professor_id).filter(models.DefensePanel.defense_id == defense_id).all()}


def defense_stakeholders(db, defense: models.Defenses, subject: Optional[DefenseSubject] = None) -> set:
    """Students, supervisor, co-authors and panel members of a defense."""
    subject = subject or defense_subject(db, defense)
    recipients = {user.id for user in subject_students(db, subject)}
    recipients.add(subject_supervisor_id(subject))
    if subject.paper is not None:
        recipients.update(row[0] for row in db.query(models.PaperAuthors.user_id).filter(models.PaperAuthors.paper_id == subject.paper.id).all())
    recipients.update(panel_professor_ids(db, defense.id))
    recipients.discard(None)
    return recipients


def defenses_for_student(db, user_id) -> list:
    """Every defense of a proposal, progress report or paper the student is part of."""
    joined = db.query(models.ProposalCandidates.proposal_id).filter(
        models.ProposalCandidates.student_id == user_id,
        models.ProposalCandidates.status == "accepted",
    )
    proposal_ids = [row[0] for row in db.query(models.Proposals.id).filter(
        or_(models.Proposals.submitted_by == user_id, models.Proposals.id.in_(joined))
    ).all()]
    return _defenses_for_proposals(db, proposal_ids)


def defenses_for_professor(db, user_id) -> list:
    """Defenses of work the professor supervises, plus defenses they sit on the panel of."""
    proposal_ids = [row[0] for row in db.query(models.Proposals.id).filter(models.Proposals.supervisor_id == user_id).all()]
    proposal_ids += [row[0] for row in db.query(models.Papers.proposal_id).filter(models.Papers.supervisor_id == user_id, models.Papers.proposal_id.isnot(None)).all()]
    defenses = {defense.id: defense for defense in _defenses_for_proposals(db, proposal_ids)}
    supervised_paper_ids = [row[0] for row in db.query(models.Papers.id).filter(models.Papers.supervisor_id == user_id).all()]
    if supervised_paper_ids:
        for defense in db.query(models.Defenses).filter(models.Defenses.paper_id.in_(supervised_paper_ids)).all():
            defenses[defense.id] = defense
    panel_ids = db.query(models.DefensePanel.defense_id).filter(models.DefensePanel.professor_id == user_id)
    for defense in db.query(models.Defenses).filter(models.Defenses.id.in_(panel_ids)).all():
        defenses[defense.id] = defense
    return sorted(defenses.values(), key=lambda item: item.defense_date, reverse=True)


def _defenses_for_proposals(db, proposal_ids) -> list:
    if not proposal_ids:
        return []
    paper_ids = [row[0] for row in db.query(models.Papers.id).filter(models.Papers.proposal_id.in_(proposal_ids)).all()]
    conditions = [models.Defenses.proposal_id.in_(proposal_ids)]
    if paper_ids:
        report_ids = db.query(models.ProgressReports.id).filter(models.ProgressReports.paper_id.in_(paper_ids))
        conditions += [models.Defenses.paper_id.in_(paper_ids), models.Defenses.progress_report_id.in_(report_ids)]
    return db.query(models.Defenses).filter(or_(*conditions)).order_by(models.Defenses.defense_date.desc()).all()


def defense_schema(db, defense: models.Defenses) -> schemas.DefenseSchema:
    subject = defense_subject(db, defense)
    phase = db.get(models.ResearchPhase, defense.phase_id) if defense.phase_id else None
    supervisor_id = subject_supervisor_id(subject)
    level = subject_degree_level(db, subject)
    panel_rows = (
        db.query(models.User.id, models.User.name)
        .join(models.DefensePanel, models.DefensePanel.professor_id == models.User.id)
        .filter(models.DefensePanel.defense_id == defense.id)
        .order_by(models.User.name)
        .all()
    )
    if subject.kind == "proposal" and subject.proposal:
        document = ("proposals", subject.proposal.id, subject.proposal.original_filename)
    elif subject.kind == "progress_report" and subject.report:
        document = ("progress-reports", subject.report.id, subject.report.original_filename)
    elif subject.paper:
        document = ("papers", subject.paper.id, subject.paper.final_report_original_filename)
    else:
        document = (None, None, None)
    return schemas.DefenseSchema(
        id=defense.id,
        paper_id=defense.paper_id,
        proposal_id=defense.proposal_id,
        progress_report_id=defense.progress_report_id,
        kind=subject.kind,
        defense_date=defense.defense_date,
        location=defense.location,
        submission_confirmed=defense.submission_confirmed,
        scheduled_by=defense.scheduled_by,
        scheduled_by_name=db.query(models.User.name).filter(models.User.id == defense.scheduled_by).scalar(),
        original_filename=defense.original_filename,
        file_size_bytes=defense.file_size_bytes,
        uploaded_at=defense.uploaded_at,
        paper_title=subject.title,
        phase_id=defense.phase_id,
        phase_label=phase.label if phase else None,
        scheduled_time=defense.scheduled_time,
        current_status=defense.current_status,
        degree_level=level.value if level else None,
        student_names=[user.name for user in subject_students(db, subject)],
        supervisor_name=db.query(models.User.name).filter(models.User.id == supervisor_id).scalar() if supervisor_id else None,
        panel_names=[name for _, name in panel_rows],
        panel_professor_ids=[professor_id for professor_id, _ in panel_rows],
        report_document_kind=document[0] if document[2] else None,
        report_document_id=document[1] if document[2] else None,
        report_filename=document[2],
    )


def is_panel_member(db, user_id, **target) -> bool:
    """Whether the user sits on a panel defending the given proposal_id / progress_report_id / paper_id / id."""
    query = db.query(models.DefensePanel.id).join(models.Defenses, models.DefensePanel.defense_id == models.Defenses.id).filter(
        models.DefensePanel.professor_id == user_id
    )
    for column, value in target.items():
        query = query.filter(getattr(models.Defenses, column) == value)
    return query.first() is not None


def validate_panel(db, professor_ids, department_id) -> None:
    """Every panel member must be a professor in the department with a professor profile."""
    for professor_id in set(professor_ids):
        professor = db.get(models.User, professor_id)
        if not professor or getattr(professor.role, "value", professor.role) != "professor" or professor.department_id != department_id:
            raise Exception("Panel members must be professors in your department")
        if not db.get(models.ProfessorProfiles, professor_id):
            raise Exception(f"{professor.name} needs a professor profile before joining a defense panel")


def set_panel(db, defense: models.Defenses, professor_ids, department_id) -> None:
    """Replace a defense's panel."""
    validate_panel(db, professor_ids, department_id)
    wanted = set(professor_ids)
    current ={row.professor_id: row for row in db.query(models.DefensePanel).filter(models.DefensePanel.defense_id == defense.id).all()}
    for professor_id, row in current.items():
        if professor_id not in wanted:
            db.delete(row)
    for professor_id in wanted - set(current):
        db.add(models.DefensePanel(defense_id=defense.id, professor_id=professor_id))
    db.flush()


def final_defense_phase(db, subject: DefenseSubject, department_id):
    """The newest final defense phase for the subject's degree level, if one exists."""
    level = subject_degree_level(db, subject)
    if level is None:
        return None
    return (
        db.query(models.ResearchPhase)
        .filter(
            models.ResearchPhase.deleted_at.is_(None),
            models.ResearchPhase.phase_type == models.PhaseType.defense,
            models.ResearchPhase.degree_level == level,
            or_(models.ResearchPhase.department_id == department_id, models.ResearchPhase.department_id.is_(None)),
        )
        .order_by(models.ResearchPhase.sequence_number.desc(), models.ResearchPhase.created_at.desc())
        .first()
    )
