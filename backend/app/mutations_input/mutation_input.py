import strawberry
from sqlalchemy import Uuid
from pydantic import EmailStr

@strawberry.input
class UserMutationInput:
    name : str
    email : EmailStr
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

@strawberry.input
class ClustersInput:
    name : str
    
@strawberry.input
class StudentProfilesInput:
    status : str

@strawberry.input
class ProfessorProfileInput:
    academic_rank : str
    max_students : str
    
    