"""Plain REST routes for proposal PDF upload/download — a deliberate,
documented exception to the single-GraphQL-endpoint rule in CLAUDE.md, since
GraphQL doesn't carry binary payloads well. Mounted alongside the
GraphQLRouter in main.py, authenticated with the same JWT as everything else
via oauth2.get_current_user_rest (not a separate auth path).
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from . import file_storage, models
from .database import get_db
from .oauth2 import get_current_user_rest
from .defenses import is_panel_member
from .utils import is_accepted_group_member, is_paper_participant

router = APIRouter(prefix="/files")


def _set_file_metadata(entity, metadata: dict) -> None:
    entity.file_path = metadata["file_path"]
    entity.original_filename = metadata["original_filename"]
    entity.file_size_bytes = metadata["file_size_bytes"]
    entity.content_type = metadata["content_type"]
    entity.checksum = metadata["checksum"]
    entity.uploaded_at = datetime.now(timezone.utc)


def _commit_upload_or_rollback(db: Session, metadata: dict) -> None:
    try:
        db.commit()
    except Exception:
        db.rollback()
        file_storage.delete_document(metadata["file_path"])
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to save the upload")


def _file_metadata_response(entity) -> dict:
    return {
        "originalFilename": entity.original_filename,
        "fileSizeBytes": entity.file_size_bytes,
        "contentType": entity.content_type,
        "uploadedAt": entity.uploaded_at.isoformat(),
    }


def _download_response(entity, default_filename: str) -> FileResponse:
    if not entity.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No document has been uploaded")
    path = file_storage.resolve_document_path(entity.file_path)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file is missing on the server")
    return FileResponse(
        path,
        media_type=entity.content_type or "application/pdf",
        filename=entity.original_filename or default_filename,
    )


def _get_proposal_or_404(db: Session, proposal_id: uuid.UUID, *, allow_deleted: bool = False) -> models.Proposals:
    proposal = db.query(models.Proposals).filter(models.Proposals.id == proposal_id).first()
    if not proposal or (proposal.deleted_at is not None and not allow_deleted):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    return proposal


def _can_edit_proposal_file(db: Session, proposal: models.Proposals, user: models.User) -> bool:
    return proposal.submitted_by == user.id or is_accepted_group_member(db, proposal.id, user.id)


def _can_view_proposal_file(db: Session, proposal: models.Proposals, user: models.User) -> bool:
    role = getattr(user.role, "value", user.role)
    if _can_edit_proposal_file(db, proposal, user):
        return True
    if proposal.supervisor_id == user.id or is_panel_member(db, user.id, proposal_id=proposal.id):
        return True
    if role in {"admin", "super_admin"}:
        student = db.query(models.User).filter(models.User.id == proposal.submitted_by).first()
        return role == "super_admin" or (student is not None and student.department_id == user.department_id)
    return False


@router.post("/proposals/{proposal_id}")
async def upload_proposal_file(
    proposal_id: uuid.UUID,
    file: UploadFile,
    current_user: models.User = Depends(get_current_user_rest),
    db: Session = Depends(get_db),
):
    proposal = _get_proposal_or_404(db, proposal_id)
    if not _can_edit_proposal_file(db, proposal, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can't upload a document for this proposal")
    if proposal.status not in {"draft", "changes_requested"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The proposal document can only be changed while it's a draft or has requested changes")

    data = await file.read()
    try:
        metadata = file_storage.save_document("proposals", proposal_id, data, file.filename, file.content_type)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))

    _set_file_metadata(proposal, metadata)
    _commit_upload_or_rollback(db, metadata)
    return _file_metadata_response(proposal)


@router.get("/proposals/{proposal_id}")
async def download_proposal_file(
    proposal_id: uuid.UUID,
    current_user: models.User = Depends(get_current_user_rest),
    db: Session = Depends(get_db),
):
    # A deleted proposal's own document stays viewable — soft delete keeps the whole
    # record in student/professor/admin history, not just the metadata around it.
    proposal = _get_proposal_or_404(db, proposal_id, allow_deleted=True)
    if not _can_view_proposal_file(db, proposal, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can't view this proposal's document")
    return _download_response(proposal, "proposal.pdf")


def _get_paper_or_404(db: Session, paper_id: uuid.UUID) -> models.Papers:
    paper = db.query(models.Papers).filter(models.Papers.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")
    return paper


def _department_admin_can_view_paper(db: Session, paper: models.Papers, user: models.User) -> bool:
    role = getattr(user.role, "value", user.role)
    if role == "super_admin":
        return True
    if role != "admin":
        return False
    supervisor = db.query(models.User).filter(models.User.id == paper.supervisor_id).first()
    return supervisor is not None and supervisor.department_id == user.department_id


def _get_progress_report_or_404(db: Session, report_id: uuid.UUID) -> models.ProgressReports:
    report = db.query(models.ProgressReports).filter(models.ProgressReports.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Progress report not found")
    return report


@router.post("/progress-reports/{report_id}")
async def upload_progress_report_file(
    report_id: uuid.UUID,
    file: UploadFile,
    current_user: models.User = Depends(get_current_user_rest),
    db: Session = Depends(get_db),
):
    report = _get_progress_report_or_404(db, report_id)
    paper = _get_paper_or_404(db, report.paper_id)
    if not is_paper_participant(db, paper, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can't upload a document for this progress report")
    if report.status not in {"draft", "changes_requested"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This progress report has already been submitted")

    data = await file.read()
    try:
        metadata = file_storage.save_document("progress-reports", report_id, data, file.filename, file.content_type)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))

    _set_file_metadata(report, metadata)
    _commit_upload_or_rollback(db, metadata)
    return _file_metadata_response(report)


@router.get("/progress-reports/{report_id}")
async def download_progress_report_file(
    report_id: uuid.UUID,
    current_user: models.User = Depends(get_current_user_rest),
    db: Session = Depends(get_db),
):
    report = _get_progress_report_or_404(db, report_id)
    paper = _get_paper_or_404(db, report.paper_id)
    can_view = (
        is_paper_participant(db, paper, current_user.id)
        or paper.supervisor_id == current_user.id
        or is_panel_member(db, current_user.id, progress_report_id=report.id)
        or _department_admin_can_view_paper(db, paper, current_user)
    )
    if not can_view:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can't view this progress report's document")
    return _download_response(report, "progress-report.pdf")


def _get_defense_or_404(db: Session, defense_id: uuid.UUID) -> models.Defenses:
    defense = db.query(models.Defenses).filter(models.Defenses.id == defense_id).first()
    if not defense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Defense not found")
    return defense


@router.post("/defenses/{defense_id}")
async def upload_defense_file(
    defense_id: uuid.UUID,
    file: UploadFile,
    current_user: models.User = Depends(get_current_user_rest),
    db: Session = Depends(get_db),
):
    defense = _get_defense_or_404(db, defense_id)
    if not defense.paper_id or defense.proposal_id or defense.progress_report_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only a final defense takes a thesis upload")
    paper = _get_paper_or_404(db, defense.paper_id)
    if not is_paper_participant(db, paper, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can't upload a document for this defense")
    if defense.submission_confirmed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Your final thesis has already been submitted")

    data = await file.read()
    try:
        metadata = file_storage.save_document("defenses", defense_id, data, file.filename, file.content_type)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))

    _set_file_metadata(defense, metadata)
    _commit_upload_or_rollback(db, metadata)
    return _file_metadata_response(defense)


@router.get("/defenses/{defense_id}")
async def download_defense_file(
    defense_id: uuid.UUID,
    current_user: models.User = Depends(get_current_user_rest),
    db: Session = Depends(get_db),
):
    defense = _get_defense_or_404(db, defense_id)
    if not defense.file_path or not defense.paper_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This defense has no thesis document")
    paper = _get_paper_or_404(db, defense.paper_id)
    can_view = (
        is_paper_participant(db, paper, current_user.id)
        or paper.supervisor_id == current_user.id
        or is_panel_member(db, current_user.id, id=defense.id)
        or _department_admin_can_view_paper(db, paper, current_user)
    )
    if not can_view:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can't view this defense's document")
    return _download_response(defense, "final-thesis.pdf")


class _FinalReportFileProxy:
    """Adapts Papers.final_report_* columns to the plain file_path/... names
    _set_file_metadata/_download_response expect, so the final report reuses
    those helpers instead of a fourth near-duplicate set of upload/download code."""

    def __init__(self, paper: models.Papers):
        self._paper = paper

    @property
    def file_path(self):
        return self._paper.final_report_file_path

    @file_path.setter
    def file_path(self, value):
        self._paper.final_report_file_path = value

    @property
    def original_filename(self):
        return self._paper.final_report_original_filename

    @original_filename.setter
    def original_filename(self, value):
        self._paper.final_report_original_filename = value

    @property
    def file_size_bytes(self):
        return self._paper.final_report_file_size_bytes

    @file_size_bytes.setter
    def file_size_bytes(self, value):
        self._paper.final_report_file_size_bytes = value

    @property
    def content_type(self):
        return self._paper.final_report_content_type

    @content_type.setter
    def content_type(self, value):
        self._paper.final_report_content_type = value

    @property
    def checksum(self):
        return self._paper.final_report_checksum

    @checksum.setter
    def checksum(self, value):
        self._paper.final_report_checksum = value

    @property
    def uploaded_at(self):
        return self._paper.final_report_uploaded_at

    @uploaded_at.setter
    def uploaded_at(self, value):
        self._paper.final_report_uploaded_at = value


@router.post("/papers/{paper_id}")
async def upload_final_report_file(
    paper_id: uuid.UUID,
    file: UploadFile,
    current_user: models.User = Depends(get_current_user_rest),
    db: Session = Depends(get_db),
):
    paper = _get_paper_or_404(db, paper_id)
    if not is_paper_participant(db, paper, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can't upload a final report for this paper")
    if paper.final_report_status in {"submitted", "approved"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Your final report has already been submitted")

    data = await file.read()
    try:
        metadata = file_storage.save_document("papers", paper_id, data, file.filename, file.content_type)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))

    proxy = _FinalReportFileProxy(paper)
    _set_file_metadata(proxy, metadata)
    _commit_upload_or_rollback(db, metadata)
    return _file_metadata_response(proxy)


@router.get("/papers/{paper_id}")
async def download_final_report_file(
    paper_id: uuid.UUID,
    current_user: models.User = Depends(get_current_user_rest),
    db: Session = Depends(get_db),
):
    paper = _get_paper_or_404(db, paper_id)
    can_view = (
        is_paper_participant(db, paper, current_user.id)
        or paper.supervisor_id == current_user.id
        or is_panel_member(db, current_user.id, paper_id=paper.id)
        or _department_admin_can_view_paper(db, paper, current_user)
    )
    if not can_view:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can't view this paper's final report")
    return _download_response(_FinalReportFileProxy(paper), "final-report.pdf")
