import strawberry
from typing import Optional
from datetime import datetime, time
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
    avatar_url: Optional[str] = None
    degree_program_id: Optional[uuid.UUID] = None
    # Students only: bachelors | masters | phd, from their account or student profile.
    degree_level: Optional[str] = None

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
    roll_number: Optional[str] = None

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
    roll_number: Optional[str] = None
    degree_level: Optional[str] = None


@strawberry.type
class ProposalSchemaUser:
    id: uuid.UUID
    submitted_by : uuid.UUID
    title : str
    status : str
    supervisor_id: Optional[uuid.UUID]
    supervisor_name: Optional[str]
    group_members: list["ProposalMemberSchema"] = strawberry.field(default_factory=list)
    review_comment: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    submitted_by_name: Optional[str] = None
    student_response: Optional[str] = None
    responded_by_name: Optional[str] = None
    deleted_at: Optional[datetime] = None
    deleted_by_name: Optional[str] = None
    original_filename: Optional[str] = None
    file_size_bytes: Optional[int] = None
    uploaded_at: Optional[datetime] = None
    phase_id: Optional[uuid.UUID] = None

@strawberry.type
class ProposalMemberSchema:
    id: uuid.UUID
    name: str
    status: str

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
    review_comment: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    student_response: Optional[str] = None
    responded_by_name: Optional[str] = None
    deleted_at: Optional[datetime] = None
    deleted_by_name: Optional[str] = None
    original_filename: Optional[str] = None
    file_size_bytes: Optional[int] = None
    uploaded_at: Optional[datetime] = None
    phase_id: Optional[uuid.UUID] = None
    degree_level: Optional[str] = None

@strawberry.type
class ProposalCandidateSchema:
    proposal_id : uuid.UUID
    student_id : uuid.UUID
    status : str

@strawberry.type
class ProposalInviteSchema:
    proposal_id: uuid.UUID
    title: str
    owner_id: uuid.UUID
    owner_name: str
    status: str

@strawberry.type
class PaperSchema:
    id: uuid.UUID
    proposal_id: Optional[uuid.UUID]
    title: str
    status: str
    supervisor_id: uuid.UUID
    supervisor_name: Optional[str] = None
    cluster_id: Optional[uuid.UUID] = None
    cluster_name: Optional[str] = None
    final_report_status: Optional[str] = None
    final_report_review_comment: Optional[str] = None
    final_report_reviewed_by_name: Optional[str] = None
    final_report_original_filename: Optional[str] = None
    final_report_file_size_bytes: Optional[int] = None
    final_report_uploaded_at: Optional[datetime] = None
    degree_level: Optional[str] = None

@strawberry.type
class ProgressReportSchema:
    id: uuid.UUID
    paper_id: uuid.UUID
    submitted_by: uuid.UUID
    submitted_by_name: Optional[str] = None
    content: str
    status: str
    submitted_at: datetime
    original_filename: Optional[str] = None
    file_size_bytes: Optional[int] = None
    uploaded_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    phase_id: Optional[uuid.UUID] = None
    phase_label: Optional[str] = None
    deadline_at: Optional[datetime] = None

@strawberry.type
class DefenseSchema:
    id: uuid.UUID
    paper_id: Optional[uuid.UUID]
    defense_date: datetime
    location: Optional[str]
    submission_confirmed: bool
    scheduled_by: uuid.UUID
    scheduled_by_name: Optional[str] = None
    original_filename: Optional[str] = None
    file_size_bytes: Optional[int] = None
    uploaded_at: Optional[datetime] = None
    paper_title: Optional[str] = None
    phase_id: Optional[uuid.UUID] = None
    scheduled_time: Optional[time] = None
    current_status: str = "pending"
    phase_label: Optional[str] = None
    # What is being defended: exactly one of proposal_id, progress_report_id or paper_id (final).
    proposal_id: Optional[uuid.UUID] = None
    progress_report_id: Optional[uuid.UUID] = None
    kind: str = "defense"  # "proposal" | "progress_report" | "defense"
    degree_level: Optional[str] = None
    student_names: list[str] = strawberry.field(default_factory=list)
    supervisor_name: Optional[str] = None
    panel_names: list[str] = strawberry.field(default_factory=list)
    panel_professor_ids: list[uuid.UUID] = strawberry.field(default_factory=list)
    # The report being defended, for "view report" links: files route kind, entity id, file name.
    report_document_kind: Optional[str] = None  # "proposals" | "progress-reports" | "papers"
    report_document_id: Optional[uuid.UUID] = None
    report_filename: Optional[str] = None

@strawberry.type
class DefenseCandidateSchema:
    """A submitted proposal, progress report or approved final report that can be defended."""
    kind: str  # "proposal" | "progress_report" | "defense"
    target_id: uuid.UUID
    title: str
    status: str
    student_names: list[str]
    supervisor_name: Optional[str]
    phase_id: Optional[uuid.UUID] = None
    phase_label: Optional[str] = None
    # A final defense defaults to its phase's shared day.
    suggested_date: Optional[datetime] = None
    report_filename: Optional[str] = None
    defense: Optional[DefenseSchema] = None

@strawberry.type
class ResearchPhaseSchema:
    id: uuid.UUID
    phase_type: str
    degree_level: str
    department_id: Optional[uuid.UUID]
    label: str
    sequence_number: int
    opens_at: Optional[datetime]
    deadline_at: Optional[datetime]
    defense_date: Optional[datetime]
    grace_period_enabled: bool
    created_by: uuid.UUID
    created_at: datetime
    is_open: bool
    # True once the deadline (or, for a final defense phase, the defense day) has passed.
    has_ended: bool = False
    # Only set by create/update, so the admin can see how many people were told.
    notified_count: Optional[int] = None

@strawberry.type
class NotificationSchema:
    id: uuid.UUID
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime
    paper_id: Optional[uuid.UUID]
    phase_id: Optional[uuid.UUID]
    phase_label: Optional[str]
    phase_type: Optional[str]
    opens_at: Optional[datetime]
    deadline_at: Optional[datetime]
    defense_date: Optional[datetime]

@strawberry.type
class SubmissionHistorySchema:
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    phase_id: uuid.UUID
    phase_label: Optional[str]
    submitted_by: uuid.UUID
    submitted_by_name: Optional[str]
    status: str
    reviewed_by: Optional[uuid.UUID]
    reviewed_by_name: Optional[str]
    comments: Optional[str]
    original_filename: Optional[str]
    created_at: datetime

@strawberry.type
class DefensePanelSchema:
    id: uuid.UUID
    defense_id: uuid.UUID
    professor_id: uuid.UUID
    professor_name: Optional[str]
    created_at: datetime

@strawberry.type
class MyProfileSchema:
    name: str
    email: str
    avatar_url: Optional[str]
    department_name: Optional[str]
    degree_program_name: Optional[str]
    supervisor_name: Optional[str]
    status: Optional[str]
    academic_rank: Optional[str] = None
    max_students: Optional[int] = None
    roll_number: Optional[str] = None
    # Students only: bachelors | masters | phd. Only Bachelor's proposals are group work.
    degree_level: Optional[str] = None

