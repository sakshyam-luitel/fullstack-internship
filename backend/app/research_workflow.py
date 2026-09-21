"""Shared phase validation and append-only submission-history operations.

A degree level's timeline is a series of phases the admin builds: one proposal
phase, then as many progress report rounds as the department wants (one, three,
five — the number is never assumed anywhere), then the final defense. Students
walk that series in order, so phase lookups here read it from the earliest step
onwards rather than jumping straight to the newest one.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import or_

from . import constraints, models


def _enum_value(value):
    return getattr(value, "value", value)


def active_phases(query):
    """Leave out phases the admin deleted from the timeline."""
    return query.filter(models.ResearchPhase.deleted_at.is_(None))


def phase_has_ended(phase: models.ResearchPhase, now=None) -> bool:
    """Whether the phase is over: the admin closed it, or its dates have run out."""
    now = now or datetime.now(timezone.utc)
    if phase.status == models.PhaseStatus.closed:
        return True
    if phase.phase_type == models.PhaseType.defense:
        return phase.defense_date is not None and now >= phase.defense_date + timedelta(days=1)
    return phase.deadline_at is not None and now > phase.deadline_at


def is_phase_open(phase: models.ResearchPhase, now=None) -> bool:
    """Whether the phase is taking submissions right now.

    Two things have to hold: the admin has opened it and not closed it again,
    and its own dates allow a submission today. The status is the admin's
    decision and never changes on its own — a passed deadline stops submissions
    but leaves the phase open until the admin closes it.
    """
    now = now or datetime.now(timezone.utc)
    if phase.deleted_at is not None:
        return False
    if phase.status != models.PhaseStatus.open:
        return False
    if phase.phase_type == models.PhaseType.defense:
        return phase.defense_date is not None
    if phase.opens_at and now < phase.opens_at:
        return False
    if phase.deadline_at and now > phase.deadline_at and not phase.grace_period_enabled:
        return False
    return True


def _phase_error(phase: models.ResearchPhase) -> str:
    if phase.status == models.PhaseStatus.closed:
        return f'Phase "{phase.label}" is closed'
    if phase.status == models.PhaseStatus.pending:
        return f'Phase "{phase.label}" has not been opened by your department yet'
    if phase.phase_type == models.PhaseType.defense:
        return f'Defense phase "{phase.label}" has no defense date configured'
    now = datetime.now(timezone.utc)
    if phase.opens_at and now < phase.opens_at:
        return f'Submissions for phase "{phase.label}" have not opened yet'
    return f'Submission window for phase "{phase.label}" has closed'


def _closed_series_error(phases: list) -> Exception:
    """Explain a closed series by the round the student is waiting on: the next
    one still to start, or — once the whole series has run — its last round."""
    now = datetime.now(timezone.utc)
    waiting = [phase for phase in phases if phase.status == models.PhaseStatus.pending]
    if not waiting:
        waiting = [phase for phase in phases if phase.opens_at and now < phase.opens_at]
    return Exception(_phase_error(waiting[0] if waiting else phases[-1]))


def phases_for_level(db, user, phase_type: models.PhaseType) -> list:
    """Every phase of one type on the student's own timeline, earliest step first.

    The department decides how many there are — a progress report series can be a
    single round or a dozen — so nothing here assumes a count. Only the student's
    own cohort's phases count: someone from an archived batch never picks up the
    current intake's rounds, and phases filed before batches existed (batch_id
    NULL) still show for everyone.
    """
    from .utils import student_batch_id

    level = constraints.get_degree_level(db, user)
    if level is None:
        raise Exception(f"{user.name} has no degree program on file — ask an admin to set one first")
    batch_id = student_batch_id(db, user.id)
    query = active_phases(db.query(models.ResearchPhase)).filter(
        models.ResearchPhase.phase_type == phase_type,
        models.ResearchPhase.degree_level == level,
        or_(
            models.ResearchPhase.department_id == user.department_id,
            models.ResearchPhase.department_id.is_(None),
        ),
    )
    if batch_id is not None:
        query = query.filter(
            or_(models.ResearchPhase.batch_id == batch_id, models.ResearchPhase.batch_id.is_(None))
        )
    return query.order_by(
        models.ResearchPhase.sequence_number.asc(), models.ResearchPhase.created_at.asc()
    ).all()


def ensure_phase_accepts_submissions(phase: models.ResearchPhase, *, allow_late=False) -> None:
    """Raise unless a student may file into this phase right now.

    A closed or not-yet-opened phase takes nothing at all, whatever else is true:
    allow_late only forgives a passed deadline (a replacement for a submission
    that was rejected after the deadline), never a phase the admin has ended.
    """
    if phase.deleted_at is not None:
        raise Exception(f'Phase "{phase.label}" is no longer on the timeline')
    if phase.status != models.PhaseStatus.open:
        raise Exception(_phase_error(phase))
    if allow_late:
        return
    if not is_phase_open(phase):
        raise Exception(_phase_error(phase))


def level_phases(db, degree_level, department_id, batch_id=None):
    """Every phase of one degree level in one department's timeline, in step order.

    Phase types share a single sequence, so this spans proposal, progress report
    and defense rounds alike — the order they run in is what the sequence means.
    Phases with no department are department-wide, so they sit in the same
    sequence as the department's own. Scoped to one cohort: step numbers start
    over for each batch, and an archived cohort's timeline is nobody's current
    business.
    """
    query = active_phases(db.query(models.ResearchPhase)).filter(
        models.ResearchPhase.degree_level == degree_level,
        or_(
            models.ResearchPhase.department_id == department_id,
            models.ResearchPhase.department_id.is_(None),
        ),
    )
    if batch_id is not None:
        query = query.filter(models.ResearchPhase.batch_id == batch_id)
    return query.order_by(
        models.ResearchPhase.sequence_number.asc(), models.ResearchPhase.created_at.asc()
    ).all()


def validate_phase_can_open(db, degree_level, department_id, sequence_number, *, batch_id=None, exclude_phase_id=None) -> None:
    """Refuse to start a phase out of turn. The one place that rule lives.

    A degree level runs one phase at a time, in step order: nothing else may be
    open, and every earlier step must already be closed. Levels are independent
    of each other — closing the Bachelor's proposal round says nothing about
    Master's or PhD — and so are cohorts, since a new batch starts at step 1.
    """
    for phase in level_phases(db, degree_level, department_id, batch_id):
        if phase.id == exclude_phase_id:
            continue
        if phase.status == models.PhaseStatus.open:
            raise Exception(
                f'"{phase.label}" (step {phase.sequence_number}) is still open — close it before starting another phase for this degree level'
            )
        if phase.sequence_number < sequence_number and phase.status != models.PhaseStatus.closed:
            raise Exception(
                f'"{phase.label}" (step {phase.sequence_number}) comes first and has not run yet — phases open in order'
            )


def current_open_phase(db, user, phase_type: models.PhaseType) -> models.ResearchPhase:
    """The earliest open phase of a type for a student's own program.

    Earliest rather than newest: when a department leaves two rounds open at
    once, the earlier one is the one still owed.
    """
    phases = phases_for_level(db, user, phase_type)
    if not phases:
        raise Exception(f"No {phase_type.value.replace('_', ' ')} phase is scheduled for your degree level")
    for phase in phases:
        if is_phase_open(phase):
            return phase
    raise _closed_series_error(phases)


def phase_for_new_submission(db, user, phase_type: models.PhaseType, *, taken_phase_ids=(), retry_phase_ids=()) -> models.ResearchPhase:
    """The phase a new proposal or progress report is filed under.

    Normally this is the earliest open round the student hasn't filed in yet, so
    a series of rounds is worked through in order. A student whose earlier
    submission was rejected may also start over in that submission's phase, even
    after its deadline: they submitted on time, and the rejection came later.
    taken_phase_ids are phases the student already has an active submission in.
    """
    taken = set(taken_phase_ids)
    phases = phases_for_level(db, user, phase_type)
    if not phases:
        raise Exception(f"No {phase_type.value.replace('_', ' ')} phase is scheduled for your degree level")
    open_phases = [phase for phase in phases if is_phase_open(phase)]
    for phase in open_phases:
        if phase.id not in taken:
            return phase

    retry_ids = set(retry_phase_ids) - taken
    if retry_ids:
        # The latest round they may retry, so a student behind on several rounds
        # still lands on the one closest to where the series has got to.
        for phase in reversed(phases):
            if phase.id in retry_ids:
                return phase

    if open_phases:
        noun = phase_type.value.replace("_", " ")
        labels = ", ".join(f'"{phase.label}"' for phase in open_phases)
        raise Exception(f"You already have a {noun} for every open round ({labels}) — open it to continue")
    raise _closed_series_error(phases)


def newest_phase_for_level(db, user, phase_type: models.PhaseType):
    """The latest phase of a type for the user's level, open or not."""
    try:
        phases = phases_for_level(db, user, phase_type)
    except Exception:
        return None
    return phases[-1] if phases else None


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


def _defense_state(db, report: models.ProgressReports) -> str:
    """How far the panel got with one progress report.

    "defended" once any defense of it was passed, "failed" once one was turned
    down, "scheduled" while one is still to be heard, "unscheduled" otherwise.
    """
    statuses = {
        row[0]
        for row in db.query(models.Defenses.current_status).filter(models.Defenses.progress_report_id == report.id).all()
    }
    if "accepted" in statuses:
        return "defended"
    if "pending" in statuses:
        return "scheduled"
    return "failed" if statuses else "unscheduled"


def previous_progress_report(db, paper_id, before_sequence=None):
    """The paper's latest progress report from an earlier round, as (report, phase)."""
    query = (
        db.query(models.ProgressReports, models.ResearchPhase)
        .join(models.ResearchPhase, models.ProgressReports.phase_id == models.ResearchPhase.id)
        .filter(
            models.ProgressReports.paper_id == paper_id,
            models.ResearchPhase.phase_type == models.PhaseType.progress_report,
            models.ResearchPhase.deleted_at.is_(None),
        )
    )
    if before_sequence is not None:
        query = query.filter(models.ResearchPhase.sequence_number < before_sequence)
    return query.order_by(
        models.ResearchPhase.sequence_number.desc(), models.ProgressReports.submitted_at.desc()
    ).first()


def previous_report_block(db, paper_id, *, before_sequence=None):
    """Why the student can't start the next report yet, or None when they can.

    Every round is defended before the next one — and before the final report —
    is started. A student with no earlier round on file (they joined the
    programme part-way through the timeline) has nothing to defend and isn't
    held up; the rounds they did file must each have been passed. The admin
    building the timeline is never gated by this — only student submissions are.
    """
    row = previous_progress_report(db, paper_id, before_sequence)
    if row is None:
        return None
    report, phase = row
    state = _defense_state(db, report)
    if state == "defended":
        return None
    if state == "scheduled":
        return f'"{phase.label}" has not been defended yet — you can start the next report once the panel has passed it'
    if state == "failed":
        return f'"{phase.label}" was not defended — it has to be defended again before you start the next report'
    if report.status in {"draft", "changes_requested"}:
        if is_phase_open(phase):
            return f'Submit "{phase.label}" first — every round is defended before the next one starts'
        # The round closed on an unsubmitted report, so there is nothing to defend and
        # only the admin can reopen it (or take the round off the timeline).
        return f'"{phase.label}" was never submitted, so it could not be defended — ask your department to reopen that round'
    if report.status == "rejected":
        return f'"{phase.label}" was rejected by your supervisor — submit a replacement for that round first'
    return f'"{phase.label}" has not been defended yet — your department schedules that defense before the next round starts'


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
