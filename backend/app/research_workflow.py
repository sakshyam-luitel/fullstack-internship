"""Shared phase validation and append-only submission-history operations."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import or_

from . import constraints, models


def _enum_value(value):
    return getattr(value, "value", value)


def active_phases(query):
    """Leave out phases the admin deleted from the timeline."""
    return query.filter(models.ResearchPhase.deleted_at.is_(None))


def phase_has_ended(phase: models.ResearchPhase, now=None) -> bool:
    """Whether the deadline, or for a final defense phase the defense day, has passed."""
    now = now or datetime.now(timezone.utc)
    if phase.phase_type == models.PhaseType.defense:
        return phase.defense_date is not None and now >= phase.defense_date + timedelta(days=1)
    return phase.deadline_at is not None and now > phase.deadline_at


def is_phase_open(phase: models.ResearchPhase, now=None) -> bool:
    now = now or datetime.now(timezone.utc)
    if phase.deleted_at is not None:
        return False
    if phase.phase_type == models.PhaseType.defense:
        return phase.defense_date is not None
    if phase.opens_at and now < phase.opens_at:
        return False
    if phase.deadline_at and now > phase.deadline_at and not phase.grace_period_enabled:
        return False
    return True


def _phase_error(phase: models.ResearchPhase) -> str:
    if phase.phase_type == models.PhaseType.defense:
        return f'Defense phase "{phase.label}" has no defense date configured'
    now = datetime.now(timezone.utc)
    if phase.opens_at and now < phase.opens_at:
        return f'Submissions for phase "{phase.label}" have not opened yet'
    return f'Submission window for phase "{phase.label}" has closed'


def current_open_phase(db, user, phase_type: models.PhaseType) -> models.ResearchPhase:
    """Find the newest open phase applicable to a student's own program."""
    level = constraints.get_degree_level(db, user)
    if level is None:
        raise Exception(f"{user.name} has no degree program on file — ask an admin to set one first")
    phases = (
        active_phases(db.query(models.ResearchPhase))
        .filter(
            models.ResearchPhase.phase_type == phase_type,
            models.ResearchPhase.degree_level == level,
            or_(
                models.ResearchPhase.department_id == user.department_id,
                models.ResearchPhase.department_id.is_(None),
            ),
        )
        .order_by(models.ResearchPhase.sequence_number.desc(), models.ResearchPhase.created_at.desc())
        .all()
    )
    if not phases:
        raise Exception(f"No {phase_type.value.replace('_', ' ')} phase is scheduled for your degree level")
    for phase in phases:
        if is_phase_open(phase):
            return phase
    raise Exception(_phase_error(phases[0]))


def phase_for_new_submission(db, user, phase_type: models.PhaseType, *, taken_phase_ids=(), retry_phase_ids=()) -> models.ResearchPhase:
    """The phase a new proposal or progress report is filed under.

    Normally this is the newest open phase. A student whose earlier submission was
    rejected may also start over in that submission's phase, even after its
    deadline: they submitted on time, and the rejection came later.
    taken_phase_ids are phases the student already has an active submission in.
    """
    taken = set(taken_phase_ids)
    try:
        open_phase = current_open_phase(db, user, phase_type)
        closed_error = None
    except Exception as error:
        open_phase, closed_error = None, error
    if open_phase is not None and open_phase.id not in taken:
        return open_phase

    retry_ids = set(retry_phase_ids) - taken
    if retry_ids:
        retry_phase = (
            active_phases(db.query(models.ResearchPhase))
            .filter(models.ResearchPhase.id.in_(retry_ids), models.ResearchPhase.phase_type == phase_type)
            .order_by(models.ResearchPhase.sequence_number.desc(), models.ResearchPhase.created_at.desc())
            .first()
        )
        if retry_phase is not None:
            return retry_phase

    if open_phase is not None:
        noun = phase_type.value.replace("_", " ")
        raise Exception(f'You already have a {noun} for "{open_phase.label}" — open it to continue')
    raise closed_error


def newest_phase_for_level(db, user, phase_type: models.PhaseType):
    """The latest phase of a type for the user's level, open or not."""
    level = constraints.get_degree_level(db, user)
    if level is None:
        return None
    return (
        active_phases(db.query(models.ResearchPhase))
        .filter(
            models.ResearchPhase.phase_type == phase_type,
            models.ResearchPhase.degree_level == level,
            or_(models.ResearchPhase.department_id == user.department_id, models.ResearchPhase.department_id.is_(None)),
        )
        .order_by(models.ResearchPhase.sequence_number.desc(), models.ResearchPhase.created_at.desc())
        .first()
    )


def validate_phase_for_paper(db, phase_id, paper, phase_type: models.PhaseType) -> models.ResearchPhase:
    phase = active_phases(db.query(models.ResearchPhase)).filter(models.ResearchPhase.id == phase_id).first()
    if not phase:
        raise Exception("Research phase not found")
    if phase.phase_type != phase_type:
        raise Exception(f'Phase "{phase.label}" is not a {phase_type.value.replace("_", " ")} phase')
    proposal = db.query(models.Proposals).filter(models.Proposals.id == paper.proposal_id).first()
    owner = db.query(models.User).filter(models.User.id == proposal.submitted_by).first() if proposal else None
    level = constraints.get_degree_level(db, owner)
    if level != phase.degree_level:
        raise Exception(f'Phase "{phase.label}" is for a different degree level')
    if phase.department_id and (not owner or phase.department_id != owner.department_id):
        raise Exception(f'Phase "{phase.label}" does not apply to this department')
    return phase


def record_submission(
    db,
    *,
    entity_type: models.SubmissionEntityType,
    entity,
    phase_id,
    submitted_by,
    status: models.SubmissionStatus,
    reviewed_by=None,
    comments=None,
) -> models.SubmissionHistory:
    """Insert one immutable audit event and snapshot the current file metadata.

    This deliberately never updates prior events. A retry, resubmission, or a
    review decision is a new event so the full timeline survives later uploads.
    """
    if not phase_id:
        # Legacy records that predate phases cannot be represented honestly.
        # New submissions always have a phase, and call sites enforce that.
        raise Exception("A research phase is required to record submission history")
    event = models.SubmissionHistory(
        entity_type=entity_type,
        entity_id=entity.id,
        phase_id=phase_id,
        submitted_by=submitted_by,
        status=status,
        reviewed_by=reviewed_by,
        comments=comments,
        file_path=getattr(entity, "file_path", None),
        original_filename=getattr(entity, "original_filename", None),
    )
    db.add(event)
    db.flush()
    return event
