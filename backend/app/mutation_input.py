import strawberry
import uuid

from typing import Optional

@strawberry.input
class UserLoginInput:
    email : str
    password : str


# mutation input to create user
@strawberry.input
class UserInput:
    department_id : Optional[uuid.UUID] = None
    name : str
    email : str
    password : str
    role : str

# mutation input to update user
@strawberry.input
class UserUpdateInput:
    id : uuid.UUID
    name : str
    email : str
    password : str
    
# mutation input to delete user
@strawberry.input
class UserDeleteInput:
    id : uuid.UUID
    
# mutation input to create the department
@strawberry.input
class DepartmentCreateInput:
    name : str
    code : str

# mutation input to update the department
@strawberry.input
class DepartmentUpdateInput(DepartmentCreateInput):
    id : uuid.UUID

@strawberry.input
class DepartmentDeleteInput:
    id : uuid.UUID
    
# mutation input to create degree program
@strawberry.input
class DegreeProgramsInput:
    name : str
    level : str
    department_id : uuid.UUID
    
# mutation input to update degree program
@strawberry.input
class DegreeProgramUpdateInput(DegreeProgramsInput):
    id : uuid.UUID
    
# mutation input to delete degree program
@strawberry.input
class DegreeProgramDeleteInput:
    id : uuid.UUID

# mutation input to create cluster
@strawberry.input
class ClusterInput:
    name : str
    department_id : uuid.UUID
    
# mutation input to update cluster
@strawberry.input 
class ClusterUpdateInput(ClusterInput):
    id : uuid.UUID
    
# mutation input to delete cluster
@strawberry.input
class ClusterDeleteInput:
    id : uuid.UUID
    

@strawberry.input
class StudentProfilesInput:
    user_id : uuid.UUID
    degree_program_id : uuid.UUID
    supervisor_id : Optional[uuid.UUID] = None
    status : str

@strawberry.input
class ProfessorProfileInput:
    user_id : uuid.UUID
    academic_rank : str
    max_students : int

@strawberry.input
class StudentProfileUpdateInput:
    user_id : uuid.UUID
    degree_program_id : uuid.UUID
    supervisor_id : Optional[uuid.UUID] = None
    status : str

@strawberry.input
class ProfessorProfileUpdateInput:
    user_id : uuid.UUID
    academic_rank : str
    max_students : int
    
@strawberry.input
class ProposalsInput:
    # submitted_by : uuid.UUID
    title : str
    status : str

@strawberry.input
class ProposalUpdateInput:
    id : uuid.UUID
    title : str
    status : str

@strawberry.input
class ProposalDeleteInput:
    id : uuid.UUID
    
@strawberry.input
class ProposalsReviewInput:
    proposal_id : uuid.UUID
    cluster_id : Optional[uuid.UUID] = None
    supervisor_id : uuid.UUID
    status : str = "assigned"

@strawberry.input
class ProposalCandidatesMutation:
    proposal_id : uuid.UUID
    student_id : uuid.UUID

@strawberry.input
class ProposalMemberDeleteInput:
    proposal_id : uuid.UUID
    student_id : uuid.UUID

@strawberry.input
class AdminProposalMemberInput:
    proposal_id : uuid.UUID
    student_id : uuid.UUID
    
@strawberry.input
class Papers:
    supervisor_id : uuid.UUID
    title : str
    status : str
    