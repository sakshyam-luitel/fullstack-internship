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
    status : str

@strawberry.input
class ProfessorProfileInput:
    academic_rank : str
    max_students : str
    
@strawberry.input
class ProposalsInput:
    status : str
    
@strawberry.input
class Papers:
    supervisor_id : uuid.UUID
    title : str
    status : str
    