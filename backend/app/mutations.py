import strawberry
from datetime import datetime, timezone
from sqlalchemy import Uuid, func
from sqlalchemy.exc import IntegrityError
from strawberry.file_uploads import Upload
from . import mutation_input
from . import schemas
from . import models
from . import constraints
from . import defenses
from . import notifications
from . utils import get_password_hash, committed_student_ids, has_active_proposal, rejected_proposals, save_avatar_image, is_accepted_group_member, ensure_student_profile, proposal_group_member_users, ensure_paper_for_proposal, is_paper_participant, find_my_paper
from .research_workflow import active_phases, current_open_phase, is_phase_open, phase_has_ended, newest_phase_for_level, phase_for_new_submission, record_submission, validate_phase_for_paper
from . permissions import IsSuperAdmin, IsAdminOrSuperAdmin, IsDepartmentAdmin, IsStudent, IsProfessor, IsAuthenticated

# @strawberry.type
# class AdminMutation:
#     @strawberry.mutation(permsission_classes = [IsSuperAdmin])
#     def create_admin(self , info : strawberry.Info, )

def _ensure_email_available(db, email: str, exclude_user_id=None) -> None:
    """Emails are unique regardless of letter case, so "Ram@x.com" can't shadow "ram@x.com"."""
    if not email:
        raise Exception("An email address is required")
    query = db.query(models.User).filter(func.lower(models.User.email) == email.lower())
    if exclude_user_id is not None:
        query = query.filter(models.User.id != exclude_user_id)
    if query.first():
        raise Exception(f"A user with the email {email} already exists")


def _commit_user(db) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise Exception("A user with this email already exists")


# User mutation to create , update and delete users which is done by admin
@strawberry.type
class UserMutation:
    @strawberry.mutation(permission_classes=[IsAdminOrSuperAdmin])
    def create_user(self , info : strawberry.Info , admin_input : mutation_input.UserInput ) -> schemas.UserSchema:
        db = info.context.get("db")
        current_user = info.context.get("current_user")
        current_role = getattr(current_user.role, "value", current_user.role) if current_user else ""
        requested_role = str(admin_input.role).strip().lower()
        if current_role == "super_admin" and requested_role != "admin":
            raise Exception("Super admins can only create department admins")
        if current_role == "admin" and requested_role == "admin":
            raise Exception("Department admins cannot create another department admin")
        if current_role == "admin":
            department_id = current_user.department_id
        else:
            department_id = admin_input.department_id
        if not department_id:
            raise Exception("A department is required")

        email = admin_input.email.strip()
        _ensure_email_available(db, email)

        degree_program_id = None
        if requested_role == "student":
            # Chosen once, at account creation — this is what auto-creates the
            # student's profile later, so a student account can't exist without it.
            degree_program_id = constraints.resolve_student_degree_program(
                db, department_id, admin_input.degree_program_id, admin_input.degree_level
            ).id

        hashed_password = get_password_hash(admin_input.password)
        user = models.User(
            department_id = department_id,
            name = admin_input.name,
            email = email,
            password = hashed_password,
            role = models.Role(requested_role),
            degree_program_id = degree_program_id,
        )
        db.add(user)
        _commit_user(db)
        db.refresh(user)

        return schemas.UserSchema(
            id=user.id,
            department_id=user.department_id,
            name = user.name,
            email = user.email,
            password="********",
            role = getattr(user.role, "value", user.role),
            created_at=user.created_at,
            avatar_url=user.avatar_url,
            degree_program_id=user.degree_program_id,
        )
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_user(self , info : strawberry.Info , admin_input : mutation_input.UserUpdateInput) -> schemas.UserSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        user = db.query(models.User).filter(models.User.id == admin_input.id).first()
        if not user:
            raise Exception("User not found")

        email = admin_input.email.strip()
        _ensure_email_available(db, email, exclude_user_id=user.id)
        hashed_password = get_password_hash(admin_input.password)

        user.name = admin_input.name
        user.email = email
        user.password = hashed_password

        # Backfills a degree program for accounts created before it became required
        # at signup, or lets an admin correct one — same field auto-creation reads from.
        if admin_input.degree_program_id is not None or admin_input.degree_level:
            if getattr(user.role, "value", user.role) != "student":
                raise Exception("Only student accounts have a degree program")
            user.degree_program_id = constraints.resolve_student_degree_program(
                db, current_user.department_id, admin_input.degree_program_id, admin_input.degree_level
            ).id

        _commit_user(db)
        db.refresh(user)

        return schemas.UserSchema(
            id=user.id,
            department_id=user.department_id,
            name = user.name,
            email = user.email,
            password="********",
            role = getattr(user.role, "value", user.role),
            created_at=user.created_at,
            avatar_url=user.avatar_url,
            degree_program_id=user.degree_program_id,
        )

    # Any signed-in user (student, professor, admin, super_admin) can set their own
    # profile picture — this is the account holder's own avatar, not an admin action.
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def upload_profile_image(self, info: strawberry.Info, file: Upload) -> schemas.UserSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]

        avatar_url = await save_avatar_image(current_user.id, file)
        current_user.avatar_url = avatar_url
        db.commit()
        db.refresh(current_user)

        return schemas.UserSchema(
            id=current_user.id,
            department_id=current_user.department_id,
            name=current_user.name,
            email=current_user.email,
            password="********",
            role=current_user.role,
            created_at=current_user.created_at,
            avatar_url=current_user.avatar_url,
        )

    # Removing the users as it is not the actual practice while designing the database
    # @strawberry.mutation(permission_classes=[IsAdmin])
    # def delete_user(self , info : strawberry.Info , admin_input : mutation_input.UserDeleteInput) -> schemas.UserSchema:
    #     db = info.context["db"]
    #     user_query = db.query(models.User).filter(models.User.id == admin_input.id)
    #     user = user_query.first()
    #     if not user:
    #         raise Exception(f"User with the {user.id} not found")
        
    #     deleted_post = schemas.UserSchema(
    #         id=user.id,
    #         department_id=user.department_id,
    #         name = user.name,
    #         email = user.email,
    #         password="********",
    #         role = user.role,
    #         created_at=user.created_at,
    #     )
        
    #     user_query.delete(synchronize_session = False)
    #     db.commit()
        
    #     return deleted_post

        

@strawberry.type
class DepartmentMutation:
    
    # Mutation to create a new department
    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    def create_department(self, info : strawberry.Info , admin_input : mutation_input.DepartmentCreateInput) -> schemas.DepartmentSchema:
        db = info.context["db"]
        department = models.Department(
            name = admin_input.name,
            code = admin_input.code
        )
        
        db.add(department)
        db.commit()
        db.refresh(department)

        return schemas.DepartmentSchema(
            id=department.id,
            name = department.name,
            code = department.code,
            created_at=department.created_at,
        )

    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    def update_department(self, info: strawberry.Info, admin_input: mutation_input.DepartmentUpdateInput) -> schemas.DepartmentSchema:
        db = info.context["db"]
        department = db.query(models.Department).filter(models.Department.id == admin_input.id).first()
        if not department:
            raise Exception(f"Department with {admin_input.id} is not found")

        department.name = admin_input.name
        department.code = admin_input.code
        db.commit()
        db.refresh(department)

        return schemas.DepartmentSchema(
            id=department.id,
            name=department.name,
            code=department.code,
            created_at=department.created_at,
        )

    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    def delete_department(self, info: strawberry.Info, admin_input: mutation_input.DepartmentDeleteInput) -> schemas.DepartmentSchema:
        db = info.context["db"]
        department = db.query(models.Department).filter(models.Department.id == admin_input.id).first()
        if not department:
            raise Exception(f"Department with {admin_input.id} is not found")

        deleted_department = schemas.DepartmentSchema(
            id=department.id,
            name=department.name,
            code=department.code,
            created_at=department.created_at,
        )

        department.is_active = False
        db.commit()
        db.refresh(department)
        return deleted_department
        
    
    # Mutation to Update the department
    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    def update_deparment(self , info : strawberry.Info , admin_input : mutation_input.DepartmentUpdateInput) -> schemas.DepartmentSchema:
        db = info.context["db"]
        department = db.query(models.Department).filter(admin_input.id == models.Department.id).first()
        if not department:
            raise Exception(f"Department with {admin_input.id} is not found")
        
        department.name = admin_input.name
        department.code = admin_input.code
        
        db.commit()
        db.refresh(department)

        return schemas.DepartmentSchema(
            id=department.id,
            name = department.name,
            code = department.code,
            created_at=department.created_at,
        )
    


@strawberry.type
class DegreeProgramsMutation:
    # Mutation to create degree programs
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def create_degree_program(self , info : strawberry.Info , admin_input : mutation_input.DegreeProgramsInput) -> schemas.DegreeProgramSchema:
        db = info.context["db"]
        degree_program = models.DegreePrograms(
            name = admin_input.name,
            level = admin_input.level,
            department_id = admin_input.department_id
        )
        
        db.add(degree_program)
        db.commit()
        db.refresh(degree_program)

        return schemas.DegreeProgramSchema(
            id = degree_program.id,
            name = degree_program.name,
            level = degree_program.level.value
            ,department_id = degree_program.department_id
        )
    
    # Mutation to update Degree Programs
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_degree_program(self , info : strawberry.Info , admin_input : mutation_input.DegreeProgramUpdateInput) -> schemas.DegreeProgramSchema:
        db = info.context["db"]
        degree_program = db.query(models.DegreePrograms).filter(models.DegreePrograms.id == admin_input.id).first()
        if not degree_program:
            raise Exception(f"The degree with {admin_input.id} was not found")
        
        degree_program.name = admin_input.name
        degree_program.level = admin_input.level
        degree_program.department_id = admin_input.department_id
    
        db.commit()
        db.refresh(degree_program)

        return schemas.DegreeProgramSchema(
            id = degree_program.id,
            name = degree_program.name,
            level = degree_program.level.value,
            department_id = degree_program.department_id
        )
        
    # Mutation to delete a degree program
    @strawberry.mutation(permission_classes = [IsDepartmentAdmin])
    def delete_degree_program(self , info : strawberry.Info , admin_input : mutation_input.DegreeProgramDeleteInput) -> schemas.DegreeProgramSchema:
        db = info.context["db"]
        degree_program_query = db.query(models.DegreePrograms).filter(models.DegreePrograms.id == admin_input.id)
        degree_program = degree_program_query.first()
        if not degree_program:
            raise Exception(f"Degree program with {id} was not found")
        
        deleted_degree_program = schemas.DegreeProgramSchema(
            id = degree_program.id,
            name = degree_program.name,
            level = degree_program.level.value,
            department_id = degree_program.department_id
        )
        
        degree_program_query.delete(synchronize_session = False)
        db.commit()
         
        return deleted_degree_program
        
        
@strawberry.type
class ClustersMutation:
    # Mutation to create cluster
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def create_cluster(self , info : strawberry.Info , admin_input : mutation_input.ClusterInput) -> schemas.ClusterSchema:
        db = info.context["db"]
        cluster = models.Clusters(
            department_id = admin_input.department_id,
            name = admin_input.name
        )
        
        db.add(cluster)
        db.commit()
        db.refresh(cluster)

        return schemas.ClusterSchema(
            id = cluster.id,
            department_id = cluster.department_id,
            name = cluster.name
        )
    
    # Mutation to update cluster
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_cluster(self , info : strawberry.Info , admin_input : mutation_input.ClusterUpdateInput)-> schemas.ClusterSchema:
        db = info.context["db"]
        cluster = db.query(models.Clusters).filter(models.Clusters.id == admin_input.id).first()
        if not cluster:
            raise Exception(f"Cluster with {admin_input.id} does not exist")
        
        cluster.name = admin_input.name
        cluster.department_id = admin_input.department_id
        
        db.commit()    
        return schemas.ClusterSchema(
            id = cluster.id,
            department_id = cluster.department_id,
            name = cluster.name,
        )
    
    # mutation to delete cluster
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def delete_cluster(self , info : strawberry.Info , admin_input : mutation_input.ClusterDeleteInput) -> schemas.ClusterSchema:
        db = info.context["db"]
        cluster_query = db.query(models.Clusters).filter(models.Clusters.id == admin_input.id)
        cluster = cluster_query.first()
        
        if not cluster:
            raise Exception(f"Cluster with given {admin_input.id} does not exist")
        
        deleted_cluster = schemas.ClusterSchema(
            id = cluster.id,
            department_id = cluster.department_id,
            name = cluster.name
        )

        
        cluster_query.delete(synchronize_session = False)
        db.commit()
        
        return deleted_cluster
        
    
@strawberry.type
class StudentProfilesMutation:
    # mutation to create student profile
    @strawberry.mutation(permission_classes = [IsDepartmentAdmin])
    def create_student_profile(self , info : strawberry.Info , admin_input : mutation_input.StudentProfilesInput) -> schemas.StudentProfileSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        student_user = db.query(models.User).filter(models.User.id == admin_input.user_id).first()
        if not student_user or getattr(student_user.role, "value", student_user.role) != "student":
            raise Exception("Selected user is not a student")
        if student_user.department_id != current_user.department_id:
            raise Exception("Student must belong to your department")
        degree_program = db.query(models.DegreePrograms).filter(
            models.DegreePrograms.id == admin_input.degree_program_id,
            models.DegreePrograms.department_id == current_user.department_id,
        ).first()
        if not degree_program:
            raise Exception("Degree program must belong to your department")
        
        student = models.StudentProfiles(
            user_id = admin_input.user_id,
            degree_program_id = admin_input.degree_program_id,
            supervisor_id = admin_input.supervisor_id,
            status = admin_input.status,
            roll_number = admin_input.roll_number or None,
        )
        if db.query(models.StudentProfiles).filter(models.StudentProfiles.user_id == admin_input.user_id).first():
            raise Exception("Student already has a profile. Use update profile instead.")

        db.add(student)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise Exception("Roll number is already in use")
        db.refresh(student)

        return schemas.StudentProfileSchema(
            user_id = student.user_id,
            degree_program_id = student.degree_program_id,
            supervisor_id = student.supervisor_id,
            status =  student.status,
            roll_number = student.roll_number,
        )

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_student_profile(self, info: strawberry.Info, admin_input: mutation_input.StudentProfileUpdateInput) -> schemas.StudentProfileSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        student = db.query(models.StudentProfiles).filter(models.StudentProfiles.user_id == admin_input.user_id).first()
        degree_program = db.query(models.DegreePrograms).filter(
            models.DegreePrograms.id == admin_input.degree_program_id,
            models.DegreePrograms.department_id == current_user.department_id,
        ).first()
        if not student or not degree_program:
            raise Exception("Student profile or degree program not found in your department")
        student.degree_program_id = admin_input.degree_program_id
        student.supervisor_id = admin_input.supervisor_id
        student.status = admin_input.status
        student.roll_number = admin_input.roll_number or None
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise Exception("Roll number is already in use")
        db.refresh(student)
        return schemas.StudentProfileSchema(
            user_id=student.user_id,
            degree_program_id=student.degree_program_id,
            supervisor_id=student.supervisor_id,
            status=student.status,
            roll_number=student.roll_number,
        )
        
@strawberry.type
class ProfessorProfileMutation:
    @strawberry.mutation(permission_classes = [IsDepartmentAdmin])
    def create_professor_profile(self , info : strawberry.Info , admin_input : mutation_input.ProfessorProfileInput) -> schemas.ProfessorProfileSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        professor_user = db.query(models.User).filter(models.User.id == admin_input.user_id).first()
        if not professor_user or getattr(professor_user.role, "value", professor_user.role) != "professor":
            raise Exception("Selected user is not a professor")
        if professor_user.department_id != current_user.department_id:
            raise Exception("Professor must belong to your department")
        professor = models.ProfessorProfiles(
            user_id = admin_input.user_id,
            academic_rank = admin_input.academic_rank,
            max_students = admin_input.max_students
        )
        if db.query(models.ProfessorProfiles).filter(models.ProfessorProfiles.user_id == admin_input.user_id).first():
            raise Exception("Professor already has a profile. Use update profile instead.")
        
        db.add(professor)
        db.commit()
        db.refresh(professor)

        return schemas.ProfessorProfileSchema(
            user_id = professor.user_id,
            academic_rank = professor.academic_rank,
            max_students = professor.max_students
        )

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_professor_profile(self, info: strawberry.Info, admin_input: mutation_input.ProfessorProfileUpdateInput) -> schemas.ProfessorProfileSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        professor = db.query(models.ProfessorProfiles).join(
            models.User, models.ProfessorProfiles.user_id == models.User.id
        ).filter(
            models.ProfessorProfiles.user_id == admin_input.user_id,
            models.User.department_id == current_user.department_id,
        ).first()
        if not professor:
            raise Exception("Professor profile not found in your department")
        professor.academic_rank = admin_input.academic_rank
        professor.max_students = admin_input.max_students
        db.commit()
        db.refresh(professor)
        return schemas.ProfessorProfileSchema(
            user_id=professor.user_id,
            academic_rank=professor.academic_rank,
            max_students=professor.max_students,
        )
        
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
            if not is_phase_open(phase) and not _replaces_rejected_proposal(db, proposal):
                raise Exception(f'Submission window for phase "{phase.label}" is closed')
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
        if not is_phase_open(phase):
            raise Exception(f'Submission window for phase "{phase.label}" is closed')

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
            # Assignment normally already reserved this load. Re-check under the
            # same row lock at explicit acceptance too, which protects old records
            # created before the capacity rule existed.
            db.query(models.User).filter(models.User.id == current_user.id).with_for_update().first()
            owner = db.query(models.User).filter(models.User.id == proposal.submitted_by).first()
            level = constraints.get_degree_level(db, owner)
            proposal_size = len(proposal_group_member_users(db, proposal))
            allowed, reason = constraints.can_assign_supervisor(
                db, current_user.id, level, proposal_size, exclude_proposal_id=proposal.id
            )
            if not allowed:
                raise Exception(reason)

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
            .filter(models.ProposalCandidates.proposal_id == proposal.id)
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
        if member.degree_program_id != owner.degree_program_id:
            raise Exception("Group members must belong to the same Bachelor's degree program")

        if db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id,
            models.ProposalCandidates.student_id == member.id,
        ).first():
            raise Exception("Student is already in this group")
        if member.id in committed_student_ids(db, exclude_proposal_id=proposal.id):
            raise Exception("Student already belongs to another proposal group")
        member_count = db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id
        ).count()
        if member_count >= constraints.MAX_BACHELOR_GROUP_SIZE - 1:
            raise Exception(f"A proposal can have a maximum of {constraints.MAX_BACHELOR_GROUP_SIZE} students")
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
        if member.degree_program_id != owner.degree_program_id:
            raise Exception("Group members must belong to the same Bachelor's degree program")

        if db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id,
            models.ProposalCandidates.student_id == member.id,
        ).first():
            raise Exception("Student is already in this group")
        if member.id in committed_student_ids(db, exclude_proposal_id=proposal.id):
            raise Exception("Student already belongs to another proposal group")
        if db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id
        ).count() >= constraints.MAX_BACHELOR_GROUP_SIZE - 1:
            raise Exception(f"A proposal can have a maximum of {constraints.MAX_BACHELOR_GROUP_SIZE} students")
        candidate = models.ProposalCandidates(
            proposal_id=proposal.id,
            student_id=member.id,
            # Admin placement is authoritative and skips the request/accept flow that
            # applies when a student invites peers into their own proposal.
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
        if response == "rejected":
            # Deleting (rather than keeping a rejected row) frees the slot immediately
            # so the proposal owner can edit the group and invite someone else.
            db.delete(candidate)
        else:
            candidate.status = "accepted"
        db.commit()
        return result


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
        if not is_phase_open(phase) and not _replaces_rejected_report(db, report):
            raise Exception(f'Submission window for phase "{phase.label}" is closed')

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
            phase = active_phases(db.query(models.ResearchPhase)).filter(models.ResearchPhase.id == admin_input.phase_id).first()
            if not phase or (phase.department_id and phase.department_id != current_user.department_id):
                raise Exception("Research phase not found in your department")

        def own_phase(phase_id):
            return active_phases(db.query(models.ResearchPhase)).filter(models.ResearchPhase.id == phase_id).first() if phase_id else None

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
        if phase and phase.deleted_at is None and not is_phase_open(phase):
            raise Exception(f'Defense phase "{phase.label}" is not currently available')

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

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def add_defense_panel_member(self, info: strawberry.Info, admin_input: mutation_input.DefensePanelInput) -> schemas.DefensePanelSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        defense = db.query(models.Defenses).filter(models.Defenses.id == admin_input.defense_id).first()
        professor = db.query(models.ProfessorProfiles).filter(models.ProfessorProfiles.user_id == admin_input.professor_id).first()
        if not defense or not professor:
            raise Exception("Defense or professor profile not found")
        if defenses.subject_department_id(db, defenses.defense_subject(db, defense)) != current_user.department_id:
            raise Exception("Defense does not belong to your department")
        existing = db.query(models.DefensePanel).filter(
            models.DefensePanel.defense_id == defense.id,
            models.DefensePanel.professor_id == professor.user_id,
        ).first()
        if existing:
            raise Exception("This professor is already on the defense panel")
        panel = models.DefensePanel(defense_id=defense.id, professor_id=professor.user_id)
        db.add(panel)
        notifications.notify_panel_member_added(db, defense, professor.user_id)
        db.commit()
        db.refresh(panel)
        name = db.query(models.User.name).filter(models.User.id == panel.professor_id).scalar()
        return schemas.DefensePanelSchema(id=panel.id, defense_id=panel.defense_id, professor_id=panel.professor_id, professor_name=name, created_at=panel.created_at)

    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def record_defense_outcome(self, info: strawberry.Info, admin_input: mutation_input.DefenseOutcomeInput) -> schemas.DefenseSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        defense = db.query(models.Defenses).filter(models.Defenses.id == admin_input.defense_id).first()
        if not defense:
            raise Exception("Defense not found")
        if defenses.subject_department_id(db, defenses.defense_subject(db, defense)) != current_user.department_id:
            raise Exception("Defense does not belong to your department")
        if defenses.is_final(defense) and not defense.submission_confirmed:
            raise Exception("The student's defense submission must be confirmed before recording an outcome")
        decision = admin_input.status.strip().lower()
        if decision not in {"accepted", "rejected"}:
            raise Exception("Defense outcome must be accepted or rejected")
        defense.current_status = decision
        if defense.phase_id:
            record_submission(
                db,
                entity_type=models.SubmissionEntityType.defense,
                entity=defense,
                phase_id=defense.phase_id,
                submitted_by=current_user.id,
                status=models.SubmissionStatus(decision),
                reviewed_by=current_user.id,
                comments=admin_input.comments,
            )
        db.commit()
        db.refresh(defense)
        return defenses.defense_schema(db, defense)


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
        if admin_input.sequence_number < 1:
            raise Exception("Sequence number must be at least 1")
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
            sequence_number=admin_input.sequence_number, opens_at=admin_input.opens_at,
            deadline_at=admin_input.deadline_at, defense_date=admin_input.defense_date,
            grace_period_enabled=admin_input.grace_period_enabled, created_by=current_user.id,
        )
        db.add(phase)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise Exception("That degree level already has a phase with this sequence number")
        notified_count = notifications.notify_phase(db, phase, is_update=False)
        db.commit()
        db.refresh(phase)
        return _research_phase_schema(phase, notified_count)

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
        if admin_input.label is not None and not admin_input.label.strip():
            raise Exception("A phase label is required")
        if admin_input.sequence_number is not None and admin_input.sequence_number < 1:
            raise Exception("Sequence number must be at least 1")
        for field in ("label", "sequence_number", "opens_at", "deadline_at", "defense_date", "grace_period_enabled"):
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
        notified_count = notifications.notify_phase(db, phase, is_update=True)
        db.commit()
        db.refresh(phase)
        return _research_phase_schema(phase, notified_count)

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


def _research_phase_schema(phase: models.ResearchPhase, notified_count=None) -> schemas.ResearchPhaseSchema:
    return schemas.ResearchPhaseSchema(
        id=phase.id, phase_type=phase.phase_type.value, degree_level=phase.degree_level.value,
        department_id=phase.department_id, label=phase.label, sequence_number=phase.sequence_number,
        opens_at=phase.opens_at, deadline_at=phase.deadline_at, defense_date=phase.defense_date,
        grace_period_enabled=phase.grace_period_enabled, created_by=phase.created_by,
        created_at=phase.created_at, is_open=is_phase_open(phase), has_ended=phase_has_ended(phase),
        notified_count=notified_count,
    )


@strawberry.type
class NotificationMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    def mark_notifications_read(self, info: strawberry.Info, user_input: mutation_input.MarkNotificationsReadInput) -> int:
        """Returns how many unread notifications were marked read."""
        db = info.context["db"]
        current_user = info.context["current_user"]
        query = db.query(models.Notifications).filter(
            models.Notifications.user_id == current_user.id,
            models.Notifications.is_read.is_(False),
        )
        if user_input.ids is not None:
            query = query.filter(models.Notifications.id.in_(user_input.ids))
        updated = query.update({models.Notifications.is_read: True}, synchronize_session=False)
        db.commit()
        return updated
