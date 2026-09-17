import { API_ORIGIN } from "./uploadAvatar";

export type DocumentKind = "proposals" | "progress-reports" | "papers" | "defenses";

interface UploadDocumentResult {
  originalFilename: string;
  fileSizeBytes: number;
  contentType: string;
  uploadedAt: string;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? fallback;
  } catch {
    return fallback;
  }
}

// All document types go through the plain REST /files routes (not GraphQL —
// see backend/app/files.py), since GraphQL doesn't carry binary payloads well.
// `kind` picks the subpath: proposals | progress-reports | papers (final
// report) | defenses (final thesis).
export async function uploadDocumentFile(kind: DocumentKind, entityId: string, file: File): Promise<UploadDocumentResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_ORIGIN}/files/${kind}/${entityId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}` },
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Unable to upload the document."));
  }
  return (await response.json()) as UploadDocumentResult;
}

// Neither <a download> nor window.open can carry an Authorization header, so the
// file is always fetched as a blob with the bearer token first.
async function fetchDocumentBlob(kind: DocumentKind, entityId: string): Promise<Blob> {
  const response = await fetch(`${API_ORIGIN}/files/${kind}/${entityId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}` },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Unable to open the document."));
  }
  return response.blob();
}

export async function downloadDocumentFile(kind: DocumentKind, entityId: string, filename: string): Promise<void> {
  const blob = await fetchDocumentBlob(kind, entityId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Opens the PDF in a new tab as a same-origin blob: URL. The server's
// Content-Disposition (forcing a save-as) only applies to a direct navigation —
// once fetched as a blob and reopened this way, the browser's built-in PDF
// viewer renders it inline instead. The object URL is deliberately left
// un-revoked (a small per-view leak) since revoking too early can blank out
// the tab before it finishes loading the blob.
export async function viewDocumentFile(kind: DocumentKind, entityId: string): Promise<void> {
  const blob = await fetchDocumentBlob(kind, entityId);
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    throw new Error("Your browser blocked the preview — allow pop-ups for this site, or use Download instead.");
  }
}

// Proposal-specific convenience wrappers — kept so every existing call site
// (StudentDashboard, ProfessorDashboard, AdminManagement) needs no changes.
export const uploadProposalFile = (proposalId: string, file: File) => uploadDocumentFile("proposals", proposalId, file);
export const downloadProposalFile = (proposalId: string, filename: string) => downloadDocumentFile("proposals", proposalId, filename);
export const viewProposalFile = (proposalId: string) => viewDocumentFile("proposals", proposalId);
