from pathlib import Path

from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads"
AVATAR_DIR = UPLOAD_ROOT / "avatars"
ALLOWED_AVATAR_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
MAX_AVATAR_BYTES = 5 * 1024 * 1024


async def save_avatar_image(user_id, upload) -> str:
    """Validate and persist a profile-image upload, returning its public /uploads URL.
    The filename is derived from user_id (never the client-supplied name) so a new
    upload simply replaces the previous avatar and no path can be injected."""
    extension = ALLOWED_AVATAR_TYPES.get(upload.content_type)
    if not extension:
        raise Exception("Only PNG, JPEG, GIF, or WEBP images are allowed")

    data = await upload.read()
    if len(data) > MAX_AVATAR_BYTES:
        raise Exception("Image must be smaller than 5MB")

    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{user_id}{extension}"
    (AVATAR_DIR / filename).write_bytes(data)
    return f"/uploads/avatars/{filename}"

def verify_password(plain_password , hashed_password):
    return password_hash.verify(plain_password , hashed_password)

def get_password_hash(password):
    return password_hash.hash(password)

def is_accepted_group_member(db, proposal_id, user_id) -> bool:
    """Whether user_id is an accepted (not merely pending) member of a proposal's
    group — used to let any teammate act on a shared proposal, not just its owner."""
    from . import models

    return db.query(models.ProposalCandidates).filter(
        models.ProposalCandidates.proposal_id == proposal_id,
        models.ProposalCandidates.student_id == user_id,
        models.ProposalCandidates.status == "accepted",
    ).first() is not None


def proposal_group_member_users(db, proposal):
    """Owner + every accepted group member of a proposal, as User rows — the students
    whose profile should exist once the proposal is submitted, and whose supervisor
    should update once the proposal is assigned."""
    from . import models

    owner = db.query(models.User).filter(models.User.id == proposal.submitted_by).first()
    members = (
        db.query(models.User)
        .join(models.ProposalCandidates, models.ProposalCandidates.student_id == models.User.id)
        .filter(
            models.ProposalCandidates.proposal_id == proposal.id,
            models.ProposalCandidates.status == "accepted",
        )
        .all()
    )
    return [user for user in [owner, *members] if user is not None]


def ensure_student_profile(db, user, supervisor_id=None):
    """Create the student's profile automatically — using the degree program chosen
    when their account was created — the first time it's needed (on proposal
    submission), or update its supervisor once one is assigned. Idempotent: safe to
    call every time a proposal is submitted or assigned."""
    from . import models

    profile = db.query(models.StudentProfiles).filter(models.StudentProfiles.user_id == user.id).first()
    if profile:
        if supervisor_id is not None:
            profile.supervisor_id = supervisor_id
        return profile

    if not user.degree_program_id:
        raise Exception(f"{user.name} has no degree program on file — ask an admin to set one first")

    profile = models.StudentProfiles(
        user_id=user.id,
        degree_program_id=user.degree_program_id,
        supervisor_id=supervisor_id,
        status="active",
    )
    db.add(profile)
    return profile


def ensure_paper_for_proposal(db, proposal):
    """Create the Paper that a proposal graduates into once a professor approves it
    — the schema's Proposals -> Papers pipeline had no mutation actually crossing
    that bridge, so review_proposal calls this the moment status becomes "approved".
    Idempotent: a proposal that's reviewed again reuses its existing Paper."""
    from . import models

    paper = db.query(models.Papers).filter(models.Papers.proposal_id == proposal.id).first()
    if paper:
        return paper

    paper = models.Papers(
        supervisor_id=proposal.supervisor_id,
        proposal_id=proposal.id,
        cluster_id=proposal.cluster_id,
        title=proposal.title,
        status="in_progress",
    )
    db.add(paper)
    db.flush()
    return paper


def find_my_paper(db, user):
    """The Paper belonging to user's own proposal (as owner or accepted group
    member) — a student only ever has one active one, since committed_student_ids
    keeps them out of a second proposal group while one is active. Papers whose
    proposal was later rejected or deleted are ignored."""
    from . import models

    paper = (
        db.query(models.Papers)
        .join(models.Proposals, models.Papers.proposal_id == models.Proposals.id)
        .filter(models.Proposals.submitted_by == user.id, *active_proposal_filter(models))
        .first()
    )
    if paper:
        return paper

    member_proposal_ids = db.query(models.ProposalCandidates.proposal_id).filter(
        models.ProposalCandidates.student_id == user.id,
        models.ProposalCandidates.status == "accepted",
    )
    return (
        db.query(models.Papers)
        .join(models.Proposals, models.Papers.proposal_id == models.Proposals.id)
        .filter(models.Papers.proposal_id.in_(member_proposal_ids), *active_proposal_filter(models))
        .first()
    )


def is_paper_participant(db, paper, user_id) -> bool:
    """Whether user_id is the student who owns the paper's originating proposal, or
    one of its accepted group members — the people who may submit progress reports
    and the final defense document for this paper."""
    from . import models

    if not paper.proposal_id:
        return False
    proposal = db.query(models.Proposals).filter(models.Proposals.id == paper.proposal_id).first()
    if not proposal:
        return False
    return proposal.submitted_by == user_id or is_accepted_group_member(db, proposal.id, user_id)


INACTIVE_PROPOSAL_STATUSES = ("rejected", "withdrawn")


def active_proposal_filter(models):
    """Proposals that still tie their students up: not rejected, withdrawn or deleted."""
    return (
        models.Proposals.status.notin_(INACTIVE_PROPOSAL_STATUSES),
        models.Proposals.deleted_at.is_(None),
    )


def committed_student_ids(db, exclude_proposal_id=None):
    """Students who already own or belong to an active proposal group, so they can't
    be picked for a second one. A rejected, withdrawn or deleted proposal frees its
    students to start again. exclude_proposal_id lets a proposal's own current
    members stay excludable from consideration for that same proposal."""
    from . import models

    submitted_by_query = db.query(models.Proposals.submitted_by).filter(
        models.Proposals.submitted_by.isnot(None),
        *active_proposal_filter(models),
    )
    candidates_query = (
        db.query(models.ProposalCandidates.student_id)
        .join(models.Proposals, models.ProposalCandidates.proposal_id == models.Proposals.id)
        .filter(*active_proposal_filter(models))
    )
    if exclude_proposal_id is not None:
        submitted_by_query = submitted_by_query.filter(models.Proposals.id != exclude_proposal_id)
        candidates_query = candidates_query.filter(
            models.ProposalCandidates.proposal_id != exclude_proposal_id
        )
    return {row[0] for row in submitted_by_query.all()} | {row[0] for row in candidates_query.all()}


def _student_proposals_query(db, user_id):
    """Proposals a student owns or has accepted a place in."""
    from sqlalchemy import or_
    from . import models

    joined = db.query(models.ProposalCandidates.proposal_id).filter(
        models.ProposalCandidates.student_id == user_id,
        models.ProposalCandidates.status == "accepted",
    )
    return db.query(models.Proposals).filter(
        or_(models.Proposals.submitted_by == user_id, models.Proposals.id.in_(joined))
    )


def has_active_proposal(db, user_id) -> bool:
    from . import models

    return _student_proposals_query(db, user_id).filter(*active_proposal_filter(models)).first() is not None


def rejected_proposals(db, user_id):
    from . import models

    return _student_proposals_query(db, user_id).filter(models.Proposals.status == "rejected").all()