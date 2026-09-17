import { useEffect, useRef, useState } from "react";
import { CalendarClock, Check, Download, Eye, FileText, History, Menu, Pencil, Send, Users, X } from "lucide-react";
import { gql } from "@apollo/client";
import { print } from "graphql";
import { useNavigate } from "react-router-dom";
import NavigationBar from "../components/NavigationBar";
import NotificationBell from "../components/NotificationBell";
import DefenseNotice from "../components/DefenseNotice";
import DefenseCard, { type DefenseDetails } from "../components/DefenseCard";
import { isPastDefense } from "../utils/defenses";
import { resolveAvatarUrl, uploadAvatarImage } from "../utils/uploadAvatar";
import { downloadDocumentFile, uploadDocumentFile, viewDocumentFile, type DocumentKind } from "../utils/proposalFile";
import { PROPOSAL_SUBMISSION_HISTORY_QUERY, RESEARCH_PHASES_QUERY } from "../queries/queries";

interface Proposal {
  id: string;
  title: string;
  status: string;
  supervisorName: string | null;
  groupMembers: { id: string; name: string; status: string }[];
  reviewComment: string | null;
  reviewedByName: string | null;
  submittedBy: string;
  submittedByName: string | null;
  studentResponse: string | null;
  respondedByName: string | null;
  deletedAt: string | null;
  deletedByName: string | null;
  originalFilename: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
}
interface Student { id: string; name: string; }
interface Invite { proposalId: string; title: string; ownerName: string; status: string; }
interface CurrentUser { id: string; name: string; email: string; avatarUrl: string | null; }
interface Paper {
  id: string;
  title: string;
  status: string;
  supervisorName: string | null;
  finalReportStatus: string | null;
  finalReportReviewComment: string | null;
  finalReportReviewedByName: string | null;
  finalReportOriginalFilename: string | null;
  finalReportUploadedAt: string | null;
}
interface ProgressReport {
  id: string;
  content: string;
  status: string;
  submittedAt: string;
  originalFilename: string | null;
  reviewComment: string | null;
  reviewedByName: string | null;
  phaseLabel: string | null;
  deadlineAt: string | null;
}
interface Defense extends DefenseDetails {
  id: string;
  kind: string;
  proposalId: string | null;
  progressReportId: string | null;
  panelNames: string[];
  defenseDate: string;
  scheduledTime: string | null;
  location: string | null;
  submissionConfirmed: boolean;
  originalFilename: string | null;
  currentStatus: string;
  phaseLabel: string | null;
}
interface ResearchPhase {
  id: string;
  phaseType: string;
  label: string;
  sequenceNumber: number;
  opensAt: string | null;
  deadlineAt: string | null;
  defenseDate: string | null;
  gracePeriodEnabled: boolean;
  isOpen: boolean;
}
interface SubmissionHistoryItem { id: string; entityType: string; phaseLabel: string | null; submittedByName: string | null; status: string; reviewedByName: string | null; comments: string | null; originalFilename: string | null; createdAt: string; }
interface MyProfile {
  name: string;
  email: string;
  avatarUrl: string | null;
  departmentName: string | null;
  degreeProgramName: string | null;
  supervisorName: string | null;
  status: string | null;
  rollNumber: string | null;
  degreeLevel: string | null;
}

interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

type ResearchTab = "proposal" | "progress" | "final" | "defenses";
type SubmitIntent = "draft" | "submit";

const statusStyles: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  accepted: "bg-emerald-50 text-emerald-700",
  submitted: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-700",
  changes_requested: "bg-amber-50 text-amber-700",
};
const formatStatus = (status: string) => status.replace(/_/g, " ");
const formatDateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const ENDPOINT = "http://127.0.0.1:8000/graphql";
const MY_PROPOSALS = gql`query MyProposals { myProposals { id title status supervisorName groupMembers { id name status } reviewComment reviewedByName submittedBy submittedByName studentResponse respondedByName deletedAt deletedByName originalFilename fileSizeBytes uploadedAt } }`;
const AVAILABLE_MEMBERS = gql`query AvailableGroupMembers { availableGroupMembers { id name } }`;
const CURRENT_USER = gql`query CurrentUser { currentUser { id name email avatarUrl } }`;
const MY_PROFILE = gql`query MyStudentProfile { myStudentProfile { name email avatarUrl departmentName degreeProgramName supervisorName status rollNumber degreeLevel } }`;
const MY_INVITES = gql`query MyProposalInvites { myProposalInvites { proposalId title ownerName status } }`;
const CREATE_PROPOSAL = gql`mutation CreateProposal($studentInput: ProposalsInput!) { createProposalByUser(studentInput: $studentInput) { id title status } }`;
const UPDATE_PROPOSAL = gql`mutation UpdateProposal($studentInput: ProposalUpdateInput!) { updateProposalByUser(studentInput: $studentInput) { id title status } }`;
const ADD_MEMBER = gql`mutation AddMember($studentInput: ProposalCandidatesMutation!) { createProposalCandidate(studentInput: $studentInput) { proposalId studentId status } }`;
const REMOVE_MEMBER = gql`mutation RemoveMember($studentInput: ProposalMemberDeleteInput!) { deleteProposalCandidate(studentInput: $studentInput) { proposalId studentId } }`;
const RESPOND_INVITE = gql`mutation RespondInvite($studentInput: ProposalInviteResponseInput!) { respondToProposalInvite(studentInput: $studentInput) { proposalId status } }`;
const RESPOND_TO_FEEDBACK = gql`mutation RespondToProposalFeedback($studentInput: ProposalFeedbackResponseInput!) { respondToProposalFeedback(studentInput: $studentInput) { id status studentResponse } }`;
const MY_PAPER = gql`query MyPaper { myPaper { id title status supervisorName finalReportStatus finalReportReviewComment finalReportReviewedByName finalReportOriginalFilename finalReportUploadedAt } }`;
const MY_PROGRESS_REPORTS = gql`query MyProgressReports { myProgressReports { id content status submittedAt originalFilename reviewComment reviewedByName phaseLabel deadlineAt } }`;
const MY_DEFENSES = gql`query MyDefenses { myDefenses { id kind proposalId progressReportId paperId paperTitle phaseLabel defenseDate scheduledTime location submissionConfirmed originalFilename currentStatus degreeLevel studentNames supervisorName panelNames reportDocumentKind reportDocumentId reportFilename } }`;
const CREATE_PROGRESS_REPORT = gql`mutation CreateProgressReport($studentInput: ProgressReportInput!) { createProgressReport(studentInput: $studentInput) { id status } }`;
const SUBMIT_PROGRESS_REPORT = gql`mutation SubmitProgressReport($studentInput: ProgressReportIdInput!) { submitProgressReport(studentInput: $studentInput) { id status } }`;
const SUBMIT_FINAL_REPORT = gql`mutation SubmitFinalReport { submitFinalReport { id finalReportStatus } }`;
const CONFIRM_DEFENSE_SUBMISSION = gql`mutation ConfirmDefenseSubmission($studentInput: DefenseIdInput!) { confirmDefenseSubmission(studentInput: $studentInput) { id submissionConfirmed } }`;

async function request<T>(query: ReturnType<typeof gql>, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}` },
    body: JSON.stringify({ query: print(query), variables }),
  });
  const result = (await response.json()) as GraphQLResult<T>;
  if (!response.ok || result.errors?.length) throw new Error(result.errors?.[0]?.message ?? "Request failed.");
  if (!result.data) throw new Error("The server returned no data.");
  return result.data;
}

// The phase a new submission would land in: the backend picks the highest-numbered open phase.
function openPhaseOf(phases: ResearchPhase[], phaseType: string): ResearchPhase | null {
  const open = phases.filter((phase) => phase.phaseType === phaseType && phase.isOpen);
  return open.sort((first, second) => second.sequenceNumber - first.sequenceNumber)[0] ?? null;
}

function phaseNotice(phases: ResearchPhase[], phaseType: string, noun: string): { text: string; tone: "open" | "closed" } {
  if (phaseType === "defense") {
    const defense = openPhaseOf(phases, "defense");
    return defense?.defenseDate
      ? { text: `${defense.label}: defense day ${formatDate(defense.defenseDate)}`, tone: "open" }
      : { text: "Your department hasn't scheduled the final defense yet.", tone: "closed" };
  }
  const open = openPhaseOf(phases, phaseType);
  if (open?.deadlineAt) {
    const pastDeadline = new Date(open.deadlineAt).getTime() < Date.now();
    return {
      text: pastDeadline
        ? `${open.label}: the deadline (${formatDateTime(open.deadlineAt)}) has passed, but late submissions are allowed`
        : `${open.label} is open until ${formatDateTime(open.deadlineAt)}`,
      tone: "open",
    };
  }
  const upcoming = phases
    .filter((phase) => phase.phaseType === phaseType && phase.opensAt && new Date(phase.opensAt).getTime() > Date.now())
    .sort((first, second) => new Date(first.opensAt!).getTime() - new Date(second.opensAt!).getTime())[0];
  if (upcoming?.opensAt) return { text: `${upcoming.label} opens ${formatDateTime(upcoming.opensAt)}`, tone: "closed" };
  return phases.some((phase) => phase.phaseType === phaseType)
    ? { text: `No ${noun} phase is open right now.`, tone: "closed" }
    : { text: `Your department hasn't scheduled a ${noun} phase for your degree level yet.`, tone: "closed" };
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {label ?? formatStatus(status)}
    </span>
  );
}

function PhaseNotice({ notice }: { notice: { text: string; tone: "open" | "closed" } }) {
  return (
    <p className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${notice.tone === "open" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
      <CalendarClock size={16} aria-hidden="true" className="shrink-0" />
      {notice.text}
    </p>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div role="dialog" aria-modal="true" className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// PDF picker that shows the document already on file, if any.
function DocumentField({ label, existingFilename, onView, file, onChange, required }: {
  label: string;
  existingFilename: string | null;
  onView?: () => void;
  file: File | null;
  onChange: (file: File | null) => void;
  required: boolean;
}) {
  return (
    <div className="text-sm font-medium text-slate-700">
      {label}
      {existingFilename && (
        <div className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 font-normal">
          <span className="flex min-w-0 items-center gap-2 text-slate-600"><FileText size={15} aria-hidden="true" className="shrink-0" /><span className="truncate">{existingFilename}</span></span>
          {onView && <button type="button" onClick={onView} className="inline-flex shrink-0 items-center gap-1 text-blue-700 hover:underline"><Eye size={14} aria-hidden="true" /> View</button>}
        </div>
      )}
      <input
        type="file"
        accept="application/pdf"
        required={required && !existingFilename}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="mt-2 block w-full text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
      />
      <span className="mt-1 block text-xs font-normal text-slate-500">
        PDF, up to 20 MB.{existingFilename ? " Choosing a file replaces the current one." : ""}{file ? ` Selected: ${file.name}` : ""}
      </span>
    </div>
  );
}

function FormActions({ onCancel, busy, draftLabel, submitLabel, onIntent }: {
  onCancel: () => void;
  busy: boolean;
  draftLabel?: string;
  submitLabel: string;
  onIntent: (intent: SubmitIntent) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-3 pt-2">
      <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
      {draftLabel && (
        <button type="submit" disabled={busy} onClick={() => onIntent("draft")} className="rounded-lg border border-blue-300 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60">
          {draftLabel}
        </button>
      )}
      <button type="submit" disabled={busy} onClick={() => onIntent("submit")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
        <Send size={15} aria-hidden="true" />
        {busy ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

function DocumentLinks({ kind, entityId, filename, fallbackName, onError }: { kind: DocumentKind; entityId: string; filename: string | null; fallbackName: string; onError: (message: string) => void }) {
  if (!filename) return null;
  return (
    <span className="flex flex-wrap items-center gap-3 text-xs">
      <span className="flex min-w-0 items-center gap-1 text-slate-600"><FileText size={14} aria-hidden="true" /><span className="truncate">{filename}</span></span>
      <button type="button" onClick={() => void viewDocumentFile(kind, entityId).catch((error: unknown) => onError(errorMessage(error, "Unable to open the document.")))} className="inline-flex items-center gap-1 text-blue-700 hover:underline"><Eye size={14} aria-hidden="true" /> View</button>
      <button type="button" onClick={() => void downloadDocumentFile(kind, entityId, filename ?? fallbackName).catch((error: unknown) => onError(errorMessage(error, "Unable to download the document.")))} className="inline-flex items-center gap-1 text-blue-700 hover:underline"><Download size={14} aria-hidden="true" /> Download</button>
    </span>
  );
}

function StudentDashboard() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [availableMembers, setAvailableMembers] = useState<Student[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [defenses, setDefenses] = useState<Defense[]>([]);
  const [researchPhases, setResearchPhases] = useState<ResearchPhase[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [activeView, setActiveView] = useState<"proposals" | "profile">("proposals");
  const [researchTab, setResearchTab] = useState<ResearchTab>("proposal");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // One open form at a time; each keeps its own error so failures show inside the dialog.
  const submitIntent = useRef<SubmitIntent>("submit");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formFile, setFormFile] = useState<File | null>(null);

  const [proposalForm, setProposalForm] = useState<{ id: string | null; title: string; memberIds: string[] } | null>(null);
  const [feedbackProposal, setFeedbackProposal] = useState<Proposal | null>(null);
  const [feedbackResponse, setFeedbackResponse] = useState("");
  const [groupProposal, setGroupProposal] = useState<Proposal | null>(null);
  const [selectedMember, setSelectedMember] = useState("");
  const [historyProposal, setHistoryProposal] = useState<Proposal | null>(null);
  const [history, setHistory] = useState<SubmissionHistoryItem[]>([]);
  const [reportForm, setReportForm] = useState<{ report: ProgressReport | null; content: string } | null>(null);
  const [isFinalReportFormOpen, setIsFinalReportFormOpen] = useState(false);
  const [thesisDefense, setThesisDefense] = useState<Defense | null>(null);

  const currentUserId = currentUser?.id ?? null;

  const loadResearch = async () => {
    try {
      const [proposalResult, membersResult, invitesResult, paperResult, reportsResult, defensesResult, phasesResult] = await Promise.all([
        request<{ myProposals: Proposal[] }>(MY_PROPOSALS),
        request<{ availableGroupMembers: Student[] }>(AVAILABLE_MEMBERS),
        request<{ myProposalInvites: Invite[] }>(MY_INVITES),
        request<{ myPaper: Paper | null }>(MY_PAPER),
        request<{ myProgressReports: ProgressReport[] }>(MY_PROGRESS_REPORTS),
        request<{ myDefenses: Defense[] }>(MY_DEFENSES),
        request<{ researchPhases: ResearchPhase[] }>(RESEARCH_PHASES_QUERY),
      ]);
      setProposals(proposalResult.myProposals);
      setAvailableMembers(membersResult.availableGroupMembers);
      setInvites(invitesResult.myProposalInvites);
      setPaper(paperResult.myPaper);
      setProgressReports(reportsResult.myProgressReports);
      setDefenses(defensesResult.myDefenses);
      setResearchPhases(phasesResult.researchPhases);
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to load your research space."));
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await loadResearch();
      try {
        const [userResult, profileResult] = await Promise.all([
          request<{ currentUser: CurrentUser }>(CURRENT_USER),
          request<{ myStudentProfile: MyProfile }>(MY_PROFILE),
        ]);
        setCurrentUser(userResult.currentUser);
        setProfile(profileResult.myStudentProfile);
      } catch (requestError) {
        setError(errorMessage(requestError, "Unable to load your profile."));
      }
    };
    void initialize();
  }, []);

  const resetForm = () => {
    setFormError(null);
    setFormFile(null);
    setIsSaving(false);
  };
  const closeForms = () => {
    setProposalForm(null);
    setFeedbackProposal(null);
    setReportForm(null);
    setIsFinalReportFormOpen(false);
    setThesisDefense(null);
    resetForm();
  };

  // Runs one form's steps; on failure the dialog stays open with the error and the page reloads,
  // so a half-finished submission (e.g. a draft that was created) is visible and can be continued.
  const runSubmission = async (steps: () => Promise<string>, fallback: string) => {
    setFormError(null);
    setIsSaving(true);
    try {
      const doneMessage = await steps();
      closeForms();
      setNotice(doneMessage);
    } catch (submissionError) {
      setFormError(errorMessage(submissionError, fallback));
    } finally {
      setIsSaving(false);
      await loadResearch();
    }
  };

  const openProposalForm = (proposal: Proposal | null) => {
    resetForm();
    setProposalForm({ id: proposal?.id ?? null, title: proposal?.title ?? "", memberIds: [] });
  };

  const saveProposal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!proposalForm) return;
    const submit = submitIntent.current === "submit";
    const existing = proposals.find((proposal) => proposal.id === proposalForm.id) ?? null;
    if (submit && !formFile && !existing?.originalFilename) {
      setFormError("Attach the proposal PDF before submitting.");
      return;
    }
    await runSubmission(async () => {
      let proposalId = proposalForm.id;
      const title = proposalForm.title.trim();
      if (!proposalId) {
        const created = await request<{ createProposalByUser: { id: string } }>(CREATE_PROPOSAL, { studentInput: { title, status: "draft" } });
        proposalId = created.createProposalByUser.id;
        // Keep the id so a retry after a later failure updates this draft instead of creating another.
        setProposalForm((current) => (current ? { ...current, id: proposalId } : current));
        for (const studentId of proposalForm.memberIds) {
          await request(ADD_MEMBER, { studentInput: { proposalId, studentId } });
        }
      } else {
        await request(UPDATE_PROPOSAL, { studentInput: { id: proposalId, title, status: "draft" } });
      }
      if (formFile) await uploadDocumentFile("proposals", proposalId, formFile);
      if (!submit) return "Proposal saved as a draft.";
      if (proposalForm.memberIds.length > 0 && !proposalForm.id) {
        return "Proposal saved as a draft. Submit it once your invited group members have accepted.";
      }
      await request(UPDATE_PROPOSAL, { studentInput: { id: proposalId, title, status: "submitted" } });
      return "Proposal submitted for review.";
    }, "Unable to save the proposal.");
  };

  const openFeedbackForm = (proposal: Proposal) => {
    resetForm();
    setFeedbackResponse("");
    setFeedbackProposal(proposal);
  };

  const submitFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!feedbackProposal) return;
    await runSubmission(async () => {
      if (formFile) await uploadDocumentFile("proposals", feedbackProposal.id, formFile);
      await request(RESPOND_TO_FEEDBACK, { studentInput: { proposalId: feedbackProposal.id, response: feedbackResponse.trim() } });
      return "Revised proposal sent back to your supervisor.";
    }, "Unable to send your response.");
  };

  const openReportForm = (report: ProgressReport | null) => {
    resetForm();
    setReportForm({ report, content: report?.content ?? "" });
  };

  const saveProgressReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reportForm) return;
    const submit = submitIntent.current === "submit";
    if (submit && !formFile && !reportForm.report?.originalFilename) {
      setFormError("Attach the progress report PDF before submitting.");
      return;
    }
    await runSubmission(async () => {
      let reportId = reportForm.report?.id ?? null;
      const content = reportForm.content.trim();
      if (!reportId) {
        const created = await request<{ createProgressReport: { id: string } }>(CREATE_PROGRESS_REPORT, { studentInput: { content } });
        reportId = created.createProgressReport.id;
        const createdReport: ProgressReport = { id: reportId, content, status: "draft", submittedAt: new Date().toISOString(), originalFilename: null, reviewComment: null, reviewedByName: null, phaseLabel: null, deadlineAt: null };
        setReportForm((current) => (current ? { ...current, report: createdReport } : current));
      }
      if (formFile) await uploadDocumentFile("progress-reports", reportId, formFile);
      if (!submit) return "Progress report saved as a draft.";
      await request(SUBMIT_PROGRESS_REPORT, { studentInput: { id: reportId, content } });
      return "Progress report submitted to your supervisor.";
    }, "Unable to save the progress report.");
  };

  const submitFinalReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paper) return;
    await runSubmission(async () => {
      if (formFile) await uploadDocumentFile("papers", paper.id, formFile);
      await request(SUBMIT_FINAL_REPORT);
      return "Final report submitted to your supervisor.";
    }, "Unable to submit the final report.");
  };

  const submitThesis = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!thesisDefense) return;
    await runSubmission(async () => {
      if (formFile) await uploadDocumentFile("defenses", thesisDefense.id, formFile);
      await request(CONFIRM_DEFENSE_SUBMISSION, { studentInput: { id: thesisDefense.id } });
      return "Final thesis submitted for your defense.";
    }, "Unable to submit the final thesis.");
  };

  const addMember = async () => {
    if (!groupProposal || !selectedMember) return;
    setFormError(null);
    try {
      await request(ADD_MEMBER, { studentInput: { proposalId: groupProposal.id, studentId: selectedMember } });
      setSelectedMember("");
      setGroupProposal(null);
      setNotice("Group invite sent.");
      await loadResearch();
    } catch (requestError) {
      setFormError(errorMessage(requestError, "Unable to send group invite."));
    }
  };

  // Removing a group member is the proposal owner's call only — the backend
  // enforces this too, but the UI never even offers the button to non-owners.
  const removeMember = async (proposal: Proposal, studentId: string) => {
    setFormError(null);
    try {
      await request(REMOVE_MEMBER, { studentInput: { proposalId: proposal.id, studentId } });
      setGroupProposal(null);
      await loadResearch();
    } catch (requestError) {
      setFormError(errorMessage(requestError, "Unable to remove group member."));
    }
  };

  const showHistory = async (proposal: Proposal) => {
    setError(null);
    try {
      const result = await request<{ proposalSubmissionHistory: SubmissionHistoryItem[] }>(PROPOSAL_SUBMISSION_HISTORY_QUERY, { proposalId: proposal.id });
      setHistory(result.proposalSubmissionHistory);
      setHistoryProposal(proposal);
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to load submission history."));
    }
  };

  const respondToInvite = async (proposalId: string, response: "accepted" | "rejected") => {
    setError(null);
    try {
      await request(RESPOND_INVITE, { studentInput: { proposalId, status: response } });
      await loadResearch();
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to respond to the invite."));
    }
  };

  const handleUploadAvatar = async (file: File) => {
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const avatarUrl = await uploadAvatarImage(file);
      setCurrentUser((current) => (current ? { ...current, avatarUrl } : current));
      setProfile((current) => (current ? { ...current, avatarUrl } : current));
    } catch (uploadError) {
      setAvatarError(errorMessage(uploadError, "Unable to upload image."));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const showError = (message: string) => setError(message);
  const proposalNotice = phaseNotice(researchPhases, "proposal", "proposal");
  const progressNotice = phaseNotice(researchPhases, "progress_report", "progress report");
  const defenseNotice = phaseNotice(researchPhases, "defense", "final defense");
  const openProgressPhase = openPhaseOf(researchPhases, "progress_report");
  // Only Bachelor's research is group work; Master's and PhD proposals are individual.
  const isGroupLevel = profile?.degreeLevel === "bachelors";
  const hasActiveProposal = proposals.some((proposal) => !proposal.deletedAt && proposal.status !== "rejected" && proposal.status !== "withdrawn");
  // A rejection never locks a student out: they can start a replacement, even after the phase closed.
  const hasRejectedProposal = proposals.some((proposal) => proposal.status === "rejected");
  const canStartProposal = !hasActiveProposal && (proposalNotice.tone === "open" || hasRejectedProposal);
  const reportForOpenPhase = openProgressPhase ? progressReports.find((report) => report.phaseLabel === openProgressPhase.label && report.status !== "rejected") : undefined;
  const retryableReport = progressReports.find(
    (report) => report.status === "rejected" && !progressReports.some((other) => other.phaseLabel === report.phaseLabel && other.status !== "rejected"),
  );
  const newReportPhaseLabel = openProgressPhase && !reportForOpenPhase ? openProgressPhase.label : retryableReport?.phaseLabel ?? null;
  const canStartReport = newReportPhaseLabel !== null;
  const finalDefenses = defenses.filter((defense) => defense.kind === "defense");
  const canSubmitFinalReport = paper !== null && (!paper.finalReportStatus || paper.finalReportStatus === "changes_requested" || paper.finalReportStatus === "rejected");
  const editingProposal = proposalForm?.id ? proposals.find((proposal) => proposal.id === proposalForm.id) ?? null : null;

  const tabs: { value: ResearchTab; label: string; count: number }[] = [
    { value: "proposal", label: "Proposal", count: proposals.filter((proposal) => proposal.status === "changes_requested").length + invites.length },
    { value: "progress", label: "Progress reports", count: progressReports.filter((report) => report.status === "draft" || report.status === "changes_requested").length },
    { value: "final", label: "Final submission", count: (paper?.finalReportStatus === "changes_requested" ? 1 : 0) + finalDefenses.filter((defense) => !defense.submissionConfirmed).length },
    { value: "defenses", label: "Defenses", count: defenses.filter((defense) => !isPastDefense(defense) && defense.currentStatus === "pending").length },
  ];

  const noPaperState = (what: string) => (
    <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
      <p className="text-sm font-medium text-slate-700">{what} open up after your proposal is approved</p>
      <p className="mt-1 text-sm text-slate-500">Once your supervisor approves the proposal it becomes your research paper, and you can submit {what.toLowerCase()} here.</p>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      <NavigationBar
        open={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
        role="student"
        onProfile={() => setActiveView("profile")}
        onResearchSpace={() => setActiveView("proposals")}
        onLogout={() => { localStorage.clear(); navigate("/login"); }}
        activeView={activeView}
        avatarUrl={resolveAvatarUrl(currentUser?.avatarUrl)}
        userName={currentUser?.name}
        onUploadAvatar={(file) => void handleUploadAvatar(file)}
        isUploadingAvatar={isUploadingAvatar}
        avatarError={avatarError}
      />
      <div className="m-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
        <header className="flex min-h-20 items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={isNavigationOpen}
              onClick={() => setIsNavigationOpen(true)}
              className="flex size-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 md:hidden"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-blue-600">Student workspace</p>
              <h1 className="mt-1 font-serif text-2xl text-slate-900">{activeView === "profile" ? "My profile" : "Research space"}</h1>
            </div>
          </div>
          <NotificationBell />
        </header>
        <div className="min-h-0 w-full flex-1 overflow-auto">
          {activeView === "profile" ? (
            <section className="p-6">
              <div className="max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-600">Account profile</p>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-200 text-xl font-semibold uppercase text-slate-600">
                    {profile?.avatarUrl ? (
                      <img src={resolveAvatarUrl(profile.avatarUrl) ?? undefined} alt="Profile" className="size-full object-cover" />
                    ) : (
                      (profile?.name.trim()?.[0] ?? "?")
                    )}
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-900">{profile?.name ?? "Student"}</h2>
                </div>
                {profile ? (
                  <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt><dd className="mt-1 text-sm text-slate-700">{profile.email}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Roll number</dt><dd className="mt-1 text-sm text-slate-700">{profile.rollNumber ?? "Not assigned"}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Department</dt><dd className="mt-1 text-sm text-slate-700">{profile.departmentName ?? "Not assigned"}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Degree program</dt><dd className="mt-1 text-sm text-slate-700">{profile.degreeProgramName ?? "Not assigned"}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Supervisor</dt><dd className="mt-1 text-sm text-slate-700">{profile.supervisorName ?? "Not assigned"}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Status</dt><dd className="mt-1 text-sm capitalize text-slate-700">{profile.status ?? "Not available"}</dd></div>
                  </dl>
                ) : <p className="mt-4 text-sm text-slate-500">Profile details are unavailable.</p>}
              </div>
            </section>
          ) : (
            <section className="p-6">
              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4" role="tablist" aria-label="Research stages">
                {tabs.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={researchTab === item.value}
                    onClick={() => { setResearchTab(item.value); setNotice(null); setError(null); }}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${researchTab === item.value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    {item.label}
                    {item.count > 0 && (
                      <span className={`rounded-full px-1.5 text-xs ${researchTab === item.value ? "bg-white/25 text-white" : "bg-amber-100 text-amber-800"}`}>{item.count}</span>
                    )}
                  </button>
                ))}
              </div>
              {paper && <p className="mt-4 text-sm text-slate-500">Research paper: <span className="font-medium text-slate-700">{paper.title}</span> · Supervisor: {paper.supervisorName ?? "not assigned"}</p>}
              {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
              {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

              {researchTab === "proposal" && (
                <>
                  {invites.length > 0 && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <h2 className="text-sm font-semibold text-blue-900">Group invite requests</h2>
                      <p className="mt-0.5 text-xs text-blue-700">Respond before the owner submits their proposal.</p>
                      <ul className="mt-3 space-y-2">
                        {invites.map((invite) => (
                          <li key={invite.proposalId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                            <span><span className="font-medium text-slate-800">{invite.ownerName}</span> invited you to join "{invite.title}"</span>
                            <span className="flex gap-2">
                              <button type="button" onClick={() => void respondToInvite(invite.proposalId, "accepted")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"><Check size={14} aria-hidden="true" /> Accept</button>
                              <button type="button" onClick={() => void respondToInvite(invite.proposalId, "rejected")} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"><X size={14} aria-hidden="true" /> Decline</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-medium text-slate-800">Research proposal</h2>
                      <p className="text-sm text-slate-500">Write your proposal, attach the PDF and submit it for review.</p>
                    </div>
                    <button
                      type="button"
                      disabled={!canStartProposal}
                      title={hasActiveProposal ? "You already have an active proposal." : undefined}
                      onClick={() => openProposalForm(null)}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FileText size={16} aria-hidden="true" /> New proposal
                    </button>
                  </div>
                  <PhaseNotice notice={proposalNotice} />
                  {hasRejectedProposal && !hasActiveProposal && (
                    <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">Your previous proposal was rejected. You can submit a new proposal, even if the proposal deadline has passed.</p>
                  )}
                  <div className="mt-4 space-y-3">
                    {proposals.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">You haven't created a proposal yet.</p>}
                    {proposals.map((proposal) => {
                      const isOwner = proposal.submittedBy === currentUserId;
                      const isMember = isOwner || proposal.groupMembers.some((member) => member.id === currentUserId && member.status === "accepted");
                      const canAct = isMember && !proposal.deletedAt;
                      return (
                        <article key={proposal.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="font-medium text-slate-900">{proposal.title}</h3>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {isOwner ? "Your proposal" : `By ${proposal.submittedByName ?? "a teammate"}`} · Supervisor: {proposal.supervisorName ?? "not assigned yet"}
                              </p>
                            </div>
                            <span className="flex items-center gap-1">
                              <StatusBadge status={proposal.status} />
                              {proposal.deletedAt && <StatusBadge status="deleted" label="Deleted" />}
                            </span>
                          </div>
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                            <Users size={14} aria-hidden="true" />
                            {[proposal.submittedByName ?? "Owner", ...proposal.groupMembers.map((member) => `${member.name}${member.status !== "accepted" ? ` (${member.status})` : ""}`)].join(", ")}
                          </p>
                          {proposal.reviewComment && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{proposal.reviewedByName ? `${proposal.reviewedByName}: ` : ""}"{proposal.reviewComment}"</p>}
                          {proposal.studentResponse && <p className="mt-2 text-xs text-blue-700">{proposal.respondedByName ? `${proposal.respondedByName} replied: ` : "Reply: "}"{proposal.studentResponse}"</p>}
                          {proposal.deletedAt && <p className="mt-2 text-xs text-slate-400">Deleted by {proposal.deletedByName ?? "an admin"} on {formatDate(proposal.deletedAt)}</p>}
                          {defenses.filter((defense) => defense.proposalId === proposal.id).map((defense) => <DefenseNotice key={defense.id} defense={defense} />)}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <DocumentLinks kind="proposals" entityId={proposal.id} filename={proposal.originalFilename} fallbackName="proposal.pdf" onError={showError} />
                            {canAct && (
                              <span className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => void showHistory(proposal)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><History size={14} aria-hidden="true" /> History</button>
                                {proposal.status === "draft" && (
                                  <>
                                    {isGroupLevel && <button type="button" onClick={() => { setFormError(null); setSelectedMember(""); setGroupProposal(proposal); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Users size={14} aria-hidden="true" /> Group</button>}
                                    <button type="button" onClick={() => openProposalForm(proposal)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"><Pencil size={14} aria-hidden="true" /> Continue &amp; submit</button>
                                  </>
                                )}
                                {proposal.status === "changes_requested" && (
                                  <button type="button" onClick={() => openFeedbackForm(proposal)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"><Send size={14} aria-hidden="true" /> Address feedback</button>
                                )}
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}

              {researchTab === "progress" && (
                !paper ? noPaperState("Progress reports") : (
                  <>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-medium text-slate-800">Progress reports</h2>
                        <p className="text-sm text-slate-500">Submit one report for each progress review round your department schedules.</p>
                      </div>
                      <button
                        type="button"
                        disabled={!canStartReport}
                        title={reportForOpenPhase && !retryableReport ? `You already have a report for ${openProgressPhase?.label}.` : undefined}
                        onClick={() => openReportForm(null)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FileText size={16} aria-hidden="true" /> New progress report
                      </button>
                    </div>
                    <PhaseNotice notice={progressNotice} />
                    {retryableReport && (
                      <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                        Your report for {retryableReport.phaseLabel ?? "a progress round"} was rejected. Use New progress report to submit a replacement, even if that round's deadline has passed.
                      </p>
                    )}
                    <div className="mt-4 space-y-3">
                      {progressReports.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No progress reports yet.</p>}
                      {progressReports.map((report) => (
                        <article key={report.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-medium text-slate-900">{report.phaseLabel ?? "Progress report"}</h3>
                              <p className="mt-0.5 text-xs text-slate-500">
                                Started {formatDate(report.submittedAt)}{report.deadlineAt ? ` · deadline ${formatDateTime(report.deadlineAt)}` : ""}
                              </p>
                            </div>
                            <StatusBadge status={report.status} />
                          </div>
                          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{report.content}</p>
                          {report.reviewComment && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{report.reviewedByName ? `${report.reviewedByName}: ` : ""}"{report.reviewComment}"</p>}
                          {defenses.filter((defense) => defense.progressReportId === report.id).map((defense) => <DefenseNotice key={defense.id} defense={defense} />)}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <DocumentLinks kind="progress-reports" entityId={report.id} filename={report.originalFilename} fallbackName="progress-report.pdf" onError={showError} />
                            {(report.status === "draft" || report.status === "changes_requested") && (
                              <button type="button" onClick={() => openReportForm(report)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                                <Send size={14} aria-hidden="true" /> {report.status === "draft" ? "Continue & submit" : "Revise & resubmit"}
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )
              )}

              {researchTab === "defenses" && (
                <>
                  <div className="mt-4">
                    <h2 className="text-lg font-medium text-slate-800">Defenses</h2>
                    <p className="text-sm text-slate-500">When and where each of your reports will be defended, and who is on the panel.</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {defenses.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                        No defenses planned yet. Your department announces a defense for your proposal, progress reports and final report here.
                      </p>
                    ) : (
                      [...defenses]
                        .sort((first, second) => Number(isPastDefense(first)) - Number(isPastDefense(second)) || new Date(first.defenseDate).getTime() - new Date(second.defenseDate).getTime())
                        .map((defense) => <DefenseCard key={defense.id} defense={defense} onError={showError} />)
                    )}
                  </div>
                </>
              )}

              {researchTab === "final" && (
                !paper ? noPaperState("Final submissions") : (
                  <>
                    <div className="mt-4">
                      <h2 className="text-lg font-medium text-slate-800">Final submission</h2>
                      <p className="text-sm text-slate-500">Submit your final report to your supervisor. Once it's approved, your department schedules your defense and you submit the final thesis.</p>
                    </div>
                    <PhaseNotice notice={defenseNotice} />
                    <ol className="mt-4 space-y-3">
                      <li className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Step 1</p>
                            <h3 className="font-medium text-slate-900">Final report</h3>
                          </div>
                          <StatusBadge status={paper.finalReportStatus ?? "not_submitted"} />
                        </div>
                        {paper.finalReportReviewComment && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{paper.finalReportReviewedByName ? `${paper.finalReportReviewedByName}: ` : ""}"{paper.finalReportReviewComment}"</p>}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <DocumentLinks kind="papers" entityId={paper.id} filename={paper.finalReportOriginalFilename} fallbackName="final-report.pdf" onError={showError} />
                          {canSubmitFinalReport && (
                            <button type="button" disabled={defenseNotice.tone !== "open"} onClick={() => { resetForm(); setIsFinalReportFormOpen(true); }} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                              <Send size={14} aria-hidden="true" /> {paper.finalReportStatus ? "Resubmit final report" : "Submit final report"}
                            </button>
                          )}
                        </div>
                      </li>
                      <li className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Step 2</p>
                        <h3 className="font-medium text-slate-900">Final defense</h3>
                        {finalDefenses.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-500">
                            {paper.finalReportStatus === "approved"
                              ? "Your final report is approved. Your department will schedule your defense slot."
                              : "Your defense is scheduled after your supervisor approves the final report."}
                          </p>
                        ) : (
                          finalDefenses.map((defense) => (
                            <div key={defense.id} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="text-slate-800">
                                  {formatDate(defense.defenseDate)}{defense.scheduledTime ? ` at ${defense.scheduledTime.slice(0, 5)}` : ""}{defense.location ? ` · ${defense.location}` : ""}
                                </p>
                                <StatusBadge status={defense.submissionConfirmed ? defense.currentStatus : "awaiting_thesis"} label={defense.submissionConfirmed ? (defense.currentStatus === "pending" ? "Thesis submitted" : formatStatus(defense.currentStatus)) : "Awaiting thesis"} />
                              </div>
                              {defense.panelNames.length > 0 && <p className="mt-1 text-xs text-slate-500">Panel: {defense.panelNames.join(", ")}</p>}
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                                <DocumentLinks kind="defenses" entityId={defense.id} filename={defense.originalFilename} fallbackName="final-thesis.pdf" onError={showError} />
                                {!defense.submissionConfirmed && (
                                  <button type="button" onClick={() => { resetForm(); setThesisDefense(defense); }} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                                    <Send size={14} aria-hidden="true" /> Submit final thesis
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </li>
                    </ol>
                  </>
                )
              )}
            </section>
          )}
        </div>
      </div>

      {proposalForm && (
        <Modal
          title={proposalForm.id ? "Edit proposal" : "New proposal"}
          subtitle="Save a draft while you work, then submit it for review with the PDF attached."
          onClose={closeForms}
        >
          <form onSubmit={saveProposal} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Title
              <input required value={proposalForm.title} onChange={(event) => setProposalForm({ ...proposalForm, title: event.target.value })} className={inputClass} />
            </label>
            {!proposalForm.id && !isGroupLevel && profile?.degreeLevel && (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                {profile.degreeLevel === "phd" ? "PhD" : "Master's"} proposals are individual, so you'll submit this proposal on your own.
              </p>
            )}
            {!proposalForm.id && isGroupLevel && (
              <label className="block text-sm font-medium text-slate-700">
                Group members <span className="font-normal text-slate-500">(up to 2)</span>
                <select
                  multiple
                  value={proposalForm.memberIds}
                  onChange={(event) => setProposalForm({ ...proposalForm, memberIds: Array.from(event.target.selectedOptions, (option) => option.value).slice(0, 2) })}
                  className={`${inputClass} h-24`}
                >
                  {availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {proposalForm.memberIds.length}/2 selected. Invited members must accept before the proposal can be submitted.
                </span>
              </label>
            )}
            <DocumentField
              label="Proposal document"
              existingFilename={editingProposal?.originalFilename ?? null}
              onView={editingProposal ? () => void viewDocumentFile("proposals", editingProposal.id).catch((viewError: unknown) => setFormError(errorMessage(viewError, "Unable to open the document."))) : undefined}
              file={formFile}
              onChange={setFormFile}
              required={false}
            />
            {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
            <FormActions onCancel={closeForms} busy={isSaving} draftLabel="Save draft" submitLabel="Submit for review" onIntent={(intent) => { submitIntent.current = intent; }} />
          </form>
        </Modal>
      )}

      {feedbackProposal && (
        <Modal title="Address feedback" subtitle={feedbackProposal.title} onClose={closeForms}>
          {feedbackProposal.reviewComment && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{feedbackProposal.reviewedByName ? `${feedbackProposal.reviewedByName}: ` : ""}"{feedbackProposal.reviewComment}"</p>
          )}
          <form onSubmit={submitFeedback} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              What did you change?
              <textarea required rows={4} value={feedbackResponse} onChange={(event) => setFeedbackResponse(event.target.value)} placeholder="Explain how you addressed your supervisor's feedback..." className={inputClass} />
            </label>
            <DocumentField
              label="Revised proposal document (optional)"
              existingFilename={feedbackProposal.originalFilename}
              onView={() => void viewDocumentFile("proposals", feedbackProposal.id).catch((viewError: unknown) => setFormError(errorMessage(viewError, "Unable to open the document.")))}
              file={formFile}
              onChange={setFormFile}
              required={false}
            />
            {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
            <FormActions onCancel={closeForms} busy={isSaving} submitLabel="Send to supervisor" onIntent={(intent) => { submitIntent.current = intent; }} />
          </form>
        </Modal>
      )}

      {reportForm && (
        <Modal
          title={reportForm.report ? (reportForm.report.status === "changes_requested" ? "Revise progress report" : "Submit progress report") : "New progress report"}
          subtitle={reportForm.report?.phaseLabel ?? newReportPhaseLabel ?? undefined}
          onClose={closeForms}
        >
          {reportForm.report?.reviewComment && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{reportForm.report.reviewedByName ? `${reportForm.report.reviewedByName}: ` : ""}"{reportForm.report.reviewComment}"</p>
          )}
          {!reportForm.report && newReportPhaseLabel === openProgressPhase?.label && openProgressPhase?.deadlineAt && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600"><CalendarClock size={16} aria-hidden="true" /> Deadline: {formatDateTime(openProgressPhase.deadlineAt)}</p>
          )}
          <form onSubmit={saveProgressReport} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Progress summary
              <textarea required rows={5} value={reportForm.content} onChange={(event) => setReportForm({ ...reportForm, content: event.target.value })} placeholder="What have you completed since the last review, and what's next?" className={inputClass} />
            </label>
            <DocumentField
              label="Progress report document"
              existingFilename={reportForm.report?.originalFilename ?? null}
              onView={reportForm.report ? () => void viewDocumentFile("progress-reports", reportForm.report!.id).catch((viewError: unknown) => setFormError(errorMessage(viewError, "Unable to open the document."))) : undefined}
              file={formFile}
              onChange={setFormFile}
              required={false}
            />
            {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
            <FormActions onCancel={closeForms} busy={isSaving} draftLabel={reportForm.report ? undefined : "Save draft"} submitLabel="Submit to supervisor" onIntent={(intent) => { submitIntent.current = intent; }} />
          </form>
        </Modal>
      )}

      {isFinalReportFormOpen && paper && (
        <Modal title={paper.finalReportStatus ? "Resubmit final report" : "Submit final report"} subtitle={paper.title} onClose={closeForms}>
          {paper.finalReportReviewComment && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{paper.finalReportReviewedByName ? `${paper.finalReportReviewedByName}: ` : ""}"{paper.finalReportReviewComment}"</p>
          )}
          <form onSubmit={submitFinalReport} className="mt-4 space-y-4">
            <DocumentField
              label="Final report document"
              existingFilename={paper.finalReportOriginalFilename}
              onView={() => void viewDocumentFile("papers", paper.id).catch((viewError: unknown) => setFormError(errorMessage(viewError, "Unable to open the document.")))}
              file={formFile}
              onChange={setFormFile}
              required
            />
            <p className="text-xs text-slate-500">Your supervisor reviews the final report before your defense can be scheduled.</p>
            {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
            <FormActions onCancel={closeForms} busy={isSaving} submitLabel="Submit final report" onIntent={(intent) => { submitIntent.current = intent; }} />
          </form>
        </Modal>
      )}

      {thesisDefense && (
        <Modal
          title="Submit final thesis"
          subtitle={`Defense on ${formatDate(thesisDefense.defenseDate)}${thesisDefense.scheduledTime ? ` at ${thesisDefense.scheduledTime.slice(0, 5)}` : ""}${thesisDefense.location ? ` · ${thesisDefense.location}` : ""}`}
          onClose={closeForms}
        >
          <form onSubmit={submitThesis} className="mt-4 space-y-4">
            <DocumentField
              label="Final thesis document"
              existingFilename={thesisDefense.originalFilename}
              onView={() => void viewDocumentFile("defenses", thesisDefense.id).catch((viewError: unknown) => setFormError(errorMessage(viewError, "Unable to open the document.")))}
              file={formFile}
              onChange={setFormFile}
              required
            />
            <p className="text-xs text-slate-500">After submitting, the thesis can't be replaced. It goes to your defense panel.</p>
            {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
            <FormActions onCancel={closeForms} busy={isSaving} submitLabel="Submit final thesis" onIntent={(intent) => { submitIntent.current = intent; }} />
          </form>
        </Modal>
      )}

      {groupProposal && (
        <Modal title="Proposal group" subtitle="Invited members must accept before they count toward your group of 2–3." onClose={() => { setGroupProposal(null); setFormError(null); }}>
          <div className="mt-5 space-y-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{groupProposal.submittedByName ?? "Owner"} (owner)</div>
            {groupProposal.groupMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{member.name} {member.status !== "accepted" && <span className="text-xs text-amber-600">({member.status})</span>}</span>
                {groupProposal.submittedBy === currentUserId && <button type="button" onClick={() => void removeMember(groupProposal, member.id)} className="text-sm text-red-600 hover:text-red-700">Remove</button>}
              </div>
            ))}
            {groupProposal.submittedBy === currentUserId && (
              <div className="flex gap-2">
                <select value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Select a department student</option>
                  {availableMembers.filter((member) => !groupProposal.groupMembers.some((selected) => selected.id === member.id)).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
                <button type="button" disabled={!selectedMember || groupProposal.groupMembers.length >= 2} onClick={() => void addMember()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Send invite</button>
              </div>
            )}
            {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
            <button type="button" onClick={() => { setGroupProposal(null); setFormError(null); }} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium">Done</button>
          </div>
        </Modal>
      )}

      {historyProposal && (
        <Modal title="Submission history" subtitle={historyProposal.title} onClose={() => setHistoryProposal(null)}>
          {history.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No recorded submissions yet.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {history.map((item) => (
                <li key={item.id} className="border-l-2 border-blue-200 pl-3 text-sm">
                  <p className="font-medium capitalize text-slate-800">{formatStatus(item.entityType)} · {formatStatus(item.status)}</p>
                  <p className="text-xs text-slate-500">{item.phaseLabel ?? "Unscheduled phase"} · {formatDateTime(item.createdAt)}</p>
                  <p className="text-xs text-slate-600">{item.reviewedByName ? `Reviewed by ${item.reviewedByName}` : `Submitted by ${item.submittedByName ?? "student"}`}{item.comments ? ` · ${item.comments}` : ""}</p>
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}
    </div>
  );
}

export default StudentDashboard;
