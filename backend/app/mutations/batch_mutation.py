import strawberry
from app.utils import active_batch , batch_schema
from app import mutation_input , schemas , queries , models
from datetime import datetime , timezone
from sqlalchemy.exc import IntegrityError
from app.permissions import IsAdminOrSuperAdmin

from app.research_workflow import active_phases


@strawberry.type
class BatchMutation:
    # A cohort is retired and the next one started in one action, because that is
    # one decision for the admin, not two steps they have to remember in order.
    @strawberry.mutation(permission_classes=[IsAdminOrSuperAdmin])
    def reset_to_new_batch(self, info: strawberry.Info, admin_input: mutation_input.ResetToNewBatchInput) -> schemas.BatchSchema:
        """Archive the cohort that has finished and start the next one.

        Nothing is deleted: the old batch's students, phases, proposals, reports,
        defenses and history all stay exactly as they are and stay queryable — they
        simply stop being the cohort everyone's day-to-day view is about.
        """
        db = info.context["db"]
        current_user = info.context["current_user"]
        label = admin_input.new_batch_label.strip()
        if not label:
            raise Exception("Give the new batch a name")
        role = getattr(current_user.role, "value", current_user.role)
        current = active_batch(db)
        if current is not None:
            # A cohort is only done once every phase of its timeline has been closed
            # (or taken off it). Otherwise a reset would strand students mid-flow.
            still_open = active_phases(db.query(models.ResearchPhase)).filter(
                models.ResearchPhase.batch_id == current.id,
                models.ResearchPhase.status != models.PhaseStatus.closed,
            ).order_by(models.ResearchPhase.sequence_number).all()
            if still_open and not admin_input.force:
                names = ", ".join(f'"{phase.label}"' for phase in still_open[:3])
                more = f" and {len(still_open) - 3} more" if len(still_open) > 3 else ""
                raise Exception(
                    f"{current.label} still has phases that have not been closed: {names}{more}. "
                    "Close them first, or ask a super admin to force the reset."
                )
            if still_open and role != "super_admin":
                raise Exception("Only a super admin can force a reset while a phase is still open")
            current.status = models.BatchStatus.archived
            current.archived_at = datetime.now(timezone.utc)
            current.archived_by = current_user.id
            db.flush()

        batch = models.Batch(label=label, status=models.BatchStatus.active, created_by=current_user.id)
        db.add(batch)
        try:
            db.flush()  
        except IntegrityError:
            db.rollback()
            raise Exception("Another batch is already active — reload and try again")
        db.commit()
        db.refresh(batch)
        return batch_schema(db, batch)

