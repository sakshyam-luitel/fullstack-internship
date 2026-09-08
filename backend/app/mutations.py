import strawberry
from sqlalchemy import Uuid
from . import mutation_input
from . import schemas
from . import models
from . utils import get_password_hash
from . permissions import IsAdmin , IsStudent

@strawberry.type
class UserMutation:
    @strawberry.mutation(permission_classes=[IsAdmin])
    def create_user(self , info : strawberry.Info , admin_input : mutation_input.UserMutationInput ) -> schemas.UserSchema:
        db = info.context.get("db")
        hashed_password = get_password_hash(admin_input.password)
        user = models.User(
            department_id = admin_input.department_id,
            name = admin_input.name,
            email = admin_input.email,
            password = hashed_password,
            role = admin_input.role
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
    

@strawberry.type
class DepartmentMutation:
    @strawberry.mutation(permission_classes=[IsAdmin])
    def create_departments(self, info : strawberry.Info , admin_input : mutation_input.DepartmentMutationInput) -> schemas.DepartmentSchema:
        db = info.context["db"]
        department = models.Department(
            name = admin_input.name,
            code = admin_input.code
        )
        
        db.add(department)
        db.commit()
        db.refresh(department)

        return schemas.DepartmentSchema(
            name = department.name,
            code = department.code
        )
    
@strawberry.type
class DegreeProgramsMutation:
    @strawberry.mutation(permission_classes=[IsAdmin])
    def create_degree_programs(self , info : strawberry.Info , admin_input : mutation_input.DegreeProgramsInput) -> schemas.DegreeProgramsSchema:
        db = info.context["db"]
        degree_program = models.DegreePrograms(
            name = admin_input.name,
            level = admin_input.level,
            department_id = admin_input.department_id
        )
        
        db.add(degree_program)
        db.commit()
        db.refresh(degree_program)

        return schemas.DegreeProgramsSchema(
            name = degree_program.name,
            level = degree_program.level
        )
        
@strawberry.type
class ClustersMutation:
    @strawberry.mutation(permission_classes=[IsAdmin])
    def create_clusters(self , info : strawberry.Info , admin_input : mutation_input.ClustersInput) -> schemas.ClustersSchema:
        db = info.context["db"]
        cluster = models.Clusters(
            department_id = admin_input.department_id,
            name = admin_input.name
        )
        
        db.add(cluster)
        db.commit()
        db.refresh(cluster)

        return schemas.ClustersSchema(
            name = cluster.name
        )
        
@strawberry.type
class StudentProfilesMutation:
    @strawberry.mutation(permission_classes = [IsAdmin])
    def create_student_profile(self , info : strawberry.Info , admin_input : mutation_input.StudentProfilesInput) -> schemas.StudentProfileSchema:
        db = info.context["db"]
        
        student = models.StudentProfiles(
            user_id = admin_input.user_id,
            degree_program_id = admin_input.degree_program_id,
            supervisor_id = admin_input.supervisor_id,
            status = admin_input.status
        )
        
        db.add(student)
        db.commit()
        db.refresh(student)

        return schemas.StudentProfileSchema(
            status =  student.status
        )
        
@strawberry.type
class ProfessorProfileMutation:
    @strawberry.mutation(permission_classes = [IsAdmin])
    def create_professor_profile(self , info : strawberry.Info , admin_input : mutation_input.ProfessorProfileInput) -> schemas.ProfessorProfileSchema:
        db = info.context["db"]
        professor = models.ProfessorProfiles(
            user_id = admin_input.user_id,
            academic_rank = admin_input.academic_rank,
            max_students = admin_input.max_students
        )
        
        db.add(professor)
        db.commit()
        db.refresh(professor)

        return schemas.ProfessorProfileSchema(
            academic_rank = professor.academic_rank,
            max_student = professor.max_students
        )
        
@strawberry.type
class ProposalsMutation:
    @strawberry.mutation(permission_classes=[IsStudent])
    def create_proposal_by_user(self , info : strawberry.Info , student_input : mutation_input.ProposalsInput) -> schemas.ProposalSchemaUser:
        db = info.context["db"]
        current_user = info.context["current_user"]
        proposal = models.Proposals(
            submitted_by = current_user.id,
            title = student_input.title,
            status = student_input.status,
        )
        
        db.add(proposal)
        db.commit()
        db.refresh(proposal)

        return schemas.ProposalSchemaUser(
            submitted_by = proposal.submitted_by,
            title = proposal.title,
            status = proposal.status,
        )
    
    @strawberry.mutation(permission_classes=[IsAdmin])
    def assign_proposal(self, info: strawberry.Info, admin_input: mutation_input.ProposalsReviewInput) -> schemas.ProposalSchemaAdmin:
        db = info.context["db"]

        proposal = db.query(models.Proposals).filter(
            models.Proposals.id == admin_input.proposal_id
        ).first()

        if not proposal:
            raise Exception("Proposal not found")
        
        proposal.cluster_id = admin_input.cluster_id
        proposal.supervisor_id = admin_input.supervisor_id
        proposal.status = "assigned"
        # reviewed_by stays untouched here — that gets set later, by the professor's review, not admin's assignment

        db.commit()
        db.refresh(proposal)

        return schemas.ProposalSchemaAdmin(
            id=proposal.id,
            title = proposal.title,
            status=proposal.status,
            reviewed_by = proposal.reviewed_by,
            cluster_id=proposal.cluster_id,
            supervisor_id=proposal.supervisor_id,
            
        )
    
@strawberry.type
class ProposalCandidateMutation:
    @strawberry.mutation
    def create_proposal_candidate(self , info : strawberry.Info , student_input: mutation_input.ProposalCandidatesMutation) -> schemas.ProposalCandidatesSchema:
        db = info.context["db"]
        proposal_candidate = models.ProposalCandidates(
            proposal_id = student_input.proposal_id,
            student_id = student_input.student_id
        )    
        
        db.add(proposal_candidate)
        db.commit()
        db.refresh(proposal_candidate)

        return schemas.ProposalCandidatesSchema(
            proposal_id = proposal_candidate.proposal_id,
            student_id = proposal_candidate.student_id
        )
        