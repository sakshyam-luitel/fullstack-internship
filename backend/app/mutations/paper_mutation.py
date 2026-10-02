import strawberry
from app.utils import find_my_paper 
from app import schemas , mutation_input , models
from app.research_workflow import current_open_phase , previous_report_block
from app.permissions import IsProfessor , IsStudent

@strawberry.type
class PaperMutation:
    # "Final report" lives on Papers itself (see models.py) so it can carry a
    # professor-approval status before Defenses (whose defense_date is required)
    # can exist — schedule_defense checks final_report_status == "approved".
    @strawberry.mutation(permission_classes=[IsStudent])
    def submit_final_report(self, info: strawberry.Info) -> schemas.PaperSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        paper = find_my_paper(db, current_user)
        if not paper:
            raise Exception("You don't have an approved paper to submit a final report for yet")
        # Final submissions belong to the final defense stage of the research timeline.
        current_open_phase(db, current_user, models.PhaseType.defense)
        # The final report comes after the whole progress series has been defended.
        blocked = previous_report_block(db, paper.id)
        if blocked:
            raise Exception(blocked)
        if paper.final_report_status in {"submitted", "approved"}:
            raise Exception("Your final report has already been submitted")
        if not paper.final_report_file_path:
            raise Exception("Attach the final report PDF before submitting")

        paper.final_report_status = "submitted"
        db.commit()
        db.refresh(paper)
        supervisor_name = db.query(models.User.name).filter(models.User.id == paper.supervisor_id).scalar()
        return schemas.PaperSchema(
            id=paper.id,
            proposal_id=paper.proposal_id,
            title=paper.title,
            status=paper.status,
            supervisor_id=paper.supervisor_id,
            supervisor_name=supervisor_name,
            cluster_id=paper.cluster_id,
            final_report_status=paper.final_report_status,
            final_report_original_filename=paper.final_report_original_filename,
            final_report_file_size_bytes=paper.final_report_file_size_bytes,
            final_report_uploaded_at=paper.final_report_uploaded_at,
        )

    @strawberry.mutation(permission_classes=[IsProfessor])
    def review_final_report(self, info: strawberry.Info, professor_input: mutation_input.FinalReportReviewInput) -> schemas.PaperSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        paper = db.query(models.Papers).filter(
            models.Papers.id == professor_input.paper_id,
            models.Papers.supervisor_id == current_user.id,
        ).first()
        if not paper:
            raise Exception("Paper not found or not supervised by you")
        if paper.final_report_status != "submitted":
            raise Exception("This paper's final report hasn't been submitted yet")

        status = professor_input.status.strip().lower()
        allowed_statuses = {"approved", "rejected", "changes_requested"}
        if status not in allowed_statuses:
            raise Exception(f"Status must be one of: {', '.join(sorted(allowed_statuses))}")

        paper.final_report_status = status
        paper.final_report_review_comment = professor_input.comment
        paper.final_report_reviewed_by = current_user.id
        db.commit()
        db.refresh(paper)
        return schemas.PaperSchema(
            id=paper.id,
            proposal_id=paper.proposal_id,
            title=paper.title,
            status=paper.status,
            supervisor_id=paper.supervisor_id,
            supervisor_name=current_user.name,
            cluster_id=paper.cluster_id,
            final_report_status=paper.final_report_status,
            final_report_review_comment=paper.final_report_review_comment,
            final_report_reviewed_by_name=current_user.name,
            final_report_original_filename=paper.final_report_original_filename,
            final_report_file_size_bytes=paper.final_report_file_size_bytes,
            final_report_uploaded_at=paper.final_report_uploaded_at,
        )