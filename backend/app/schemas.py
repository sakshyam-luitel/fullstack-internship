import strawberry
from typing import Optional
    
import uuid


@strawberry.type
class TokenSchema:
    access_token : str
    token_type : str
    
@strawberry.type
class TokenData:
    id : Optional[int] = None

@strawberry.type
class UserSchema:
    name : str
    email : str
    department_id : uuid.UUID
    role : str
    
@strawberry.type
class DepartmentSchema:
    name : str
    code : str
    
@strawberry.type
class DegreeProgramsSchema:
    name : str
    level : str
    # department_id : uuid.UUID
    
@strawberry.type
class ClustersSchema:
    name : str
    
@strawberry.type
class StudentProfileSchema:
    status : str

@strawberry.type
class ProfessorProfileSchema:
    academic_rank : str
    max_students : int
    
    
@strawberry.type
class ProposalSchemaUser:
    submitted_by : uuid.UUID
    title : str
    status : str

@strawberry.type
class ProposalSchemaAdmin:
    id : uuid.UUID
    title : str
    status : str
    reviewed_by : uuid.UUID
    cluster_id : uuid.UUID
    supervisor_id : uuid.UUID

@strawberry.type
class ProposalCandidatesSchema:
    proposal_id : uuid.UUID
    student_id : uuid.UUID
    
