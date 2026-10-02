import strawberry
from app.permissions import IsStudent, IsStudent , IsDepartmentAdmin 
from app import mutation_input , schemas , models , constraints
from app.utils import is_accepted_group_member , committed_student_ids ,ensure_paper_for_proposal
@strawberry.type
class ProposalCandidateMutation:
    @strawberry.mutation(permission_classes=[IsStudent])
    def create_proposal_candidate(self, info: strawberry.Info, student_input: mutation_input.ProposalCandidatesMutation) -> schemas.ProposalCandidateSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        proposal = db.query(models.Proposals).filter(models.Proposals.id == student_input.proposal_id).first()
        if not proposal:
            raise Exception("Proposal not found")
        is_owner = proposal.submitted_by == current_user.id
        if not is_owner and not is_accepted_group_member(db, proposal.id, current_user.id):
            raise Exception("Proposal not found")
        if proposal.deleted_at is not None:
            raise Exception("This proposal has been deleted")
        member = db.query(models.User).filter(models.User.id == student_input.student_id).first()
        if not member or getattr(member.role, "value", member.role) != "student":
            raise Exception("Group member must be a student")
        if member.department_id != current_user.department_id:
            raise Exception("Group member must belong to your department")
        if member.id == current_user.id or member.id == proposal.submitted_by:
            raise Exception("That student is already part of this proposal")

        # Only Bachelor's proposals are group work — Master's/PhD are individual, so no
        # invite is ever valid there, and every Bachelor's invitee must match that level.
        owner = db.query(models.User).filter(models.User.id == proposal.submitted_by).first()
        owner_level = constraints.get_degree_level(db, owner)
        if owner_level is None:
            raise Exception(f"{owner.name} has no degree program on file — ask an admin to set one first")
        if owner_level != models.DegreeLevel.bachelors:
            raise Exception("Master's and PhD proposals are individual — group members aren't allowed")
        member_level = constraints.get_degree_level(db, member)
        if member_level is None:
            raise Exception(f"{member.name} has no degree program on file — ask an admin to set one first")
        if member_level != models.DegreeLevel.bachelors:
            raise Exception("Group members must be Bachelor's-level students")
        if constraints.get_degree_program_id(db, member) != constraints.get_degree_program_id(db, owner):
            raise Exception("Group members must belong to the same Bachelor's degree program")

        existing = db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id,
            models.ProposalCandidates.student_id == member.id,
        ).first()
        if existing and existing.status != "rejected":
            raise Exception("Student is already in this group")
        if member.id in committed_student_ids(db, exclude_proposal_id=proposal.id):
            raise Exception("Student already belongs to another proposal group")
        # Declined invites don't hold a place in the group.
        member_count = db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id,
            models.ProposalCandidates.status != "rejected",
        ).count()
        if member_count >= constraints.MAX_BACHELOR_GROUP_SIZE - 1:
            raise Exception(f"A proposal can have a maximum of {constraints.MAX_BACHELOR_GROUP_SIZE} students")
        if existing:
            # Inviting someone who declined asks them again.
            existing.status = "pending"
            proposal_candidate = existing
        else:
            proposal_candidate = models.ProposalCandidates(
                proposal_id = student_input.proposal_id,
                student_id = student_input.student_id,
                status = "pending",
            )
            db.add(proposal_candidate)
        db.commit()
        db.refresh(proposal_candidate)

        return schemas.ProposalCandidateSchema(
            proposal_id = proposal_candidate.proposal_id,
            student_id = proposal_candidate.student_id,
            status = proposal_candidate.status,
        )

    @strawberry.mutation(permission_classes=[IsStudent])
    def delete_proposal_candidate(self, info: strawberry.Info, student_input: mutation_input.ProposalMemberDeleteInput) -> schemas.ProposalCandidateSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        candidate = db.query(models.ProposalCandidates).join(
            models.Proposals, models.ProposalCandidates.proposal_id == models.Proposals.id
        ).filter(
            models.ProposalCandidates.proposal_id == student_input.proposal_id,
            models.ProposalCandidates.student_id == student_input.student_id,
            models.Proposals.submitted_by == current_user.id,
        ).first()
        if not candidate:
            raise Exception("Group member not found")
        result = schemas.ProposalCandidateSchema(
            proposal_id=candidate.proposal_id,
            student_id=candidate.student_id,
            status=candidate.status,
        )
        db.delete(candidate)
        db.commit()
        return result

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def add_proposal_member_as_admin(self, info: strawberry.Info, student_input: mutation_input.AdminProposalMemberInput) -> schemas.ProposalCandidateSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        proposal = db.query(models.Proposals).join(
            models.User, models.Proposals.submitted_by == models.User.id
        ).filter(
            models.Proposals.id == student_input.proposal_id,
            models.User.department_id == current_user.department_id,
        ).first()
        member = db.query(models.User).filter(
            models.User.id == student_input.student_id,
            models.User.department_id == current_user.department_id,
            models.User.role == models.Role.student,
        ).first()
        if not proposal or not member or member.id == proposal.submitted_by:
            raise Exception("Student must belong to your department")

        owner = db.query(models.User).filter(models.User.id == proposal.submitted_by).first()
        owner_level = constraints.get_degree_level(db, owner)
        if owner_level is None:
            raise Exception(f"{owner.name} has no degree program on file — ask an admin to set one first")
        if owner_level != models.DegreeLevel.bachelors:
            raise Exception("Master's and PhD proposals are individual — group members aren't allowed")
        member_level = constraints.get_degree_level(db, member)
        if member_level is None:
            raise Exception(f"{member.name} has no degree program on file — ask an admin to set one first")
        if member_level != models.DegreeLevel.bachelors:
            raise Exception("Group members must be Bachelor's-level students")
        if constraints.get_degree_program_id(db, member) != constraints.get_degree_program_id(db, owner):
            raise Exception("Group members must belong to the same Bachelor's degree program")

        existing = db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id,
            models.ProposalCandidates.student_id == member.id,
        ).first()
        if existing and existing.status != "rejected":
            raise Exception("Student is already in this group")
        if member.id in committed_student_ids(db, exclude_proposal_id=proposal.id):
            raise Exception("Student already belongs to another proposal group")
        if db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id,
            models.ProposalCandidates.status != "rejected",
        ).count() >= constraints.MAX_BACHELOR_GROUP_SIZE - 1:
            raise Exception(f"A proposal can have a maximum of {constraints.MAX_BACHELOR_GROUP_SIZE} students")
        # Admin placement is authoritative and skips the request/accept flow that
        # applies when a student invites peers into their own proposal.
        if existing:
            existing.status = "accepted"
            candidate = existing
        else:
            candidate = models.ProposalCandidates(
                proposal_id=proposal.id,
                student_id=member.id,
                status="accepted",
            )
            db.add(candidate)
        db.commit()
        db.refresh(candidate)
        return schemas.ProposalCandidateSchema(
            proposal_id=candidate.proposal_id,
            student_id=candidate.student_id,
            status=candidate.status,
        )

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def delete_proposal_member_as_admin(self, info: strawberry.Info, student_input: mutation_input.AdminProposalMemberInput) -> schemas.ProposalCandidateSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        candidate = db.query(models.ProposalCandidates).join(
            models.Proposals, models.ProposalCandidates.proposal_id == models.Proposals.id
        ).join(
            models.User, models.Proposals.submitted_by == models.User.id
        ).filter(
            models.ProposalCandidates.proposal_id == student_input.proposal_id,
            models.ProposalCandidates.student_id == student_input.student_id,
            models.User.department_id == current_user.department_id,
        ).first()
        if not candidate:
            raise Exception("Group member not found in your department")
        result = schemas.ProposalCandidateSchema(
            proposal_id=candidate.proposal_id,
            student_id=candidate.student_id,
            status=candidate.status,
        )
        db.delete(candidate)
        db.commit()
        return result

    @strawberry.mutation(permission_classes=[IsStudent])
    def respond_to_proposal_invite(self, info: strawberry.Info, student_input: mutation_input.ProposalInviteResponseInput) -> schemas.ProposalCandidateSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        candidate = db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == student_input.proposal_id,
            models.ProposalCandidates.student_id == current_user.id,
            models.ProposalCandidates.status == "pending",
        ).first()
        if not candidate:
            raise Exception("No pending request found for this proposal")

        response = student_input.status.strip().lower()
        if response not in {"accepted", "rejected"}:
            raise Exception("Status must be either accepted or rejected")

        result = schemas.ProposalCandidateSchema(
            proposal_id=candidate.proposal_id,
            student_id=candidate.student_id,
            status=response,
        )
        # A declined row stays, so the owner sees who declined and can ask again. It
        # holds no place in the group and doesn't count as belonging to it.
        candidate.status = response
        db.commit()
        return result