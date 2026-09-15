import strawberry
from typing import Optional
from datetime import datetime
import uuid


@strawberry.type
class TokenSchema:
    access_token : str
    token_type : str
    role: str
    
@strawberry.type
class TokenData:
    id : Optional[int] = None

@strawberry.type
class UserSchema:
    id: uuid.UUID
    department_id: Optional[uuid.UUID]
    name : str
    email : str
    password : str
    role : str
    created_at: datetime
    
@strawberry.type
class DepartmentSchema:
    id: uuid.UUID
    name : str
    code : str
    created_at: datetime
    
@strawberry.type
class DegreeProgramSchema:
    id: uuid.UUID
    name : str
    level : str
    department_id : uuid.UUID
    
@strawberry.type
class ClusterSchema:
    id: uuid.UUID
    name : str
    department_id: uuid.UUID
    
@strawberry.type
class StudentProfileSchema:
    user_id: uuid.UUID
    degree_program_id: uuid.UUID
    supervisor_id: Optional[uuid.UUID]
    status : str

@strawberry.type
class ProfessorProfileSchema:
    user_id: uuid.UUID
    academic_rank : str
    max_students : int

@strawberry.type
class AdminProfileSchema:
    user_id: uuid.UUID
    user_name: str
    role: str
    department_id: uuid.UUID
    department_name: str
    degree_program_name: Optional[str]
    supervisor_name: Optional[str]
    supervisor_id: Optional[uuid.UUID]
    academic_rank: Optional[str]
    max_students: Optional[int]
    status: Optional[str]
    
    
@strawberry.type
class ProposalSchemaUser:
    id: uuid.UUID
    submitted_by : uuid.UUID
    title : str
    status : str
    supervisor_id: Optional[uuid.UUID]
    supervisor_name: Optional[str]
    group_members: list["ProposalMemberSchema"] = strawberry.field(default_factory=list)

@strawberry.type
class ProposalMemberSchema:
    id: uuid.UUID
    name: str

@strawberry.type
class ProposalSchemaAdmin:
    id : uuid.UUID
    submitted_by: Optional[uuid.UUID]
    submitted_by_name: Optional[str]
    title : str
    status : str
    reviewed_by : Optional[uuid.UUID]
    cluster_id : Optional[uuid.UUID]
    cluster_name: Optional[str]
    supervisor_id : Optional[uuid.UUID]
    supervisor_name: Optional[str]
    group_members: list["ProposalMemberSchema"] = strawberry.field(default_factory=list)

@strawberry.type
class ProposalCandidateSchema:
    proposal_id : uuid.UUID
    student_id : uuid.UUID
    
