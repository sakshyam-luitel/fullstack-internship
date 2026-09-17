"""Proposal document storage — bytes on a local/Docker-volume-backed directory,
metadata in Postgres. Kept separate from utils.py's avatar upload (different
root, different rules) so that working code isn't touched by this addition.

If the college later needs multi-node or off-LAN access, swap STORAGE_ROOT's
disk writes for an S3-compatible client (e.g. MinIO) here — callers only deal
in the metadata dict this module returns, so no resolver code should need to
change.
"""

import hashlib
import re
from pathlib import Path

STORAGE_ROOT = Path(__file__).resolve().parent.parent / "storage"
ALLOWED_DOCUMENT_TYPES = {"application/pdf": ".pdf"}
MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

_UNSAFE_FILENAME_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


def _sanitize_filename(original_filename: str) -> str:
    """Never build a disk path from a client-supplied filename directly — strip
    directory separators and anything but a safe character set, and always
    force the extension implied by the validated content type."""
    base = Path(original_filename or "document").name
    base = _UNSAFE_FILENAME_CHARS.sub("_", base).strip("._") or "document"
    return base


def save_document(subdir: str, entity_id, data: bytes, original_filename: str, content_type: str) -> dict:
    """Validate and persist an uploaded document, returning the metadata to
    store on the owning row. Raises on invalid type/size."""
    extension = ALLOWED_DOCUMENT_TYPES.get(content_type)
    if not extension:
        raise Exception("Only PDF files are allowed")
    if len(data) > MAX_DOCUMENT_BYTES:
        raise Exception(f"File must be smaller than {MAX_DOCUMENT_BYTES // (1024 * 1024)}MB")
    if not data:
        raise Exception("The uploaded file is empty")

    safe_name = _sanitize_filename(original_filename)
    if not safe_name.lower().endswith(extension):
        safe_name = f"{safe_name}{extension}"

    checksum = hashlib.sha256(data).hexdigest()
    directory = STORAGE_ROOT / subdir / str(entity_id)
    directory.mkdir(parents=True, exist_ok=True)
    # Every upload is immutable on disk. A history event therefore continues to
    # identify the exact PDF it saw even when a student later resubmits using the
    # same browser filename.
    destination = directory / f"{checksum[:16]}-{safe_name}"
    destination.write_bytes(data)

    return {
        "file_path": str(destination.relative_to(STORAGE_ROOT)).replace("\\", "/"),
        "original_filename": Path(original_filename or safe_name).name,
        "file_size_bytes": len(data),
        "content_type": content_type,
        "checksum": checksum,
    }


def resolve_document_path(file_path: str) -> Path:
    """Resolve a stored relative file_path back to an absolute path, refusing
    anything that would escape STORAGE_ROOT."""
    resolved = (STORAGE_ROOT / file_path).resolve()
    if STORAGE_ROOT.resolve() not in resolved.parents and resolved != STORAGE_ROOT.resolve():
        raise Exception("Invalid file path")
    return resolved


def delete_document(file_path: str) -> None:
    """Best-effort cleanup — used to roll back a disk write when the
    subsequent DB update fails, so a file is never left orphaned."""
    try:
        resolve_document_path(file_path).unlink(missing_ok=True)
    except Exception:
        pass
