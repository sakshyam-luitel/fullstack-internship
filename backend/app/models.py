import uuid
from sqlalchemy import String, Uuid, ForeignKey, Column, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql.sqltypes import TIMESTAMP
from sqlalchemy.sql.expression import text
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    department_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class DegreePrograms(Base):
    __tablename__ = "degreeprograms"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    name = Column(String, nullable=False)
    level = Column(String, nullable=False)
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
    status = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class ProfessorProfiles(Base):
    __tablename__ = "professorprofile"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, primary_key=True)
    academic_rank = Column(String, nullable=False)
    max_students = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class Proposals(Base):
    __tablename__ = "proposals"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, primary_key=True, default=uuid.uuid4)
    submitted_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    status = Column(String, nullable=False)
    reviewed_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    cluster_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clusters.id", ondelete="CASCADE"), nullable=True)


class Papers(Base):
    __tablename__ = "papers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, primary_key=True, default=uuid.uuid4)
    supervisor_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    proposal_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("proposals.id"), nullable=True)
    cluster_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clusters.id"), nullable=False)
    title = Column(String, nullable=False)
    status = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


class Notifications(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("papers.id"), nullable=False)
    type = Column(String, nullable=False)
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
    __tablename__ = "defenses"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4, nullable=False)
    paper_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    defense_date = Column(TIMESTAMP(timezone=True), nullable=False)
    location = Column(String, nullable=True)
    submission_confirmed = Column(Boolean, nullable=False, default=False)
    scheduled_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))


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