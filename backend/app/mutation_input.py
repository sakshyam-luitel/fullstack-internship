import strawberry
import uuid

from typing import Optional

@strawberry.input
class UserLoginInput:
    email : str
    password : str

@strawberry.input
class UserMutationInput:
    department_id : Optional[uuid.UUID] = None
    name : str
    email : str
    password : str
    role : str
    
@strawberry.input
class DepartmentMutationInput:
    name : str
    code : str
    
@strawberry.input
class DegreeProgramsInput:
    name : str
    level : str
    department_id : uuid.UUID

@strawberry.input
class ClustersInput:
    name : str
    department_id : uuid.UUID
    
@strawberry.input
class StudentProfilesInput:
    user_id : uuid.UUID
    degree_program_id : uuid.UUID
    supervisor_id : uuid.UUID
    status : str

@strawberry.input
class ProfessorProfileInput:
    user_id : uuid.UUID
    academic_rank : str
    max_students : str
    
@strawberry.input
class ProposalsInput:
    # submitted_by : uuid.UUID
    title : str
    status : str
    
@strawberry.input
class ProposalsReviewInput:
    proposal_id : uuid.UUID
    cluster_id : uuid.UUID
    supervisor_id : uuid.UUID
    status : str

@strawberry.input
class ProposalCandidatesMutation:
    proposal_id : uuid.UUID
    student_id : uuid.UUID
    
@strawberry.input
class Papers:
    supervisor_id : uuid.UUID
    title : str
    status : str
    