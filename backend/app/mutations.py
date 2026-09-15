import strawberry
from sqlalchemy import Uuid
from . import mutation_input
from . import schemas
from . import models
from . utils import get_password_hash
from . permissions import IsSuperAdmin, IsAdminOrSuperAdmin, IsDepartmentAdmin, IsStudent

# @strawberry.type
# class AdminMutation:
#     @strawberry.mutation(permsission_classes = [IsSuperAdmin])
#     def create_admin(self , info : strawberry.Info, )

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

        hashed_password = get_password_hash(admin_input.password)
        user = models.User(
            department_id = department_id,
            name = admin_input.name,
            email = admin_input.email,
            password = hashed_password,
            role = models.Role(requested_role)
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return schemas.UserSchema(
            id=user.id,
            department_id=user.department_id,
            name = user.name,
            email = user.email,
            password="********",
            role = user.role
            ,created_at=user.created_at,
        )
    
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def update_user(self , info : strawberry.Info , admin_input : mutation_input.UserUpdateInput) -> schemas.UserSchema:
        db = info.context["db"]
        user = db.query(models.User).filter(models.User.id == admin_input.id).first()
        if not user:
            raise Exception("User not found")
        
        hashed_password = get_password_hash(admin_input.password)
        
        user.name = admin_input.name
        user.email = admin_input.email
        user.password = hashed_password
        
        db.commit()
        db.refresh(user)

        return schemas.UserSchema(
            id=user.id,
            department_id=user.department_id,
            name = user.name,
            email = user.email,
            password="********",
            role = user.role,
            created_at=user.created_at,
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
            level = degree_program.level
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
            level = degree_program.level,
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
            level = degree_program.level,
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
            status = admin_input.status
        )
        if db.query(models.StudentProfiles).filter(models.StudentProfiles.user_id == admin_input.user_id).first():
            raise Exception("Student already has a profile. Use update profile instead.")
        
        db.add(student)
        db.commit()
        db.refresh(student)

        return schemas.StudentProfileSchema(
            user_id = student.user_id,
            degree_program_id = student.degree_program_id,
            supervisor_id = student.supervisor_id,
            status =  student.status
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
        db.commit()
        db.refresh(student)
        return schemas.StudentProfileSchema(
            user_id=student.user_id,
            degree_program_id=student.degree_program_id,
            supervisor_id=student.supervisor_id,
            status=student.status,
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
            raise Exception("Add at least one group member before submitting")
        proposal = models.Proposals(
            submitted_by = current_user.id,
            title = student_input.title,
            status = student_input.status,
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
        )

    @strawberry.mutation(permission_classes=[IsStudent])
    def update_proposal_by_user(self, info: strawberry.Info, student_input: mutation_input.ProposalUpdateInput) -> schemas.ProposalSchemaUser:
        db = info.context["db"]
        current_user = info.context["current_user"]
        proposal = db.query(models.Proposals).filter(
            models.Proposals.id == student_input.id,
            models.Proposals.submitted_by == current_user.id,
        ).first()
        if not proposal:
            raise Exception("Proposal not found")
        if student_input.status.lower() == "submitted" and db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id
        ).count() < 1:
            raise Exception("Add at least one group member before submitting")
        proposal.title = student_input.title
        proposal.status = student_input.status
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
        )

    @strawberry.mutation(permission_classes=[IsStudent])
    def delete_proposal_by_user(self, info: strawberry.Info, student_input: mutation_input.ProposalDeleteInput) -> schemas.ProposalSchemaUser:
        db = info.context["db"]
        current_user = info.context["current_user"]
        proposal = db.query(models.Proposals).filter(
            models.Proposals.id == student_input.id,
            models.Proposals.submitted_by == current_user.id,
        ).first()
        if not proposal:
            raise Exception("Proposal not found")
        supervisor_name = db.query(models.User.name).filter(models.User.id == proposal.supervisor_id).scalar() if proposal.supervisor_id else None
        result = schemas.ProposalSchemaUser(
            id=proposal.id,
            submitted_by=proposal.submitted_by,
            title=proposal.title,
            status=proposal.status,
            supervisor_id=proposal.supervisor_id,
            supervisor_name=supervisor_name,
            group_members=[],
        )
        db.delete(proposal)
        db.commit()
        return result
    
    @strawberry.mutation(permission_classes=[IsDepartmentAdmin])
    def assign_proposal(self, info: strawberry.Info, admin_input: mutation_input.ProposalsReviewInput) -> schemas.ProposalSchemaAdmin:
        db = info.context["db"]

        proposal = db.query(models.Proposals).filter(
            models.Proposals.id == admin_input.proposal_id
        ).first()

        if not proposal:
            raise Exception("Proposal not found")

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
        
        proposal.cluster_id = admin_input.cluster_id
        proposal.supervisor_id = admin_input.supervisor_id
        proposal.status = "assigned"
        # reviewed_by stays untouched here — that gets set later, by the professor's review, not admin's assignment

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
            
        )
    
@strawberry.type
class ProposalCandidateMutation:
    @strawberry.mutation(permission_classes=[IsStudent])
    def create_proposal_candidate(self, info: strawberry.Info, student_input: mutation_input.ProposalCandidatesMutation) -> schemas.ProposalCandidateSchema:
        db = info.context["db"]
        current_user = info.context["current_user"]
        proposal = db.query(models.Proposals).filter(
            models.Proposals.id == student_input.proposal_id,
            models.Proposals.submitted_by == current_user.id,
        ).first()
        member = db.query(models.User).filter(models.User.id == student_input.student_id).first()
        if not proposal:
            raise Exception("Proposal not found")
        if not member or getattr(member.role, "value", member.role) != "student":
            raise Exception("Group member must be a student")
        if member.department_id != current_user.department_id:
            raise Exception("Group member must belong to your department")
        if member.id == current_user.id:
            raise Exception("You are already a member of this proposal")
        if db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id,
            models.ProposalCandidates.student_id == member.id,
        ).first():
            raise Exception("Student is already in this group")
        member_count = db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id
        ).count()
        if member_count >= 2:
            raise Exception("A proposal can have a maximum of 3 students")
        proposal_candidate = models.ProposalCandidates(
            proposal_id = student_input.proposal_id,
            student_id = student_input.student_id
        )    
        
        db.add(proposal_candidate)
        db.commit()
        db.refresh(proposal_candidate)

        return schemas.ProposalCandidateSchema(
            proposal_id = proposal_candidate.proposal_id,
            student_id = proposal_candidate.student_id
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
        if db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id,
            models.ProposalCandidates.student_id == member.id,
        ).first():
            raise Exception("Student is already in this group")
        if db.query(models.ProposalCandidates).filter(
            models.ProposalCandidates.proposal_id == proposal.id
        ).count() >= 2:
            raise Exception("A proposal can have a maximum of 3 students")
        candidate = models.ProposalCandidates(
            proposal_id=proposal.id,
            student_id=member.id,
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        return schemas.ProposalCandidateSchema(
            proposal_id=candidate.proposal_id,
            student_id=candidate.student_id,
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
        )
        db.delete(candidate)
        db.commit()
        return result
        