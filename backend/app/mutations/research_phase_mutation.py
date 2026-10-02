import strawberry
from app.utils import active_batch
from app import mutation_input , models , schemas , notifications
from app.research_workflow import phase_addition_rules , next_sequence_number , active_phases , is_phase_open , phase_has_ended , validate_phase_can_open
from sqlalchemy.exc import IntegrityError
from datetime import datetime , timezone
from app.permissions import IsDepartmentAdmin

def _own_phase(db, current_user, phase_id) -> models.ResearchPhase:
    """One phase from the admin's own department, or an error naming why not."""
    phase = active_phases(db.query(models.ResearchPhase)).filter(
        models.ResearchPhase.id == phase_id,
        models.ResearchPhase.department_id == current_user.department_id,
    ).first()
    if not phase:
        raise Exception("Research phase not found in your department")
    return phase


def _research_phase_schema(phase: models.ResearchPhase, notified_count=None) -> schemas.ResearchPhaseSchema:
    return schemas.ResearchPhaseSchema(
        id=phase.id, phase_type=phase.phase_type.value, degree_level=phase.degree_level.value,
        department_id=phase.department_id, label=phase.label, sequence_number=phase.sequence_number,
        opens_at=phase.opens_at, deadline_at=phase.deadline_at, defense_date=phase.defense_date,
        grace_period_enabled=phase.grace_period_enabled, created_by=phase.created_by,
        created_at=phase.created_at, is_open=is_phase_open(phase), has_ended=phase_has_ended(phase),
        status=phase.status.value, closed_at=phase.closed_at, closed_by=phase.closed_by,
        notified_count=notified_count,
    )



@strawberry.type
class ResearchPhaseMutation:
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def create_research_phase(self, info: strawberry.Info, admin_input: mutation_input.ResearchPhaseInput) -> schemas.ResearchPhaseSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        try:
            phase_type = models.PhaseType(admin_input.phase_type.strip().lower())
            degree_level = models.DegreeLevel(admin_input.degree_level.strip().lower())
        except ValueError:
            raise Exception("Phase type must be proposal, progress_report, or defense; degree level must be bachelors, masters, or phd")
        label = admin_input.label.strip()
        if not label:
            raise Exception("A phase label is required")
        batch = active_batch(db)
        if batch is None:
            raise Exception("No batch is running — start one before scheduling phases")
        # The timeline runs proposal, then progress rounds, then the final defense.
        reason = phase_addition_rules(db, degree_level, current_user.department_id, batch.id)[phase_type]
        if reason:
            raise Exception(reason)
        # Always the next step: appending in the order above is what keeps the
        # timeline in order, so a typed step number is ignored.
        sequence_number = next_sequence_number(db, degree_level, current_user.department_id, batch.id)
        if phase_type == models.PhaseType.defense:
            if not admin_input.defense_date:
                raise Exception("A defense phase requires one shared defense date")
        elif not admin_input.opens_at or not admin_input.deadline_at:
            raise Exception("Proposal and progress-report phases require opening and deadline times")
        if admin_input.opens_at and admin_input.deadline_at and admin_input.opens_at > admin_input.deadline_at:
            raise Exception("A phase cannot close before it opens")
        phase = models.ResearchPhase(
            phase_type=phase_type, degree_level=degree_level,
            department_id=current_user.department_id, label=label,
            sequence_number=sequence_number, opens_at=admin_input.opens_at,
            deadline_at=admin_input.deadline_at, defense_date=admin_input.defense_date,
            grace_period_enabled=admin_input.grace_period_enabled, created_by=current_user.id,
            # Drafted, not started: the admin lays out the whole timeline, then opens
            # each phase in turn. Nobody is notified until it actually opens.
            status=models.PhaseStatus.pending,
            # Phases belong to the cohort that is running; the admin never picks it.
            batch_id=batch.id,
        )
        db.add(phase)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise Exception("That degree level already has a phase with this sequence number")
        db.commit()
        db.refresh(phase)
        return _research_phase_schema(phase)

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_research_phase(self, info: strawberry.Info, admin_input: mutation_input.ResearchPhaseUpdateInput) -> schemas.ResearchPhaseSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        phase = active_phases(db.query(models.ResearchPhase)).filter(
            models.ResearchPhase.id == admin_input.id,
            models.ResearchPhase.department_id == current_user.department_id,
        ).first()
        if not phase:
            raise Exception("Research phase not found in your department")
        # A closed round is history. Reopen it first if its dates really must change.
        if phase.status == models.PhaseStatus.closed:
            raise Exception(f'"{phase.label}" is closed — reopen it before changing its schedule')
        if admin_input.label is not None and not admin_input.label.strip():
            raise Exception("A phase label is required")
        # Steps are numbered by the order phases were added in, which is the order
        # the rules in phase_addition_rules keep; moving one would break it.
        if admin_input.sequence_number is not None and admin_input.sequence_number != phase.sequence_number:
            raise Exception("Step numbers follow the timeline order and can't be changed")
        for field in ("label", "opens_at", "deadline_at", "defense_date", "grace_period_enabled"):
            value = getattr(admin_input, field)
            if value is not None:
                setattr(phase, field, value.strip() if field == "label" else value)
        if phase.phase_type == models.PhaseType.defense and not phase.defense_date:
            db.rollback()
            raise Exception("A defense phase requires one shared defense date")
        if phase.phase_type != models.PhaseType.defense and (not phase.opens_at or not phase.deadline_at):
            db.rollback()
            raise Exception("Proposal and progress-report phases require opening and deadline times")
        if phase.opens_at and phase.deadline_at and phase.opens_at > phase.deadline_at:
            db.rollback()
            raise Exception("A phase cannot close before it opens")
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise Exception("That degree level already has a phase with this sequence number")
        notified_count = notifications.notify_phase(db, phase, is_update=True) if phase.status == models.PhaseStatus.open else None
        db.commit()
        db.refresh(phase)
        return _research_phase_schema(phase, notified_count)

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def open_research_phase(self, info: strawberry.Info, admin_input: mutation_input.ResearchPhaseIdInput) -> schemas.ResearchPhaseSchema:
        """Start a phase, once every earlier step of its degree level has closed.

        Also reopens a phase that was closed too early. Either way the ordering
        rule is the same, and it lives in validate_phase_can_open.
        """
        db = info.context["db"]
        current_user = info.context["current_user"]
        phase = _own_phase(db, current_user, admin_input.id)
        if phase.status == models.PhaseStatus.open:
            raise Exception(f'"{phase.label}" is already open')
        validate_phase_can_open(
            db, phase.degree_level, phase.department_id, phase.sequence_number,
            batch_id=phase.batch_id, exclude_phase_id=phase.id,
        )
        phase.status = models.PhaseStatus.open
        phase.closed_at = None
        phase.closed_by = None
        # Students only hear about a phase when it actually starts taking work.
        notified_count = notifications.notify_phase(db, phase, is_update=False)
        db.commit()
        db.refresh(phase)
        return _research_phase_schema(phase, notified_count)

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def close_research_phase(self, info: strawberry.Info, admin_input: mutation_input.ResearchPhaseIdInput) -> schemas.ResearchPhaseSchema:
        """End a phase. Nothing new can be submitted into it afterwards, while
        everything already submitted stays visible and reviewable — closing is
        not a deletion, and it's what lets the next step of the timeline open."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        phase = _own_phase(db, current_user, admin_input.id)
        if phase.status == models.PhaseStatus.closed:
            raise Exception(f'"{phase.label}" is already closed')
        if phase.status == models.PhaseStatus.pending:
            raise Exception(f'"{phase.label}" has not been opened yet')
        phase.status = models.PhaseStatus.closed
        phase.closed_at = datetime.now(timezone.utc)
        phase.closed_by = current_user.id
        db.commit()
        db.refresh(phase)
        return _research_phase_schema(phase)

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def delete_research_phase(self, info: strawberry.Info, admin_input: mutation_input.ResearchPhaseDeleteInput) -> schemas.ResearchPhaseSchema:
        """Remove an ended phase from the timeline. It's a soft delete: the phase row,
        its submissions, history and defenses stay in the database, but the phase no
        longer appears in any dashboard or accepts submissions."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        phase = active_phases(db.query(models.ResearchPhase)).filter(
            models.ResearchPhase.id == admin_input.id,
            models.ResearchPhase.department_id == current_user.department_id,
        ).first()
        if not phase:
            raise Exception("Research phase not found in your department")
        if not phase_has_ended(phase):
            if phase.phase_type == models.PhaseType.defense:
                raise Exception("A final defense phase can only be deleted after its defense day has passed")
            raise Exception("A phase can only be deleted after its deadline has passed")
        phase.deleted_at = datetime.now(timezone.utc)
        phase.deleted_by = current_user.id
        db.commit()
        db.refresh(phase)
        return _research_phase_schema(phase)
