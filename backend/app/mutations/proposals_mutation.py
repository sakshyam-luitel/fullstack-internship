import strawberry
from app.permissions import IsStudent , IsProfessor , IsDepartmentAdmin
from app import mutation_input , schemas , models , notifications
from app.utils import has_active_proposal , rejected_proposals , is_accepted_group_member , proposal_group_member_users , ensure_student_profile  , ensure_paper_for_proposal
from app.research_workflow import newest_phase_for_level , phase_for_new_submission , ensure_phase_accepts_submissions , record_submission
from app import mutation_input , models , schemas , constraints
from datetime import datetime , timezone


def _replaces_rejected_proposal(db, proposal) -> bool:
    """A replacement for a rejected proposal may be submitted after its phase closes."""
    return any(
        item.id != proposal.id and (item.phase_id is None or item.phase_id == proposal.phase_id)
        for item in rejected_proposals(db, proposal.submitted_by)
    )


def _replaces_rejected_report(db, report) -> bool:
    """A replacement for a rejected progress report may be submitted after its round closes."""
    return db.query(models.ProgressReports).filter(
        models.ProgressReports.paper_id == report.paper_id,
        models.ProgressReports.phase_id == report.phase_id,
        models.ProgressReports.status == "rejected",
        models.ProgressReports.id != report.id,
    ).first() is not None
    
@strawberry.type
class ProposalsMutation:
	@strawberry.mutation(permission_classes=[IsStudent])
	def create_proposal_by_user(self , info : strawberry.Info , student_input : mutation_input.ProposalsInput) -> schemas.ProposalSchemaUser:
		db = info.context["db"]
		current_user = info.context["current_user"]
		if student_input.status.lower() == "submitted":
			raise Exception("Save your proposal as a draft first, then submit it")
		if has_active_proposal(db, current_user.id):
			raise Exception("You already have an active proposal — continue that one instead")
		# After a rejection the student may start over in the rejected proposal's phase.
		rejected = rejected_proposals(db, current_user.id)
		retry_phase_ids = {item.phase_id for item in rejected if item.phase_id}
		if any(item.phase_id is None for item in rejected):
			# Proposals from before the timeline existed have no phase of their own.
			fallback = newest_phase_for_level(db, current_user, models.PhaseType.proposal)
			if fallback is not None:
				retry_phase_ids.add(fallback.id)
		phase = phase_for_new_submission(db, current_user, models.PhaseType.proposal, retry_phase_ids=retry_phase_ids)
		proposal = models.Proposals(
			submitted_by = current_user.id,
			title = student_input.title,
			status = student_input.status,
			phase_id=phase.id,
		)
		
		db.add(proposal)
		db.commit()
		db.refresh(proposal)

		return schemas.ProposalSchemaUser(
			id=proposal.id,
			submitted_by = proposal.submitted_by,
			title = proposal.title,
			status = proposal.status,
			supervisor_id=proposal.supervisor_id,
			supervisor_name=None,
			group_members=[],
			phase_id=proposal.phase_id,
		)

	@strawberry.mutation(permission_classes=[IsStudent])
	def update_proposal_by_user(self, info: strawberry.Info, student_input: mutation_input.ProposalUpdateInput) -> schemas.ProposalSchemaUser:
		db = info.context["db"]
		current_user = info.context["current_user"]
		proposal = db.query(models.Proposals).filter(models.Proposals.id == student_input.id).first()
		if not proposal:
			raise Exception("Proposal not found")

		is_owner = proposal.submitted_by == current_user.id
		if not is_owner and not is_accepted_group_member(db, proposal.id, current_user.id):
			raise Exception("Proposal not found")
		if proposal.deleted_at is not None:
			raise Exception("This proposal has been deleted")

		# Addressing a professor's "changes_requested" feedback always goes through
		# respond_to_proposal_feedback instead, so a written reply is never skipped.
		if proposal.status == "changes_requested" and student_input.status.lower() == "submitted":
			raise Exception("Use the feedback response form to address the professor's requested changes")

		if student_input.status.lower() == "submitted":
			if not proposal.file_path:
				raise Exception("Attach the proposal PDF before submitting")
			phase = db.query(models.ResearchPhase).filter(models.ResearchPhase.id == proposal.phase_id).first()
			if not phase:
				raise Exception("This proposal is not linked to a research phase")
			ensure_phase_accepts_submissions(phase, allow_late=_replaces_rejected_proposal(db, proposal))
			accepted_count = db.query(models.ProposalCandidates).filter(
				models.ProposalCandidates.proposal_id == proposal.id,
				models.ProposalCandidates.status == "accepted",
			).count()
			pending_count = db.query(models.ProposalCandidates).filter(
				models.ProposalCandidates.proposal_id == proposal.id,
				models.ProposalCandidates.status == "pending",
			).count()
			owner = db.query(models.User).filter(models.User.id == proposal.submitted_by).first()
			level = constraints.get_degree_level(db, owner)
			accepted_candidates = (
				db.query(models.User)
				.join(models.ProposalCandidates, models.ProposalCandidates.student_id == models.User.id)
				.filter(
					models.ProposalCandidates.proposal_id == proposal.id,
					models.ProposalCandidates.status == "accepted",
				).all()
			)
			if level == models.DegreeLevel.bachelors:
				if pending_count > 0:
					raise Exception("Wait for every group member to respond to your request before submitting")
				constraints.check_group_composition(db, level, accepted_candidates, owner)
			elif accepted_count > 0 or pending_count > 0:
				# Defense in depth — invites are already blocked for non-Bachelor's proposals.
				if level is None:
					raise Exception(f"{owner.name} has no degree program on file — ask an admin to set one first")
				raise Exception("Master's and PhD proposals are individual — group members aren't allowed")
			# Submitting the proposal is what puts the whole group in front of an
			# admin, so this is where each member's profile gets created automatically.
			for member_user in proposal_group_member_users(db, proposal):
				ensure_student_profile(db, member_user)
		proposal.title = student_input.title
		proposal.status = student_input.status
		if student_input.status.lower() == "submitted":
			record_submission(
				db,
				entity_type=models.SubmissionEntityType.proposal,
				entity=proposal,
				phase_id=proposal.phase_id,
				submitted_by=current_user.id,
				status=models.SubmissionStatus.pending,
			)
		db.commit()
		db.refresh(proposal)
		supervisor_name = db.query(models.User.name).filter(models.User.id == proposal.supervisor_id).scalar() if proposal.supervisor_id else None
		return schemas.ProposalSchemaUser(
			id=proposal.id,
			submitted_by=proposal.submitted_by,
			title=proposal.title,
			status=proposal.status,
			supervisor_id=proposal.supervisor_id,
			supervisor_name=supervisor_name,
			group_members=[],
			phase_id=proposal.phase_id,
		)

	@strawberry.mutation(permission_classes=[IsStudent])
	def respond_to_proposal_feedback(self, info: strawberry.Info, student_input: mutation_input.ProposalFeedbackResponseInput) -> schemas.ProposalSchemaUser:
		db = info.context["db"]
		current_user = info.context["current_user"]
		proposal = db.query(models.Proposals).filter(models.Proposals.id == student_input.proposal_id).first()
		if not proposal:
			raise Exception("Proposal not found")

		is_owner = proposal.submitted_by == current_user.id
		if not is_owner and not is_accepted_group_member(db, proposal.id, current_user.id):
			raise Exception("Proposal not found")
		if proposal.status != "changes_requested":
			raise Exception("This proposal has no pending change request to respond to")
		phase = db.query(models.ResearchPhase).filter(models.ResearchPhase.id == proposal.phase_id).first()
		if not phase:
			raise Exception("This proposal is not linked to a research phase")
		ensure_phase_accepts_submissions(phase)

		response_text = student_input.response.strip()
		if not response_text:
			raise Exception("Write a response describing the changes you made")

		proposal.student_response = response_text
		proposal.responded_by = current_user.id
		proposal.status = "submitted"
		for member_user in proposal_group_member_users(db, proposal):
			ensure_student_profile(db, member_user)
		record_submission(
			db,
			entity_type=models.SubmissionEntityType.proposal,
			entity=proposal,
			phase_id=proposal.phase_id,
			submitted_by=current_user.id,
			status=models.SubmissionStatus.pending,
			comments="Resubmission after requested changes",
		)
		db.commit()
		db.refresh(proposal)

		supervisor_name = db.query(models.User.name).filter(models.User.id == proposal.supervisor_id).scalar() if proposal.supervisor_id else None
		return schemas.ProposalSchemaUser(
			id=proposal.id,
			submitted_by=proposal.submitted_by,
			title=proposal.title,
			status=proposal.status,
			supervisor_id=proposal.supervisor_id,
			supervisor_name=supervisor_name,
			group_members=[],
			review_comment=proposal.review_comment,
			student_response=proposal.student_response,
			responded_by_name=current_user.name,
			phase_id=proposal.phase_id,
		)

	# Students no longer delete proposals at all — once created, a proposal can only be
	# removed by a department admin, and only after a professor has rejected it. The
	# record itself is never hard-deleted: it stays visible in student/professor/admin
	# history, just flagged with deleted_at/deleted_by.
	@strawberry.mutation(permission_classes=[IsDepartmentAdmin])
	def delete_proposal_as_admin(self, info: strawberry.Info, admin_input: mutation_input.ProposalDeleteInput) -> schemas.ProposalSchemaAdmin:
		db = info.context["db"]
		current_user = info.context["current_user"]
		proposal = db.query(models.Proposals).join(
			models.User, models.Proposals.submitted_by == models.User.id
		).filter(
			models.Proposals.id == admin_input.id,
			models.User.department_id == current_user.department_id,
		).first()
		if not proposal:
			raise Exception("Proposal not found in your department")
		if proposal.status != "rejected":
			raise Exception("Only proposals rejected by the professor can be deleted")
		if proposal.deleted_at is not None:
			raise Exception("Proposal has already been deleted")

		proposal.deleted_at = datetime.now(timezone.utc)
		proposal.deleted_by = current_user.id
		# Soft delete: the row stays, and the uploaded PDF is deliberately left in
		# storage — nothing here touches file_storage. The audit trail records who.
		if proposal.phase_id:
			record_submission(
				db,
				entity_type=models.SubmissionEntityType.proposal,
				entity=proposal,
				phase_id=proposal.phase_id,
				submitted_by=proposal.submitted_by,
				status=models.SubmissionStatus.deleted,
				reviewed_by=current_user.id,
				comments=f"Deleted by {current_user.name}",
			)
		db.commit()
		db.refresh(proposal)

		submitted_by_name = db.query(models.User.name).filter(models.User.id == proposal.submitted_by).scalar()
		cluster_name = db.query(models.Clusters.name).filter(models.Clusters.id == proposal.cluster_id).scalar() if proposal.cluster_id else None
		return schemas.ProposalSchemaAdmin(
			id=proposal.id,
			submitted_by=proposal.submitted_by,
			submitted_by_name=submitted_by_name,
			title=proposal.title,
			status=proposal.status,
			reviewed_by=proposal.reviewed_by,
			cluster_id=proposal.cluster_id,
			cluster_name=cluster_name,
			supervisor_id=proposal.supervisor_id,
			supervisor_name=None,
			group_members=[],
			review_comment=proposal.review_comment,
			deleted_at=proposal.deleted_at,
			deleted_by_name=current_user.name,
		)

	@strawberry.mutation(permission_classes=[IsDepartmentAdmin])
	def assign_proposal(self, info: strawberry.Info, admin_input: mutation_input.ProposalsReviewInput) -> schemas.ProposalSchemaAdmin:
		db = info.context["db"]

		proposal = db.query(models.Proposals).filter(
			models.Proposals.id == admin_input.proposal_id
		).first()

		if not proposal:
			raise Exception("Proposal not found")
		if proposal.deleted_at is not None:
			raise Exception("This proposal has been deleted")

		student = db.query(models.User).filter(models.User.id == proposal.submitted_by).first()
		supervisor = db.query(models.User).filter(models.User.id == admin_input.supervisor_id).first()
		if not student or getattr(student.role, "value", student.role) != "student":
			raise Exception("Proposal submitter is not a student")
		if not supervisor or getattr(supervisor.role, "value", supervisor.role) != "professor":
			raise Exception("Supervisor must be a professor")
		if supervisor.department_id != student.department_id:
			raise Exception("Supervisor must belong to the student's department")

		current_user = info.context.get("current_user")
		if current_user.department_id != student.department_id:
			raise Exception("Proposal does not belong to your department")

		# Lock the supervisor's row for the rest of this transaction so two concurrent
		# assignments to the same professor can't both read a stale load and jointly
		# exceed capacity — not every professor has a ProfessorProfiles row (none do in
		# dev today), so this locks User, which always exists.
		db.query(models.User).filter(models.User.id == supervisor.id).with_for_update().first()

		level = constraints.get_degree_level(db, student)
		if level is None:
			raise Exception(f"{student.name} has no degree program on file — ask an admin to set one first")

		accepted_candidates = (
			db.query(models.User)
			.join(models.ProposalCandidates, models.ProposalCandidates.student_id == models.User.id)
			.filter(
				models.ProposalCandidates.proposal_id == proposal.id,
				models.ProposalCandidates.status == "accepted",
			)
			.all()
		)
		constraints.check_group_composition(db, level, accepted_candidates, student)

		proposal_size = 1 + len(accepted_candidates)
		allowed, reason = constraints.can_assign_supervisor(
			db, supervisor.id, level, proposal_size, exclude_proposal_id=proposal.id
		)
		if not allowed:
			raise Exception(reason)

		proposal.cluster_id = admin_input.cluster_id
		proposal.supervisor_id = admin_input.supervisor_id
		proposal.status = "assigned"
		# reviewed_by stays untouched here — that gets set later, by the professor's review, not admin's assignment

		# Fills in each group member's profile supervisor now that one has actually
		# been assigned to their proposal.
		for member_user in proposal_group_member_users(db, proposal):
			ensure_student_profile(db, member_user, supervisor_id=admin_input.supervisor_id)

		db.commit()
		db.refresh(proposal)
		submitted_by_name = db.query(models.User.name).filter(models.User.id == proposal.submitted_by).scalar()
		supervisor_name = db.query(models.User.name).filter(models.User.id == proposal.supervisor_id).scalar()
		cluster_name = db.query(models.Clusters.name).filter(models.Clusters.id == proposal.cluster_id).scalar() if proposal.cluster_id else None

		return schemas.ProposalSchemaAdmin(
			id=proposal.id,
			submitted_by=proposal.submitted_by,
			submitted_by_name=submitted_by_name,
			title = proposal.title,
			status=proposal.status,
			reviewed_by = proposal.reviewed_by,
			cluster_id=proposal.cluster_id,
			cluster_name=cluster_name,
			supervisor_id=proposal.supervisor_id,
			supervisor_name=supervisor_name,
			group_members=[],
			phase_id=proposal.phase_id,

		)

	@strawberry.mutation(permission_classes=[IsProfessor])
	def review_proposal(self, info: strawberry.Info, professor_input: mutation_input.ProposalReviewDecisionInput) -> schemas.ProposalSchemaAdmin:
		db = info.context["db"]
		current_user = info.context["current_user"]

		proposal = db.query(models.Proposals).filter(
			models.Proposals.id == professor_input.proposal_id,
			models.Proposals.supervisor_id == current_user.id,
		).first()
		if not proposal:
			raise Exception("Proposal not found or not assigned to you")
		if proposal.deleted_at is not None:
			raise Exception("This proposal has been deleted and can no longer be reviewed")

		status = professor_input.status.strip().lower()
		allowed_statuses = {"approved", "rejected", "changes_requested"}
		if status not in allowed_statuses:
			raise Exception(f"Status must be one of: {', '.join(sorted(allowed_statuses))}")

		if status == "approved":
			# Capacity is the department admin's decision, made in assign_proposal;
			# the professor is never blocked here for an assignment they were given.
			# Re-check anyway under the same row lock to catch records assigned
			# before the capacity rule existed, and send the admins who can reassign
			# it a notification instead of failing the professor's review.
			db.query(models.User).filter(models.User.id == current_user.id).with_for_update().first()
			owner = db.query(models.User).filter(models.User.id == proposal.submitted_by).first()
			level = constraints.get_degree_level(db, owner)
			proposal_size = len(proposal_group_member_users(db, proposal))
			allowed, reason = constraints.can_assign_supervisor(
				db, current_user.id, level, proposal_size, exclude_proposal_id=proposal.id
			)
			if not allowed:
				notifications.notify_supervision_over_capacity(db, proposal, reason)

		proposal.status = status
		proposal.reviewed_by = current_user.id
		proposal.review_comment = professor_input.comment
		# Clear out the previous cycle's student reply — it answered the comment
		# that's being replaced, so keeping it around would pair it with the wrong one.
		proposal.student_response = None
		proposal.responded_by = None
		if status == "approved":
			# This is the only bridge from Proposals into Papers — approving is what
			# actually starts the paper, which progress reports and the final defense
			# attach to.
			ensure_paper_for_proposal(db, proposal)
		record_submission(
			db,
			entity_type=models.SubmissionEntityType.proposal,
			entity=proposal,
			phase_id=proposal.phase_id,
			submitted_by=proposal.submitted_by,
			status=(models.SubmissionStatus.accepted if status == "approved" else models.SubmissionStatus.rejected),
			reviewed_by=current_user.id,
			comments=professor_input.comment,
		)
		db.commit()
		db.refresh(proposal)

		submitted_by_name = db.query(models.User.name).filter(models.User.id == proposal.submitted_by).scalar()
		cluster_name = db.query(models.Clusters.name).filter(models.Clusters.id == proposal.cluster_id).scalar() if proposal.cluster_id else None
		group_members = [
			schemas.ProposalMemberSchema(id=member.id, name=member.name, status=member_status)
			for member, member_status in db.query(models.User, models.ProposalCandidates.status)
			.join(models.ProposalCandidates, models.ProposalCandidates.student_id == models.User.id)
			.filter(
				models.ProposalCandidates.proposal_id == proposal.id,
				models.ProposalCandidates.status != "rejected",
			)
			.order_by(models.User.name)
			.all()
		]

		return schemas.ProposalSchemaAdmin(
			id=proposal.id,
			submitted_by=proposal.submitted_by,
			submitted_by_name=submitted_by_name,
			title=proposal.title,
			status=proposal.status,
			reviewed_by=proposal.reviewed_by,
			cluster_id=proposal.cluster_id,
			cluster_name=cluster_name,
			supervisor_id=proposal.supervisor_id,
			supervisor_name=current_user.name,
			group_members=group_members,
			review_comment=proposal.review_comment,
			reviewed_by_name=current_user.name,
			phase_id=proposal.phase_id,
		)