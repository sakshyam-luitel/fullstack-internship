import strawberry
import uuid
import datetime

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
    degree_program_id : Optional[uuid.UUID] = None
    # Students: pick a level instead of a program to use (or create) the department's program at that level.
    degree_level : Optional[str] = None

# mutation input to update user
@strawberry.input
class UserUpdateInput:
    id : uuid.UUID
    name : str
    email : str
    password : str
    degree_program_id : Optional[uuid.UUID] = None
    degree_level : Optional[str] = None

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
    roll_number : Optional[str] = None

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
    roll_number : Optional[str] = None

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
class ProposalReviewDecisionInput:
    proposal_id : uuid.UUID
    status : str
    comment : Optional[str] = None

@strawberry.input
class ProposalFeedbackResponseInput:
    proposal_id : uuid.UUID
    response : str

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
class ProposalInviteResponseInput:
    proposal_id : uuid.UUID
    status : str  # "accepted" or "rejected"

@strawberry.input
class Papers:
    supervisor_id : uuid.UUID
    title : str
    status : str

@strawberry.input
class ProgressReportInput:
    content : str

@strawberry.input
class ProgressReportIdInput:
    id : uuid.UUID
    # Lets a resubmission after "changes_requested" update the summary too.
    content : Optional[str] = None

@strawberry.input
class ScheduleDefenseInput:
    # Exactly one: the proposal, progress report, or paper (final defense) being defended.
    proposal_id : Optional[uuid.UUID] = None
    progress_report_id : Optional[uuid.UUID] = None
    paper_id : Optional[uuid.UUID] = None
    # Defaults to the submission's own phase (for a final defense, the level's defense phase).
    phase_id : Optional[uuid.UUID] = None
    # Required, except for a final defense whose phase has a shared defense day.
    defense_date : Optional[datetime.datetime] = None
    scheduled_time : datetime.time
    location : Optional[str] = None
    # The whole panel; omit to leave the current panel unchanged.
    panel_professor_ids : Optional[list[uuid.UUID]] = None

@strawberry.input
class DefenseIdInput:
    id : uuid.UUID

@strawberry.input
class DefensePanelInput:
    defense_id: uuid.UUID
    professor_id: uuid.UUID

@strawberry.input
class DefenseOutcomeInput:
    defense_id: uuid.UUID
    status: str  # "accepted" | "rejected"
    comments: Optional[str] = None

@strawberry.input
class ResearchPhaseInput:
    phase_type: str  # proposal | progress_report | defense
    degree_level: str  # bachelors | masters | phd
    label: str
    sequence_number: int
    opens_at: Optional[datetime.datetime] = None
    deadline_at: Optional[datetime.datetime] = None
    defense_date: Optional[datetime.datetime] = None
    grace_period_enabled: bool = False

@strawberry.input
class ResearchPhaseUpdateInput:
    id: uuid.UUID
    label: Optional[str] = None
    sequence_number: Optional[int] = None
    opens_at: Optional[datetime.datetime] = None
    deadline_at: Optional[datetime.datetime] = None
    defense_date: Optional[datetime.datetime] = None
    grace_period_enabled: Optional[bool] = None

@strawberry.input
class ResearchPhaseDeleteInput:
    id: uuid.UUID

@strawberry.input
class MarkNotificationsReadInput:
    # Omit to mark every notification of the signed-in user as read.
    ids: Optional[list[uuid.UUID]] = None

@strawberry.input
class ProgressReportReviewInput:
    id : uuid.UUID
    status : str  # "approved" | "rejected" | "changes_requested"
    comment : Optional[str] = None

@strawberry.input
class FinalReportReviewInput:
    paper_id : uuid.UUID
    status : str  # "approved" | "rejected" | "changes_requested"
    comment : Optional[str] = None
