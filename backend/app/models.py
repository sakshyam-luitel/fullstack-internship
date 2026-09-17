import uuid
from sqlalchemy import String, Uuid, ForeignKey, Column, Boolean, Integer, UniqueConstraint, Time, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql.sqltypes import TIMESTAMP
from sqlalchemy.sql.expression import text
from app.database import Base
from enum import Enum
import strawberry

from sqlalchemy import Enum as SAEnum

@strawberry.enum
class Role( Enum ):
    super_admin = "super_admin"
    admin = "admin"
    student = "student"
    professor = "professor"
    external = "external"


@strawberry.enum
class DegreeLevel( Enum ):
    bachelors = "bachelors"
    masters = "masters"
    phd = "phd"


@strawberry.enum
class PhaseType(Enum):
    proposal = "proposal"
    progress_report = "progress_report"
    defense = "defense"


@strawberry.enum
class SubmissionEntityType(Enum):
    proposal = "proposal"
    progress_report = "progress_report"
    defense = "defense"


@strawberry.enum
class SubmissionStatus(Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


# Proposals intentionally retain a string column for backwards compatibility with
# the existing client, but this enum is the authoritative vocabulary for new code.
@strawberry.enum
class ProposalStatus(Enum):
    draft = "draft"
    submitted = "submitted"
    assigned = "assigned"
    approved = "approved"
    changes_requested = "changes_requested"
    rejected = "rejected"
    withdrawn = "withdrawn"
    completed = "completed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    role:Mapped[Role] = mapped_column(SAEnum(Role) , nullable = False)
    avatar_url = Column(String, nullable=True)
    # Set by the admin at account-creation time for students (bachelor's/master's/PhD
    # program) — StudentProfiles.degree_program_id is auto-populated from this when the
    # profile is created automatically, so it never needs a separate manual step.
    degree_program_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("degreeprograms.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    is_active = Column(Boolean , nullable = False , server_default = text("true"))
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class DegreePrograms(Base):
    __tablename__ = "degreeprograms"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    name = Column(String, nullable=False)
    level: Mapped[DegreeLevel] = mapped_column(SAEnum(DegreeLevel), nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("departments.id"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class Clusters(Base):
    __tablename__ = "clusters"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, nullable=False, default=uuid.uuid4)
    department_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class StudentProfiles(Base):
    __tablename__ = "studentprofile"

    # FIX: this was missing entirely — without it, a profile can't be tied to a User at all.
    # user_id is the primary key since it's a strict one-to-one with users (one profile per student).
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    degree_program_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("degreeprograms.id", ondelete="CASCADE"), nullable=False)
    # FIX: added — every student needs a supervisor (discussed earlier), points back into users.id
    supervisor_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    status = Column(String, nullable=False , server_default = "active")
    # Nullable: a profile can exist (e.g. auto-created on proposal submission) before
    # enrollment issues one. Postgres allows unlimited NULLs under a plain UNIQUE
    # constraint, so uniqueness is only enforced once a value is actually set.
    roll_number = Column(String, nullable=True, unique=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class ProfessorProfiles(Base):
    __tablename__ = "professorprofile"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, primary_key=True)
    academic_rank = Column(String, nullable=False)
    max_students = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True),nullable = False , server_default=text("now()"))


class Proposals(Base):
    __tablename__ = "proposals"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, primary_key=True, default=uuid.uuid4)
    submitted_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=False)
    status = Column(String, nullable=False)
    reviewed_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    review_comment = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    cluster_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clusters.id", ondelete="CASCADE"), nullable=True)
    supervisor_id : Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    # A group member's reply to review_comment when addressing "changes_requested" feedback.
    # Cleared out on the professor's next review so it never shows next to a newer comment.
    student_response = Column(String, nullable=True)
    responded_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    # Soft delete only — status stays "rejected" so the record (and who removed it) stays
    # visible in every student/professor/admin history view instead of disappearing.
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    deleted_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    # Attached document metadata — the file itself lives on disk under file_storage's
    # STORAGE_ROOT; only the relative path and descriptive metadata are stored here.
    file_path = Column(String, nullable=True)
    original_filename = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    content_type = Column(String, nullable=True)
    uploaded_at = Column(TIMESTAMP(timezone=True), nullable=True)
    checksum = Column(String, nullable=True)
    phase_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("researchphases.id", ondelete="SET NULL"), nullable=True)

class ProposalCandidates(Base):
    __tablename__ = "proposalcandidates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    proposal_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # "pending" until the invited student accepts; a rejection deletes the row outright
    # instead of lingering, so the slot is immediately free for the owner to invite someone else.
    status = Column(String, nullable=False, server_default=text("'pending'"))
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))

class Papers(Base):
    __tablename__ = "papers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, primary_key=True, default=uuid.uuid4)
    supervisor_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    proposal_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("proposals.id"), nullable=True)
    # Nullable because a proposal can be (and often is) assigned without a cluster —
    # ProposalsReviewInput.cluster_id is optional, and a Paper mirrors that.
    cluster_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clusters.id"), nullable=True)
    title = Column(String, nullable=False)
    status = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    # Final report — lives on Papers (not its own table) because it needs a
    # professor-approval status that exists *before* a Defenses row can (that
    # table's defense_date is required, so it can't model an unscheduled state).
    final_report_file_path = Column(String, nullable=True)
    final_report_original_filename = Column(String, nullable=True)
    final_report_file_size_bytes = Column(Integer, nullable=True)
    final_report_content_type = Column(String, nullable=True)
    final_report_uploaded_at = Column(TIMESTAMP(timezone=True), nullable=True)
    final_report_checksum = Column(String, nullable=True)
    final_report_status = Column(String, nullable=True)  # null until first submitted
    final_report_review_comment = Column(String, nullable=True)
    final_report_reviewed_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)


class Notifications(Base):
    """In-app message for one recipient. Written by notifications.py."""
    __tablename__ = "notifications"
    __table_args__ = (Index("notifications_user_created_idx", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    # Nullable: phase announcements reach students who don't have a paper yet.
    paper_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("papers.id"), nullable=True)
    phase_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("researchphases.id", ondelete="SET NULL"), nullable=True)
    # Set for defense notifications, so the client can show the defense's own date.
    defense_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("defenses.id", ondelete="SET NULL"), nullable=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False, server_default=text("''"))
    message = Column(String, nullable=False, server_default=text("''"))
    is_read = Column(Boolean, nullable=False, server_default=text("false"))
    is_sent = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class PaperAuthors(Base):
    __tablename__ = "paperauthors"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    author_role = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    paper_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("papers.id"), nullable=False)


class ProgressReports(Base):
    __tablename__ = "progressreports"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    submitted_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")
    submitted_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    # status cycle: draft -> submitted -> approved/rejected/changes_requested,
    # mirroring Proposals' review vocabulary exactly.
    file_path = Column(String, nullable=True)
    original_filename = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    content_type = Column(String, nullable=True)
    uploaded_at = Column(TIMESTAMP(timezone=True), nullable=True)
    checksum = Column(String, nullable=True)
    review_comment = Column(String, nullable=True)
    reviewed_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    phase_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("researchphases.id", ondelete="SET NULL"), nullable=True)


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    progress_report_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("progressreports.id", ondelete="CASCADE"), nullable=False)
    supervisor_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class Deadlines(Base):
    __tablename__ = "deadlines"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    deadline_type = Column(String, nullable=False)
    due_date = Column(TIMESTAMP(timezone=True), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class Defenses(Base):
    """A planned defense of one submission from one research phase.

    Exactly one target is set, matching the phase type: proposal_id for a
    proposal phase, progress_report_id for a progress report phase, or paper_id
    for the final defense (which also takes the final thesis upload).
    """
    __tablename__ = "defenses"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("papers.id", ondelete="CASCADE"), nullable=True)
    proposal_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("proposals.id", ondelete="CASCADE"), nullable=True)
    progress_report_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("progressreports.id", ondelete="CASCADE"), nullable=True)
    defense_date = Column(TIMESTAMP(timezone=True), nullable=False)
    location = Column(String, nullable=True)
    submission_confirmed = Column(Boolean, nullable=False, default=False)
    scheduled_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    # The student's final thesis document — submission_confirmed can only flip to
    # true once this is attached (see confirm_defense_submission in mutations.py).
    file_path = Column(String, nullable=True)
    original_filename = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    content_type = Column(String, nullable=True)
    uploaded_at = Column(TIMESTAMP(timezone=True), nullable=True)
    checksum = Column(String, nullable=True)
    phase_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("researchphases.id", ondelete="SET NULL"), nullable=True)
    # The phase owns the shared calendar day. This is only the individual slot.
    scheduled_time = Column(Time, nullable=True)
    current_status = Column(String, nullable=False, server_default=text("'pending'"))


class JournalSubmissions(Base):
    __tablename__ = "journalsubmissions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False, default="under_review")
    submitted_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    published_at = Column(TIMESTAMP(timezone=True), nullable=True)


class PeerReviews(Base):
    __tablename__ = "peerreviews"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    journal_submission_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("journalsubmissions.id", ondelete="CASCADE"), nullable=False)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    decision = Column(String, nullable=True)
    comments = Column(String, nullable=True)
    reviewed_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class Conferences(Base):
    __tablename__ = "conferences"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    conference_date = Column(TIMESTAMP(timezone=True), nullable=True)
    description = Column(String, nullable=True)


class ConferencePresentations(Base):
    __tablename__ = "conferencepresentations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    conference_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("conferences.id", ondelete="CASCADE"), nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    presenter_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)


class SubmissionWindows(Base):
    """Legacy per-department open/close switches, replaced by ResearchPhase. Nothing
    reads this table any more; the model is kept so create_all and the existing
    migrations stay in agreement."""
    __tablename__ = "submissionwindows"
    __table_args__ = (UniqueConstraint("department_id", "phase", name="submissionwindows_department_phase_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    # "proposal" | "progress_report" | "final_report"
    phase = Column(String, nullable=False)
    # No row for a (department, phase) pair means open — this is what keeps every
    # already-working flow functioning for departments whose admin never touches
    # this feature. due_at alone auto-closes the window once it passes; is_closed
    # lets the admin force it shut earlier than the deadline.
    due_at = Column(TIMESTAMP(timezone=True), nullable=True)
    is_closed = Column(Boolean, nullable=False, default=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class ResearchPhase(Base):
    """An admin-scheduled point in one degree level's research timeline.

    Proposals and progress reports must be created inside an open phase of their
    type; the final report and final thesis belong to the defense phase.
    """
    __tablename__ = "researchphases"
    # Step numbers are unique among phases that haven't been deleted, so a removed
    # phase's number can be reused.
    __table_args__ = (
        Index(
            "researchphases_active_sequence_key", "department_id", "degree_level", "sequence_number",
            unique=True, postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    phase_type: Mapped[PhaseType] = mapped_column(SAEnum(PhaseType), nullable=False)
    degree_level: Mapped[DegreeLevel] = mapped_column(SAEnum(DegreeLevel), nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("departments.id", ondelete="CASCADE"), nullable=True)
    label = Column(String, nullable=False)
    sequence_number = Column(Integer, nullable=False)
    opens_at = Column(TIMESTAMP(timezone=True), nullable=True)
    deadline_at = Column(TIMESTAMP(timezone=True), nullable=True)
    defense_date = Column(TIMESTAMP(timezone=True), nullable=True)
    grace_period_enabled = Column(Boolean, nullable=False, server_default=text("false"))
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    # Soft delete: an ended phase can be removed from every dashboard, while its
    # submissions, history and defenses keep pointing at it.
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    deleted_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)


class SubmissionHistory(Base):
    """Append-only audit log. Entity ids are polymorphic by entity_type."""
    __tablename__ = "submissionhistory"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    entity_type: Mapped[SubmissionEntityType] = mapped_column(SAEnum(SubmissionEntityType), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    phase_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("researchphases.id", ondelete="RESTRICT"), nullable=False)
    submitted_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    status: Mapped[SubmissionStatus] = mapped_column(SAEnum(SubmissionStatus), nullable=False)
    reviewed_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    comments = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    original_filename = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class DefensePanel(Base):
    __tablename__ = "defensepanels"
    __table_args__ = (UniqueConstraint("defense_id", "professor_id", name="defensepanels_defense_professor_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    defense_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("defenses.id", ondelete="CASCADE"), nullable=False)
    # ProfessorProfiles is keyed by the professor's user id.
    professor_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("professorprofile.user_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
