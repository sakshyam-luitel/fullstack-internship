import strawberry
from app.utils import  find_my_paper , is_paper_participant 
from app import mutation_input , schemas , models
from app.research_workflow import phase_for_new_submission , previous_report_block , ensure_phase_accepts_submissions , record_submission
from app.permissions import IsStudent , IsProfessor 

def _replaces_rejected_report(db, report) -> bool:
    """A replacement for a rejected progress report may be submitted after its round closes."""
    return db.query(models.ProgressReports).filter(
        models.ProgressReports.paper_id == report.paper_id,
        models.ProgressReports.phase_id == report.phase_id,
        models.ProgressReports.status == "rejected",
        models.ProgressReports.id != report.id,
    ).first() is not None

@strawberry.type
class ProgressReportMutation:
    # "Progress defense" — a periodic progress report against the student's paper.
    # Creating one is a draft; submit_progress_report is the compulsory-PDF gate.
    @strawberry.mutation(permission_classes=[IsStudent])
    def create_progress_report(self, info: strawberry.Info, student_input: mutation_input.ProgressReportInput) -> schemas.ProgressReportSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        paper = find_my_paper(db, current_user)
        if not paper:
            raise Exception("You don't have an approved paper to report progress on yet")

        content = student_input.content.strip()
        if not content:
            raise Exception("Describe your progress before saving")
        # One active report per round; a rejected report can be replaced in its own round.
        existing = db.query(models.ProgressReports.phase_id, models.ProgressReports.status).filter(
            models.ProgressReports.paper_id == paper.id
        ).all()
        phase = phase_for_new_submission(
            db,
            current_user,
            models.PhaseType.progress_report,
            taken_phase_ids={phase_id for phase_id, status in existing if status != "rejected"},
            retry_phase_ids={phase_id for phase_id, status in existing if status == "rejected" and phase_id},
        )
        # The series runs in order: the round before this one has to have been
        # defended. Replacing a rejected report in its own round is not "the next
        # round", so the gate looks only at rounds before the one being filed in.
        blocked = previous_report_block(db, paper.id, before_sequence=phase.sequence_number)
        if blocked:
            raise Exception(blocked)

        report = models.ProgressReports(
            paper_id=paper.id,
            submitted_by=current_user.id,
            content=content,
            status="draft",
            phase_id=phase.id,
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return schemas.ProgressReportSchema(
            id=report.id,
            paper_id=report.paper_id,
            submitted_by=report.submitted_by,
            submitted_by_name=current_user.name,
            content=report.content,
            status=report.status,
            submitted_at=report.submitted_at,
            phase_id=report.phase_id,
        )

    @strawberry.mutation(permission_classes=[IsStudent])
    def submit_progress_report(self, info: strawberry.Info, student_input: mutation_input.ProgressReportIdInput) -> schemas.ProgressReportSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        report = db.query(models.ProgressReports).filter(models.ProgressReports.id == student_input.id).first()
        if not report:
            raise Exception("Progress report not found")
        paper = db.query(models.Papers).filter(models.Papers.id == report.paper_id).first()
        if not paper or not is_paper_participant(db, paper, current_user.id):
            raise Exception("Progress report not found")
        if report.status not in {"draft", "changes_requested"}:
            raise Exception("This progress report has already been submitted")
        if not report.file_path:
            raise Exception("Attach the progress report PDF before submitting")
        if student_input.content is not None:
            if not student_input.content.strip():
                raise Exception("Describe your progress before submitting")
            report.content = student_input.content.strip()
        phase = db.query(models.ResearchPhase).filter(models.ResearchPhase.id == report.phase_id).first()
        if not phase:
            raise Exception("This progress report is not linked to a research phase")
        ensure_phase_accepts_submissions(phase, allow_late=_replaces_rejected_report(db, report))

        report.status = "submitted"
        record_submission(
            db,
            entity_type=models.SubmissionEntityType.progress_report,
            entity=report,
            phase_id=report.phase_id,
            submitted_by=current_user.id,
            status=models.SubmissionStatus.pending,
        )
        db.commit()
        db.refresh(report)
        submitted_by_name = db.query(models.User.name).filter(models.User.id == report.submitted_by).scalar()
        return schemas.ProgressReportSchema(
            id=report.id,
            paper_id=report.paper_id,
            submitted_by=report.submitted_by,
            submitted_by_name=submitted_by_name,
            content=report.content,
            status=report.status,
            submitted_at=report.submitted_at,
            original_filename=report.original_filename,
            file_size_bytes=report.file_size_bytes,
            uploaded_at=report.uploaded_at,
            phase_id=report.phase_id,
        )

    @strawberry.mutation(permission_classes=[IsProfessor])
    def review_progress_report(self, info: strawberry.Info, professor_input: mutation_input.ProgressReportReviewInput) -> schemas.ProgressReportSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        report = db.query(models.ProgressReports).filter(models.ProgressReports.id == professor_input.id).first()
        if not report:
            raise Exception("Progress report not found")
        paper = db.query(models.Papers).filter(
            models.Papers.id == report.paper_id,
            models.Papers.supervisor_id == current_user.id,
        ).first()
        if not paper:
            raise Exception("Progress report not found or not supervised by you")
        if report.status != "submitted":
            raise Exception("This progress report hasn't been submitted yet")

        status = professor_input.status.strip().lower()
        allowed_statuses = {"approved", "rejected", "changes_requested"}
        if status not in allowed_statuses:
            raise Exception(f"Status must be one of: {', '.join(sorted(allowed_statuses))}")

        report.status = status
        report.review_comment = professor_input.comment
        report.reviewed_by = current_user.id
        record_submission(
            db,
            entity_type=models.SubmissionEntityType.progress_report,
            entity=report,
            phase_id=report.phase_id,
            submitted_by=report.submitted_by,
            status=(models.SubmissionStatus.accepted if status == "approved" else models.SubmissionStatus.rejected),
            reviewed_by=current_user.id,
            comments=professor_input.comment,
        )
        db.commit()
        db.refresh(report)
        submitted_by_name = db.query(models.User.name).filter(models.User.id == report.submitted_by).scalar()
        return schemas.ProgressReportSchema(
            id=report.id,
            paper_id=report.paper_id,
            submitted_by=report.submitted_by,
            submitted_by_name=submitted_by_name,
            content=report.content,
            status=report.status,
            submitted_at=report.submitted_at,
            original_filename=report.original_filename,
            file_size_bytes=report.file_size_bytes,
            uploaded_at=report.uploaded_at,
            review_comment=report.review_comment,
            reviewed_by_name=current_user.name,
            phase_id=report.phase_id,
        )
