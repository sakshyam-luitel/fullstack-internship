import strawberry
from app.permissions import IsDepartmentAdmin , IsStudent , IsProfessor
from app import mutation_input , schemas , queries , models
from app.research_workflow import validate_phase_for_paper , ensure_phase_accepts_submissions ,record_submission
from app import defenses , notifications
from app.utils import is_paper_participant 
from datetime import datetime , timezone

@strawberry.type
class DefenseMutation:
    # The department admin plans a defense for one submission from a research phase:
    # a proposal, a progress report, or (for the final defense) a paper whose final
    # report was approved. Planning the same submission again reschedules it.
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def schedule_defense(self, info: strawberry.Info, admin_input: mutation_input.ScheduleDefenseInput) -> schemas.DefenseSchema:
        """Plan (or reschedule) the defense of one proposal, progress report or approved final
        report, with its date, time, place and panel. Everyone involved is notified."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        chosen = [value for value in (admin_input.proposal_id, admin_input.progress_report_id, admin_input.paper_id) if value]
        if len(chosen) != 1:
            raise Exception("Choose one proposal, progress report or final report to defend")
        phase = None
        if admin_input.phase_id:
            # Deleted phases are looked up too: a proposal or report stays filed under
            # the round it was submitted in after that round is cleared off the
            # timeline, and its defense still belongs to that round.
            phase = db.query(models.ResearchPhase).filter(models.ResearchPhase.id == admin_input.phase_id).first()
            if not phase or (phase.department_id and phase.department_id != current_user.department_id):
                raise Exception("Research phase not found in your department")

        def own_phase(phase_id):
            return db.query(models.ResearchPhase).filter(models.ResearchPhase.id == phase_id).first() if phase_id else None

        if admin_input.proposal_id:
            proposal = db.query(models.Proposals).filter(models.Proposals.id == admin_input.proposal_id, models.Proposals.deleted_at.is_(None)).first()
            if not proposal:
                raise Exception("Proposal not found")
            if proposal.status in {"draft", "withdrawn", "rejected"}:
                raise Exception("Only submitted proposals can be defended")
            if phase and phase.phase_type != models.PhaseType.proposal:
                raise Exception(f'"{phase.label}" is not a proposal phase')
            phase = phase or own_phase(proposal.phase_id)
            target = {"proposal_id": proposal.id}
        elif admin_input.progress_report_id:
            report = db.get(models.ProgressReports, admin_input.progress_report_id)
            if not report:
                raise Exception("Progress report not found")
            if report.status == "draft":
                raise Exception("Only submitted progress reports can be defended")
            # The supervisor turned this round down, so there is nothing to defend until
            # the student submits a replacement — same rule the proposal branch applies.
            if report.status == "rejected":
                raise Exception("This progress report was rejected by the supervisor — it can't be defended")
            if phase and phase.phase_type != models.PhaseType.progress_report:
                raise Exception(f'"{phase.label}" is not a progress report phase')
            phase = phase or own_phase(report.phase_id)
            target = {"progress_report_id": report.id}
        else:
            paper = db.get(models.Papers, admin_input.paper_id)
            if not paper:
                raise Exception("Paper not found")
            if paper.final_report_status != "approved":
                raise Exception("The final report must be approved before a defense can be scheduled")
            # A final defense is planned into the defense phase on the timeline now;
            # a deleted one is left for final_defense_phase to replace below.
            if phase is not None and phase.deleted_at is not None:
                phase = None
            if phase:
                validate_phase_for_paper(db, phase.id, paper, models.PhaseType.defense)
            target = {"paper_id": paper.id}

        subject = defenses.defense_subject(db, models.Defenses(**target))
        if defenses.subject_department_id(db, subject) != current_user.department_id:
            raise Exception("That submission does not belong to your department")
        if target.get("paper_id") and phase is None:
            phase = defenses.final_defense_phase(db, subject, current_user.department_id)
        defense_date = admin_input.defense_date or (phase.defense_date if phase and phase.phase_type == models.PhaseType.defense else None)
        if defense_date is None:
            raise Exception("Choose a date for the defense")
        # Checked before anything is written, so a bad panel leaves no half-planned defense.
        if admin_input.panel_professor_ids is not None:
            defenses.validate_panel(db, admin_input.panel_professor_ids, current_user.department_id)

        # A failed defense doesn't block planning a new one.
        existing = db.query(models.Defenses).filter(
            models.Defenses.current_status != "rejected",
            *[getattr(models.Defenses, column) == value for column, value in target.items()],
        ).first()
        if existing and existing.current_status == "accepted":
            raise Exception("This defense already has an outcome and can't be rescheduled")
        defense = existing or models.Defenses(submission_confirmed=False, **target)
        defense.phase_id = phase.id if phase else defense.phase_id
        defense.defense_date = defense_date
        defense.scheduled_time = admin_input.scheduled_time
        defense.location = (admin_input.location or "").strip() or None
        defense.scheduled_by = current_user.id
        if existing is None:
            db.add(defense)
        db.flush()
        if admin_input.panel_professor_ids is not None:
            defenses.set_panel(db, defense, admin_input.panel_professor_ids, current_user.department_id)
        # Sent after the panel is set, so panel members hear about it in the same notification.
        notifications.notify_defense_planned(db, defense, rescheduled=existing is not None)
        db.commit()
        db.refresh(defense)
        return defenses.defense_schema(db, defense)

    @strawberry.mutation(permission_classes=[IsStudent])
    def confirm_defense_submission(self, info: strawberry.Info, student_input: mutation_input.DefenseIdInput) -> schemas.DefenseSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        defense = db.query(models.Defenses).filter(models.Defenses.id == student_input.id).first()
        if not defense:
            raise Exception("Defense not found")
        paper = db.query(models.Papers).filter(models.Papers.id == defense.paper_id).first() if defense.paper_id else None
        if not paper or not is_paper_participant(db, paper, current_user.id):
            raise Exception("Defense not found")
        if not defenses.is_final(defense):
            raise Exception("Only a final defense takes a thesis submission")
        if not defense.file_path:
            raise Exception("Attach your final thesis PDF before confirming submission")

        phase = db.query(models.ResearchPhase).filter(models.ResearchPhase.id == defense.phase_id).first() if defense.phase_id else None
        if phase and phase.deleted_at is None:
            ensure_phase_accepts_submissions(phase)

        defense.submission_confirmed = True
        defense.current_status = "pending"
        if defense.phase_id:
            record_submission(
                db,
                entity_type=models.SubmissionEntityType.defense,
                entity=defense,
                phase_id=defense.phase_id,
                submitted_by=current_user.id,
                status=models.SubmissionStatus.pending,
            )
        db.commit()
        db.refresh(defense)
        return defenses.defense_schema(db, defense)

    @strawberry.mutation(permission_classes=[IsProfessor])
    def submit_defense_verdict(self, info: strawberry.Info, professor_input: mutation_input.DefenseVerdictInput) -> schemas.DefenseSchema:
        """One panel member's verdict on a defense they sat on.

        The panel decides by itself: when the last member votes, the outcome is
        settled by majority there and then, with no admin approving it
        afterwards. A member may change their own vote until that moment.
        """
        db = info.context["db"]
        current_user = info.context["current_user"]
        defense = db.query(models.Defenses).filter(models.Defenses.id == professor_input.defense_id).first()
        if not defense:
            raise Exception("Defense not found")
        if current_user.id not in defenses.panel_professor_ids(db, defense.id):
            raise Exception("Only this defense's panel members can submit a verdict")
        if defense.current_status != "pending":
            raise Exception("This defense already has an outcome")
        if defenses.is_final(defense) and not defense.submission_confirmed:
            raise Exception("The student has not submitted their final thesis yet")
        # A panel votes on a defense it has actually heard.
        if not defenses.has_ended(defense):
            raise Exception("The defense has not been held yet — a verdict can only be given afterwards")
        try:
            verdict = models.DefenseVerdictType(professor_input.verdict.strip().lower())
        except ValueError:
            raise Exception("Verdict must be accept or reject")
        comments = (professor_input.comments or "").strip() or None
        # Turning a defense down without a reason leaves the student nothing to work from.
        if verdict == models.DefenseVerdictType.reject and not comments:
            raise Exception("Feedback is required when you reject a defense")

        # One row per member: voting again replaces their earlier verdict.
        existing = db.query(models.DefenseVerdict).filter(
            models.DefenseVerdict.defense_id == defense.id,
            models.DefenseVerdict.professor_id == current_user.id,
        ).first()
        if existing:
            existing.verdict = verdict
            existing.comments = comments
            existing.submitted_at = datetime.now(timezone.utc)
        else:
            db.add(models.DefenseVerdict(
                defense_id=defense.id, professor_id=current_user.id, verdict=verdict, comments=comments,
            ))
        db.flush()

        if defenses.finalize_if_complete(db, defense) is not None:
            decision = defense.current_status
            if defense.phase_id:
                record_submission(
                    db,
                    entity_type=models.SubmissionEntityType.defense,
                    entity=defense,
                    phase_id=defense.phase_id,
                    submitted_by=current_user.id,
                    status=models.SubmissionStatus(decision),
                    # No single person made this call, so the history row names none.
                    reviewed_by=None,
                    comments=defense.outcome_comments,
                )
            notifications.notify_defense_outcome(
                db, defense, defended=decision == "accepted",
                comments=defense.outcome_comments, requires_redefense=bool(defense.requires_redefense),
            )
        db.commit()
        db.refresh(defense)
        return defenses.defense_schema(db, defense)