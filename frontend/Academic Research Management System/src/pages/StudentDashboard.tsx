import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  Eye,
  Circle,
  FileText,
  Flag,
  GraduationCap,
  History,
  Home,
  Hourglass,
  NotebookPen,
  Pencil,
  Send,
  Users,
  X,
} from "lucide-react";
import { gql } from "@apollo/client";
import { print } from "graphql";
import AppShell, { type NavItem } from "../components/AppShell";
import DefenseNotice from "../components/DefenseNotice";
import DefenseCard, { type DefenseDetails } from "../components/DefenseCard";
import {
  BlockedReason,
  Card,
  DocumentActions,
  EmptyState,
  FormError,
  Modal,
  ProfileCard,
  SectionHeader,
  StatusBadge,
} from "../components/ui";
import { useSection } from "../hooks/useSection";
import { useToast } from "../hooks/useToast";
import { isPastDefense } from "../utils/defenses";
import {
  errorMessage,
  formatDate,
  formatDateTime,
  formatStatus,
  inputClass,
  primaryButtonClass,
  smallPrimaryButtonClass,
  smallSecondaryButtonClass,
} from "../utils/format";
import { resolveAvatarUrl, uploadAvatarImage } from "../utils/uploadAvatar";
import { uploadDocumentFile, viewDocumentFile } from "../utils/proposalFile";
import {
  PROPOSAL_SUBMISSION_HISTORY_QUERY,
  RESEARCH_PHASES_QUERY,
} from "../queries/queries";

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
interface Student {
  id: string;
  name: string;
}
interface Invite {
  proposalId: string;
  title: string;
  ownerName: string;
  status: string;
}
interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}
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
  phaseId: string | null;
  phaseLabel: string | null;
  phaseSequenceNumber: number | null;
  deadlineAt: string | null;
}
// The backend's answer to "may I start the next report, and which round is it?",
// so the dashboard never has to re-derive the timeline rules.
interface Eligibility {
  canStart: boolean;
  reason: string | null;
  phaseId: string | null;
  phaseLabel: string | null;
  sequenceNumber: number | null;
  deadlineAt: string | null;
  defenseDate: string | null;
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
  // pending | open | closed. A round only takes work once the department opens it.
  status: string;
}
interface SubmissionHistoryItem {
  id: string;
  entityType: string;
  phaseLabel: string | null;
  submittedByName: string | null;
  status: string;
  reviewedByName: string | null;
  comments: string | null;
  originalFilename: string | null;
  createdAt: string;
}
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

const SECTIONS = [
  "home",
  "proposal",
  "progress",
  "final",
  "defenses",
  "profile",
] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_TITLES: Record<Section, string> = {
  home: "Home",
  proposal: "Research proposal",
  progress: "Progress reports",
  final: "Final submission",
  defenses: "Defenses",
  profile: "My profile",
};
type SubmitIntent = "draft" | "submit";
const sentenceCase = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
const APPROVED = ["approved", "accepted"];

const ENDPOINT = import.meta.env.VITE_API_URL
const MY_PROPOSALS = gql`
  query MyProposals {
    myProposals {
      id
      title
      status
      supervisorName
      groupMembers {
        id
        name
        status
      }
      reviewComment
      reviewedByName
      submittedBy
      submittedByName
      studentResponse
      respondedByName
      deletedAt
      deletedByName
      originalFilename
      fileSizeBytes
      uploadedAt
    }
  }
`;
const AVAILABLE_MEMBERS = gql`
  query AvailableGroupMembers {
    availableGroupMembers {
      id
      name
    }
  }
`;
const CURRENT_USER = gql`
  query CurrentUser {
    currentUser {
      id
      name
      email
      avatarUrl
    }
  }
`;
const MY_PROFILE = gql`
  query MyStudentProfile {
    myStudentProfile {
      name
      email
      avatarUrl
      departmentName
      degreeProgramName
      supervisorName
      status
      rollNumber
      degreeLevel
    }
  }
`;
const MY_INVITES = gql`
  query MyProposalInvites {
    myProposalInvites {
      proposalId
      title
      ownerName
      status
    }
  }
`;
const CREATE_PROPOSAL = gql`
  mutation CreateProposal($studentInput: ProposalsInput!) {
    createProposalByUser(studentInput: $studentInput) {
      id
      title
      status
    }
  }
`;
const UPDATE_PROPOSAL = gql`
  mutation UpdateProposal($studentInput: ProposalUpdateInput!) {
    updateProposalByUser(studentInput: $studentInput) {
      id
      title
      status
    }
  }
`;
const ADD_MEMBER = gql`
  mutation AddMember($studentInput: ProposalCandidatesMutation!) {
    createProposalCandidate(studentInput: $studentInput) {
      proposalId
      studentId
      status
    }
  }
`;
const REMOVE_MEMBER = gql`
  mutation RemoveMember($studentInput: ProposalMemberDeleteInput!) {
    deleteProposalCandidate(studentInput: $studentInput) {
      proposalId
      studentId
    }
  }
`;
const RESPOND_INVITE = gql`
  mutation RespondInvite($studentInput: ProposalInviteResponseInput!) {
    respondToProposalInvite(studentInput: $studentInput) {
      proposalId
      status
    }
  }
`;
const RESPOND_TO_FEEDBACK = gql`
  mutation RespondToProposalFeedback(
    $studentInput: ProposalFeedbackResponseInput!
  ) {
    respondToProposalFeedback(studentInput: $studentInput) {
      id
      status
      studentResponse
    }
  }
`;
const MY_PAPER = gql`
  query MyPaper {
    myPaper {
      id
      title
      status
      supervisorName
      finalReportStatus
      finalReportReviewComment
      finalReportReviewedByName
      finalReportOriginalFilename
      finalReportUploadedAt
    }
  }
`;
const MY_PROGRESS_REPORTS = gql`
  query MyProgressReports {
    myProgressReports {
      id
      content
      status
      submittedAt
      originalFilename
      reviewComment
      reviewedByName
      phaseId
      phaseLabel
      phaseSequenceNumber
      deadlineAt
    }
  }
`;
const MY_ELIGIBILITY = gql`
  query MySubmissionEligibility {
    myProgressReportEligibility {
      canStart
      reason
      phaseId
      phaseLabel
      sequenceNumber
      deadlineAt
      defenseDate
    }
    myFinalReportEligibility {
      canStart
      reason
      phaseId
      phaseLabel
      sequenceNumber
      deadlineAt
      defenseDate
    }
  }
`;
const MY_DEFENSES = gql`
  query MyDefenses {
    myDefenses {
      id
      kind
      proposalId
      progressReportId
      paperId
      paperTitle
      phaseLabel
      defenseDate
      scheduledTime
      location
      submissionConfirmed
      originalFilename
      currentStatus
      degreeLevel
      studentNames
      supervisorName
      panelNames
      reportDocumentKind
      reportDocumentId
      reportFilename
      outcomeComments
      outcomeRecordedAt
      outcomeRecordedByName
      requiresRedefense
      hasEnded
    }
  }
`;
const CREATE_PROGRESS_REPORT = gql`
  mutation CreateProgressReport($studentInput: ProgressReportInput!) {
    createProgressReport(studentInput: $studentInput) {
      id
      status
    }
  }
`;
const SUBMIT_PROGRESS_REPORT = gql`
  mutation SubmitProgressReport($studentInput: ProgressReportIdInput!) {
    submitProgressReport(studentInput: $studentInput) {
      id
      status
    }
  }
`;
const SUBMIT_FINAL_REPORT = gql`
  mutation SubmitFinalReport {
    submitFinalReport {
      id
      finalReportStatus
    }
  }
`;
const CONFIRM_DEFENSE_SUBMISSION = gql`
  mutation ConfirmDefenseSubmission($studentInput: DefenseIdInput!) {
    confirmDefenseSubmission(studentInput: $studentInput) {
      id
      submissionConfirmed
    }
  }
`;

async function request<T>(
  query: ReturnType<typeof gql>,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}`,
    },
    body: JSON.stringify({ query: print(query), variables }),
  });
  const result = (await response.json()) as GraphQLResult<T>;
  if (!response.ok || result.errors?.length)
    throw new Error(result.errors?.[0]?.message ?? "Request failed.");
  if (!result.data) throw new Error("The server returned no data.");
  return result.data;
}

// The phase a new submission would land in: the backend walks the series in order
// and picks the earliest open round, so this matches it.
function openPhaseOf(
  phases: ResearchPhase[],
  phaseType: string,
): ResearchPhase | null {
  const open = phases.filter(
    (phase) => phase.phaseType === phaseType && phase.isOpen,
  );
  return (
    open.sort(
      (first, second) => first.sequenceNumber - second.sequenceNumber,
    )[0] ?? null
  );
}

// When a round of the series the student hasn't filed in yet opens or closes.
function roundWindowText(phase: ResearchPhase): string {
  if (phase.opensAt && new Date(phase.opensAt).getTime() > Date.now())
    return `Opens ${formatDateTime(phase.opensAt)}`;
  if (phase.deadlineAt) return `Deadline ${formatDateTime(phase.deadlineAt)}`;
  return "No dates set";
}

function phaseNotice(
  phases: ResearchPhase[],
  phaseType: string,
  noun: string,
): { text: string; tone: "open" | "closed" } {
  if (phaseType === "defense") {
    const defense = openPhaseOf(phases, "defense");
    return defense?.defenseDate
      ? {
          text: `${defense.label}: defense day ${formatDate(defense.defenseDate)}`,
          tone: "open",
        }
      : {
          text: "Your department hasn't scheduled the final defense yet.",
          tone: "closed",
        };
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
    .filter(
      (phase) =>
        phase.phaseType === phaseType &&
        phase.opensAt &&
        new Date(phase.opensAt).getTime() > Date.now(),
    )
    .sort(
      (first, second) =>
        new Date(first.opensAt!).getTime() -
        new Date(second.opensAt!).getTime(),
    )[0];
  if (upcoming?.opensAt)
    return {
      text: `${upcoming.label} opens ${formatDateTime(upcoming.opensAt)}`,
      tone: "closed",
    };
  return phases.some((phase) => phase.phaseType === phaseType)
    ? { text: `No ${noun} phase is open right now.`, tone: "closed" }
    : {
        text: `Your department hasn't scheduled a ${noun} phase for your degree level yet.`,
        tone: "closed",
      };
}

function PhaseNotice({
  notice,
}: {
  notice: { text: string; tone: "open" | "closed" };
}) {
  return (
    <p
      className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${notice.tone === "open" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
    >
      <CalendarClock size={16} aria-hidden="true" className="shrink-0" />
      {notice.text}
    </p>
  );
}

// One round of the progress series the student has filed something in.
function ProgressRoundCard({
  heading,
  report,
  defenses,
  onOpen,
  onError,
}: {
  heading: string;
  report: ProgressReport;
  defenses: Defense[];
  onOpen: (report: ProgressReport) => void;
  onError: (message: string) => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-slate-900">{heading}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Started {formatDate(report.submittedAt)}
            {report.deadlineAt
              ? ` · deadline ${formatDateTime(report.deadlineAt)}`
              : ""}
          </p>
        </div>
        <StatusBadge status={report.status} />
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
        {report.content}
      </p>
      {report.reviewComment && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {report.reviewedByName ? `${report.reviewedByName}: ` : ""}"
          {report.reviewComment}"
        </p>
      )}
      {defenses
        .filter((defense) => defense.progressReportId === report.id)
        .map((defense) => (
          <DefenseNotice key={defense.id} defense={defense} />
        ))}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <DocumentActions
          kind="progress-reports"
          entityId={report.id}
          filename={report.originalFilename}
          fallbackName="progress-report.pdf"
          onError={onError}
        />
        {(report.status === "draft" ||
          report.status === "changes_requested") && (
          <button
            type="button"
            onClick={() => onOpen(report)}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Send size={14} aria-hidden="true" />{" "}
            {report.status === "draft"
              ? "Continue & submit"
              : "Revise & resubmit"}
          </button>
        )}
      </div>
    </article>
  );
}

// PDF picker that shows the document already on file, if any.
function DocumentField({
  label,
  existingFilename,
  onView,
  file,
  onChange,
  required,
}: {
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
          <span className="flex min-w-0 items-center gap-2 text-slate-600">
            <FileText size={15} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{existingFilename}</span>
          </span>
          {onView && (
            <button
              type="button"
              onClick={onView}
              className="inline-flex shrink-0 items-center gap-1 text-blue-700 hover:underline"
            >
              <Eye size={14} aria-hidden="true" /> View
            </button>
          )}
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
        PDF, up to 20 MB.
        {existingFilename ? " Choosing a file replaces the current one." : ""}
        {file ? ` Selected: ${file.name}` : ""}
      </span>
    </div>
  );
}

function FormActions({
  onCancel,
  busy,
  draftLabel,
  submitLabel,
  onIntent,
}: {
  onCancel: () => void;
  busy: boolean;
  draftLabel?: string;
  submitLabel: string;
  onIntent: (intent: SubmitIntent) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Cancel
      </button>
      {draftLabel && (
        <button
          type="submit"
          disabled={busy}
          onClick={() => onIntent("draft")}
          className="rounded-lg border border-blue-300 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
        >
          {draftLabel}
        </button>
      )}
      <button
        type="submit"
        disabled={busy}
        onClick={() => onIntent("submit")}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        <Send size={15} aria-hidden="true" />
        {busy ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

function StudentDashboard() {
  const toast = useToast();
  const [section, goTo] = useSection(SECTIONS, "home");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [availableMembers, setAvailableMembers] = useState<Student[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [defenses, setDefenses] = useState<Defense[]>([]);
  const [researchPhases, setResearchPhases] = useState<ResearchPhase[]>([]);
  const [progressEligibility, setProgressEligibility] =
    useState<Eligibility | null>(null);
  const [finalEligibility, setFinalEligibility] = useState<Eligibility | null>(
    null,
  );
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  // Only a failed page load stays on screen; everything else is a toast.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // One open form at a time; each keeps its own error so failures show inside the dialog.
  const submitIntent = useRef<SubmitIntent>("submit");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formFile, setFormFile] = useState<File | null>(null);

  const [proposalForm, setProposalForm] = useState<{
    id: string | null;
    title: string;
    memberIds: string[];
  } | null>(null);
  const [feedbackProposal, setFeedbackProposal] = useState<Proposal | null>(
    null,
  );
  const [feedbackResponse, setFeedbackResponse] = useState("");
  const [groupProposal, setGroupProposal] = useState<Proposal | null>(null);
  const [selectedMember, setSelectedMember] = useState("");
  const [historyProposal, setHistoryProposal] = useState<Proposal | null>(null);
  const [history, setHistory] = useState<SubmissionHistoryItem[]>([]);
  const [reportForm, setReportForm] = useState<{
    report: ProgressReport | null;
    content: string;
  } | null>(null);
  const [isFinalReportFormOpen, setIsFinalReportFormOpen] = useState(false);
  const [thesisDefense, setThesisDefense] = useState<Defense | null>(null);

  const currentUserId = currentUser?.id ?? null;

  const loadResearch = async () => {
    try {
      const [
        proposalResult,
        membersResult,
        invitesResult,
        paperResult,
        reportsResult,
        defensesResult,
        phasesResult,
        eligibilityResult,
      ] = await Promise.all([
        request<{ myProposals: Proposal[] }>(MY_PROPOSALS),
        request<{ availableGroupMembers: Student[] }>(AVAILABLE_MEMBERS),
        request<{ myProposalInvites: Invite[] }>(MY_INVITES),
        request<{ myPaper: Paper | null }>(MY_PAPER),
        request<{ myProgressReports: ProgressReport[] }>(MY_PROGRESS_REPORTS),
        request<{ myDefenses: Defense[] }>(MY_DEFENSES),
        request<{ researchPhases: ResearchPhase[] }>(RESEARCH_PHASES_QUERY),
        request<{
          myProgressReportEligibility: Eligibility;
          myFinalReportEligibility: Eligibility;
        }>(MY_ELIGIBILITY),
      ]);
      setProposals(proposalResult.myProposals);
      setAvailableMembers(membersResult.availableGroupMembers);
      setInvites(invitesResult.myProposalInvites);
      setPaper(paperResult.myPaper);
      setProgressReports(reportsResult.myProgressReports);
      setDefenses(defensesResult.myDefenses);
      setResearchPhases(phasesResult.researchPhases);
      setProgressEligibility(eligibilityResult.myProgressReportEligibility);
      setFinalEligibility(eligibilityResult.myFinalReportEligibility);
      setLoadError(null);
    } catch (requestError) {
      setLoadError(
        errorMessage(requestError, "Unable to load your research space."),
      );
    } finally {
      setIsLoaded(true);
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
        toast.error(errorMessage(requestError, "Unable to load your profile."));
      }
    };
    void initialize();
  }, [toast]);

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
  const runSubmission = async (
    steps: () => Promise<string>,
    fallback: string,
  ) => {
    setFormError(null);
    setIsSaving(true);
    try {
      const doneMessage = await steps();
      closeForms();
      toast.success(doneMessage);
    } catch (submissionError) {
      setFormError(errorMessage(submissionError, fallback));
    } finally {
      setIsSaving(false);
      await loadResearch();
    }
  };

  const openProposalForm = (proposal: Proposal | null) => {
    resetForm();
    setProposalForm({
      id: proposal?.id ?? null,
      title: proposal?.title ?? "",
      memberIds: [],
    });
  };

  const saveProposal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!proposalForm) return;
    const submit = submitIntent.current === "submit";
    const existing =
      proposals.find((proposal) => proposal.id === proposalForm.id) ?? null;
    if (submit && !formFile && !existing?.originalFilename) {
      setFormError("Attach the proposal PDF before submitting.");
      return;
    }
    await runSubmission(async () => {
      let proposalId = proposalForm.id;
      const title = proposalForm.title.trim();
      if (!proposalId) {
        const created = await request<{ createProposalByUser: { id: string } }>(
          CREATE_PROPOSAL,
          { studentInput: { title, status: "draft" } },
        );
        proposalId = created.createProposalByUser.id;
        // Keep the id so a retry after a later failure updates this draft instead of creating another.
        setProposalForm((current) =>
          current ? { ...current, id: proposalId } : current,
        );
        for (const studentId of proposalForm.memberIds) {
          await request(ADD_MEMBER, {
            studentInput: { proposalId, studentId },
          });
        }
      } else {
        await request(UPDATE_PROPOSAL, {
          studentInput: { id: proposalId, title, status: "draft" },
        });
      }
      if (formFile) await uploadDocumentFile("proposals", proposalId, formFile);
      if (!submit) return "Proposal saved as a draft.";
      if (proposalForm.memberIds.length > 0 && !proposalForm.id) {
        return "Proposal saved as a draft. Submit it once your invited group members have accepted.";
      }
      await request(UPDATE_PROPOSAL, {
        studentInput: { id: proposalId, title, status: "submitted" },
      });
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
      if (formFile)
        await uploadDocumentFile("proposals", feedbackProposal.id, formFile);
      await request(RESPOND_TO_FEEDBACK, {
        studentInput: {
          proposalId: feedbackProposal.id,
          response: feedbackResponse.trim(),
        },
      });
      return "Revised proposal sent back to your supervisor.";
    }, "Unable to send your response.");
  };

  const openReportForm = (report: ProgressReport | null) => {
    resetForm();
    setReportForm({ report, content: report?.content ?? "" });
  };

  const saveProgressReport = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
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
        const created = await request<{ createProgressReport: { id: string } }>(
          CREATE_PROGRESS_REPORT,
          { studentInput: { content } },
        );
        reportId = created.createProgressReport.id;
        const createdReport: ProgressReport = {
          id: reportId,
          content,
          status: "draft",
          submittedAt: new Date().toISOString(),
          originalFilename: null,
          reviewComment: null,
          reviewedByName: null,
          phaseId: null,
          phaseLabel: null,
          phaseSequenceNumber: null,
          deadlineAt: null,
        };
        setReportForm((current) =>
          current ? { ...current, report: createdReport } : current,
        );
      }
      if (formFile)
        await uploadDocumentFile("progress-reports", reportId, formFile);
      if (!submit) return "Progress report saved as a draft.";
      await request(SUBMIT_PROGRESS_REPORT, {
        studentInput: { id: reportId, content },
      });
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
      if (formFile)
        await uploadDocumentFile("defenses", thesisDefense.id, formFile);
      await request(CONFIRM_DEFENSE_SUBMISSION, {
        studentInput: { id: thesisDefense.id },
      });
      return "Final thesis submitted for your defense.";
    }, "Unable to submit the final thesis.");
  };

  const addMember = async () => {
    if (!groupProposal || !selectedMember) return;
    setFormError(null);
    try {
      await request(ADD_MEMBER, {
        studentInput: {
          proposalId: groupProposal.id,
          studentId: selectedMember,
        },
      });
      setSelectedMember("");
      setGroupProposal(null);
      toast.success("Group invite sent.");
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
      await request(REMOVE_MEMBER, {
        studentInput: { proposalId: proposal.id, studentId },
      });
      setGroupProposal(null);
      await loadResearch();
    } catch (requestError) {
      setFormError(
        errorMessage(requestError, "Unable to remove group member."),
      );
    }
  };

  const showHistory = async (proposal: Proposal) => {
    try {
      const result = await request<{
        proposalSubmissionHistory: SubmissionHistoryItem[];
      }>(PROPOSAL_SUBMISSION_HISTORY_QUERY, { proposalId: proposal.id });
      setHistory(result.proposalSubmissionHistory);
      setHistoryProposal(proposal);
    } catch (requestError) {
      toast.error(
        errorMessage(requestError, "Unable to load submission history."),
      );
    }
  };

  const respondToInvite = async (
    proposalId: string,
    response: "accepted" | "rejected",
  ) => {
    try {
      await request(RESPOND_INVITE, {
        studentInput: { proposalId, status: response },
      });
      toast.success(
        response === "accepted"
          ? "You joined the group."
          : "Invite declined.",
      );
      await loadResearch();
    } catch (requestError) {
      toast.error(errorMessage(requestError, "Unable to respond to the invite."));
    }
  };

  const handleUploadAvatar = async (file: File) => {
    setIsUploadingAvatar(true);
    try {
      const avatarUrl = await uploadAvatarImage(file);
      setCurrentUser((current) =>
        current ? { ...current, avatarUrl } : current,
      );
      setProfile((current) => (current ? { ...current, avatarUrl } : current));
      toast.success("Profile photo updated.");
    } catch (uploadError) {
      toast.error(errorMessage(uploadError, "Unable to upload image."));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const showError = (message: string) => toast.error(message);
  const proposalNotice = phaseNotice(researchPhases, "proposal", "proposal");
  const progressNotice = phaseNotice(
    researchPhases,
    "progress_report",
    "progress report",
  );
  const defenseNotice = phaseNotice(researchPhases, "defense", "final defense");
  // Only Bachelor's research is group work; Master's and PhD proposals are individual.
  const isGroupLevel = profile?.degreeLevel === "bachelors";
  const hasActiveProposal = proposals.some(
    (proposal) =>
      !proposal.deletedAt &&
      proposal.status !== "rejected" &&
      proposal.status !== "withdrawn",
  );
  // A rejection never locks a student out: they can start a replacement, even after the phase closed.
  const hasRejectedProposal = proposals.some(
    (proposal) => proposal.status === "rejected",
  );
  const canStartProposal =
    !hasActiveProposal &&
    (proposalNotice.tone === "open" || hasRejectedProposal);
  // Every round of the series in timeline order, each with the student's report for it.
  const progressRounds = researchPhases
    .filter((phase) => phase.phaseType === "progress_report")
    .sort((first, second) => first.sequenceNumber - second.sequenceNumber)
    .map((phase) => ({
      phase,
      // A round can hold a rejected attempt and its replacement; the live one is shown.
      report:
        progressReports.find(
          (item) => item.phaseId === phase.id && item.status !== "rejected",
        ) ??
        progressReports.find((item) => item.phaseId === phase.id) ??
        null,
    }));
  // Earlier attempts a replacement superseded, and reports whose round the admin has
  // since removed from the timeline — both stay on the student's record.
  const earlierAttempts = progressReports.filter(
    (report) => !progressRounds.some((round) => round.report?.id === report.id),
  );
  const newReportPhaseLabel = progressEligibility?.canStart
    ? progressEligibility.phaseLabel
    : null;
  const canStartReport = progressEligibility?.canStart ?? false;
  const finalDefenses = defenses.filter(
    (defense) => defense.kind === "defense",
  );
  const canSubmitFinalReport =
    paper !== null &&
    (!paper.finalReportStatus ||
      paper.finalReportStatus === "changes_requested" ||
      paper.finalReportStatus === "rejected");
  const editingProposal = proposalForm?.id
    ? (proposals.find((proposal) => proposal.id === proposalForm.id) ?? null)
    : null;

  // Accepted members (and the owner) may work on a proposal; a deleted one is read-only.
  const canActOn = (proposal: Proposal) =>
    !proposal.deletedAt &&
    (proposal.submittedBy === currentUserId ||
      proposal.groupMembers.some(
        (member) => member.id === currentUserId && member.status === "accepted",
      ));
  const activeProposal =
    proposals.find(
      (proposal) =>
        !proposal.deletedAt &&
        proposal.status !== "rejected" &&
        proposal.status !== "withdrawn",
    ) ?? null;
  const proposalNeedingChanges = proposals.find(
    (proposal) =>
      proposal.status === "changes_requested" && canActOn(proposal),
  );
  const draftProposal = proposals.find(
    (proposal) => proposal.status === "draft" && canActOn(proposal),
  );
  const reportNeedingWork = progressReports.find(
    (report) =>
      report.status === "draft" || report.status === "changes_requested",
  );
  const thesisDue = finalDefenses.find(
    (defense) =>
      !defense.submissionConfirmed && defense.currentStatus === "pending",
  );
  const approvedRounds = progressRounds.filter(
    (round) => round.report && APPROVED.includes(round.report.status),
  ).length;
  const finalDefenseAccepted = finalDefenses.some(
    (defense) => defense.currentStatus === "accepted",
  );
  const upcomingDefenses = [...defenses]
    .filter(
      (defense) =>
        !isPastDefense(defense) && defense.currentStatus === "pending",
    )
    .sort(
      (first, second) =>
        new Date(first.defenseDate).getTime() -
        new Date(second.defenseDate).getTime(),
    );
  const timeline = [...researchPhases].sort(
    (first, second) => first.sequenceNumber - second.sequenceNumber,
  );

  // The research journey as four steps. The first one that isn't done is where the student is.
  const stepDone = {
    proposal: paper !== null,
    progress:
      paper !== null &&
      (paper.finalReportStatus !== null ||
        (progressRounds.length > 0 &&
          approvedRounds === progressRounds.length)),
    final: paper?.finalReportStatus === "approved",
    defenses: finalDefenseAccepted,
  };
  const currentStep = (
    ["proposal", "progress", "final", "defenses"] as const
  ).find((key) => !stepDone[key]);
  const steps: { key: Section; label: string; detail: string; done: boolean }[] =
    [
      {
        key: "proposal",
        label: "Proposal",
        done: stepDone.proposal,
        detail: stepDone.proposal
          ? "Approved"
          : activeProposal
            ? formatStatus(activeProposal.status)
            : "Not started",
      },
      {
        key: "progress",
        label: "Progress reports",
        done: stepDone.progress,
        detail:
          progressRounds.length > 0
            ? `${approvedRounds} of ${progressRounds.length} approved`
            : "No rounds scheduled yet",
      },
      {
        key: "final",
        label: "Final report",
        done: stepDone.final,
        detail: paper?.finalReportStatus
          ? formatStatus(paper.finalReportStatus)
          : "Not submitted",
      },
      {
        key: "defenses",
        label: "Final defense",
        done: stepDone.defenses,
        detail: finalDefenseAccepted
          ? "Defended"
          : finalDefenses.length > 0
            ? `Scheduled ${formatDate(finalDefenses[0].defenseDate)}`
            : "Not scheduled",
      },
    ];

  // The single most useful thing the student can do now, or what they're waiting on.
  type NextStep = {
    title: string;
    description?: string | null;
    actionLabel?: string;
    onAction?: () => void;
    waiting?: boolean;
  };
  const nextStep: NextStep = (() => {
    if (invites.length > 0)
      return {
        title: "You've been invited to join a research group",
        description: `${invites[0].ownerName} invited you to join "${invites[0].title}".`,
        actionLabel: "Respond to invite",
        onAction: () => goTo("proposal"),
      };
    if (proposalNeedingChanges)
      return {
        title: "Your supervisor asked for changes to your proposal",
        description: proposalNeedingChanges.reviewComment
          ? `"${proposalNeedingChanges.reviewComment}"`
          : null,
        actionLabel: "Address feedback",
        onAction: () => openFeedbackForm(proposalNeedingChanges),
      };
    if (draftProposal)
      return {
        title: "Finish and submit your proposal",
        description: `"${draftProposal.title}" is saved as a draft.`,
        actionLabel: "Continue & submit",
        onAction: () => openProposalForm(draftProposal),
      };
    if (!activeProposal)
      return canStartProposal
        ? {
            title: "Write your research proposal",
            description: proposalNotice.text,
            actionLabel: "New proposal",
            onAction: () => openProposalForm(null),
          }
        : {
            title: "Proposal submissions aren't open yet",
            description: proposalNotice.text,
            waiting: true,
          };
    if (!paper)
      return {
        title: "Your proposal is being reviewed",
        description: activeProposal.supervisorName
          ? `${activeProposal.supervisorName} is reviewing "${activeProposal.title}".`
          : "Your department will assign a supervisor to review it.",
        waiting: true,
      };
    if (reportNeedingWork)
      return {
        title:
          reportNeedingWork.status === "draft"
            ? "Finish your progress report"
            : "Revise your progress report",
        description:
          reportNeedingWork.reviewComment
            ? `"${reportNeedingWork.reviewComment}"`
            : (reportNeedingWork.phaseLabel ?? null),
        actionLabel:
          reportNeedingWork.status === "draft"
            ? "Continue & submit"
            : "Revise & resubmit",
        onAction: () => openReportForm(reportNeedingWork),
      };
    if (thesisDue)
      return {
        title: "Submit your final thesis",
        description: `Your final defense is on ${formatDate(thesisDue.defenseDate)}.`,
        actionLabel: "Submit final thesis",
        onAction: () => {
          resetForm();
          setThesisDefense(thesisDue);
        },
      };
    if (progressEligibility?.canStart)
      return {
        title: `Start ${progressEligibility.phaseLabel ?? "your next progress report"}`,
        description: progressEligibility.deadlineAt
          ? `Deadline: ${formatDateTime(progressEligibility.deadlineAt)}`
          : null,
        actionLabel: "Start report",
        onAction: () => openReportForm(null),
      };
    if (canSubmitFinalReport && finalEligibility?.canStart)
      return {
        title: paper.finalReportStatus
          ? "Resubmit your final report"
          : "Submit your final report",
        description: paper.finalReportReviewComment
          ? `"${paper.finalReportReviewComment}"`
          : "Your supervisor reviews it before your final defense is scheduled.",
        actionLabel: "Submit final report",
        onAction: () => {
          resetForm();
          setIsFinalReportFormOpen(true);
        },
      };
    if (finalDefenseAccepted)
      return {
        title: "Congratulations, your research is complete",
        description: "Your final defense was accepted.",
        waiting: true,
      };
    if (paper.finalReportStatus === "submitted")
      return {
        title: "Your final report is being reviewed",
        description: `${paper.supervisorName ?? "Your supervisor"} will review it.`,
        waiting: true,
      };
    if (paper.finalReportStatus === "approved")
      return {
        title: upcomingDefenses.length
          ? "Prepare for your final defense"
          : "Your final defense will be scheduled soon",
        description: upcomingDefenses.length
          ? `On ${formatDate(upcomingDefenses[0].defenseDate)}.`
          : "Your department plans the date and panel.",
        waiting: true,
      };
    if (progressReports.some((report) => report.status === "submitted"))
      return {
        title: "Your progress report is being reviewed",
        description: `${paper.supervisorName ?? "Your supervisor"} will review it.`,
        waiting: true,
      };
    return {
      title: "Nothing to do right now",
      description:
        progressEligibility?.reason ??
        finalEligibility?.reason ??
        "You'll be notified when the next phase opens.",
      waiting: true,
    };
  })();

  const nav: NavItem[] = [
    { key: "home", label: "Home", icon: Home },
    {
      key: "proposal",
      label: "Proposal",
      icon: NotebookPen,
      badge:
        proposals.filter((proposal) => proposal.status === "changes_requested")
          .length + invites.length,
    },
    {
      key: "progress",
      label: "Progress reports",
      icon: FileText,
      badge: progressReports.filter(
        (report) =>
          report.status === "draft" || report.status === "changes_requested",
      ).length,
    },
    {
      key: "final",
      label: "Final submission",
      icon: GraduationCap,
      badge:
        (paper?.finalReportStatus === "changes_requested" ? 1 : 0) +
        finalDefenses.filter((defense) => !defense.submissionConfirmed).length,
    },
    {
      key: "defenses",
      label: "Defenses",
      icon: CalendarDays,
      badge: upcomingDefenses.length,
    },
  ];

  const noPaperState = (what: string) => (
    <EmptyState title={`${what} open up after your proposal is approved`}>
      Once your supervisor approves the proposal it becomes your research
      paper, and you can submit {what.toLowerCase()} here.
    </EmptyState>
  );

  return (
    <>
      <AppShell
        roleLabel="Student workspace"
        nav={nav}
        active={section}
        title={SECTION_TITLES[section]}
        subtitle={
          paper && section !== "profile"
            ? `${paper.title} · Supervisor: ${paper.supervisorName ?? "not assigned"}`
            : undefined
        }
        user={{
          name: currentUser?.name,
          email: currentUser?.email,
          avatarUrl: resolveAvatarUrl(currentUser?.avatarUrl),
        }}
        onUploadAvatar={(file) => void handleUploadAvatar(file)}
        isUploadingAvatar={isUploadingAvatar}
      >
        {loadError && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {loadError}
            <button
              type="button"
              onClick={() => void loadResearch()}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        {section === "profile" && (
          <ProfileCard
            name={profile?.name ?? currentUser?.name ?? "Student"}
            avatarUrl={resolveAvatarUrl(profile?.avatarUrl)}
            fields={[
              { label: "Email", value: profile?.email ?? currentUser?.email ?? "—" },
              { label: "Roll number", value: profile?.rollNumber ?? "Not assigned" },
              { label: "Department", value: profile?.departmentName ?? "Not assigned" },
              { label: "Degree program", value: profile?.degreeProgramName ?? "Not assigned" },
              { label: "Supervisor", value: profile?.supervisorName ?? "Not assigned" },
              {
                label: "Status",
                value: (
                  <span className="capitalize">
                    {profile?.status ?? "Not available"}
                  </span>
                ),
              },
            ]}
          />
        )}

        {section === "home" &&
          (!isLoaded ? (
            <p className="text-sm text-slate-500">Loading your research...</p>
          ) : (
            <div className="space-y-6">
              <Card>
                <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {steps.map((step, index) => {
                    const isCurrent = step.key === currentStep;
                    return (
                      <li key={step.key}>
                        <button
                          type="button"
                          onClick={() => goTo(step.key)}
                          aria-current={isCurrent ? "step" : undefined}
                          className={`flex h-full w-full items-start gap-3 rounded-lg border p-3 text-left transition hover:border-blue-400 ${
                            isCurrent
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200"
                          }`}
                        >
                          {step.done ? (
                            <CheckCircle2
                              size={22}
                              aria-hidden="true"
                              className="shrink-0 text-emerald-600"
                            />
                          ) : isCurrent ? (
                            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                              {index + 1}
                            </span>
                          ) : (
                            <Circle
                              size={22}
                              aria-hidden="true"
                              className="shrink-0 text-slate-300"
                            />
                          )}
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-900">
                              {step.label}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {step.done ? "Done" : sentenceCase(step.detail)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </Card>

              <div
                className={`rounded-xl border p-5 shadow-sm ${nextStep.waiting ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"}`}
              >
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
                  {nextStep.waiting ? (
                    <Hourglass size={14} aria-hidden="true" />
                  ) : (
                    <Flag size={14} aria-hidden="true" />
                  )}
                  {nextStep.waiting ? "Status" : "Your next step"}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {nextStep.title}
                </h2>
                {nextStep.description && (
                  <p className="mt-1 text-sm text-slate-600">
                    {nextStep.description}
                  </p>
                )}
                {nextStep.actionLabel && nextStep.onAction && (
                  <button
                    type="button"
                    onClick={nextStep.onAction}
                    className={`mt-4 ${primaryButtonClass}`}
                  >
                    <Send size={16} aria-hidden="true" />
                    {nextStep.actionLabel}
                  </button>
                )}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Upcoming defenses
                  </h3>
                  {upcomingDefenses.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">
                      Nothing scheduled. Your department announces defenses
                      here and in your notifications.
                    </p>
                  ) : (
                    <>
                      {upcomingDefenses.slice(0, 3).map((defense) => (
                        <DefenseNotice key={defense.id} defense={defense} />
                      ))}
                      <button
                        type="button"
                        onClick={() => goTo("defenses")}
                        className="mt-3 text-sm font-medium text-blue-700 hover:underline"
                      >
                        See all defenses
                      </button>
                    </>
                  )}
                </Card>
                <Card>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Your research timeline
                  </h3>
                  {timeline.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">
                      Your department hasn't published the timeline for your
                      degree level yet.
                    </p>
                  ) : (
                    <ol className="mt-3 space-y-2">
                      {timeline.map((phase) => (
                        <li
                          key={phase.id}
                          className="flex items-start justify-between gap-3 text-sm"
                        >
                          <span className="min-w-0">
                            <span className="block font-medium text-slate-800">
                              {phase.sequenceNumber}. {phase.label}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {phase.phaseType === "defense"
                                ? phase.defenseDate
                                  ? `Defense day ${formatDate(phase.defenseDate)}`
                                  : "Defense day not set"
                                : roundWindowText(phase)}
                            </span>
                          </span>
                          <StatusBadge
                            status={phase.isOpen ? "open" : phase.status}
                            label={
                              phase.isOpen
                                ? "Open"
                                : phase.status === "closed"
                                  ? "Closed"
                                  : "Not open yet"
                            }
                          />
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </div>
            </div>
          ))}

        {section === "proposal" && (
          <div className="space-y-4">
            {invites.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <h2 className="text-sm font-semibold text-blue-900">
                  Group invite requests
                </h2>
                <p className="mt-0.5 text-xs text-blue-700">
                  Respond before the owner submits their proposal.
                </p>
                <ul className="mt-3 space-y-2">
                  {invites.map((invite) => (
                    <li
                      key={invite.proposalId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <span>
                        <span className="font-medium text-slate-800">
                          {invite.ownerName}
                        </span>{" "}
                        invited you to join "{invite.title}"
                      </span>
                      <span className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void respondToInvite(invite.proposalId, "accepted")
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          <Check size={14} aria-hidden="true" /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void respondToInvite(invite.proposalId, "rejected")
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <X size={14} aria-hidden="true" /> Decline
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <SectionHeader
              title="Research proposal"
              description="Write your proposal, attach the PDF and submit it for review."
              action={
                !hasActiveProposal && (
                  <button
                    type="button"
                    disabled={!canStartProposal}
                    onClick={() => openProposalForm(null)}
                    className={primaryButtonClass}
                  >
                    <FileText size={16} aria-hidden="true" /> New proposal
                  </button>
                )
              }
            />
            {!paper && <PhaseNotice notice={proposalNotice} />}
            {hasRejectedProposal && !hasActiveProposal && (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Your previous proposal was rejected. You can submit a new
                proposal, even if the proposal deadline has passed.
              </p>
            )}
            {proposals.length === 0 ? (
              <EmptyState title="You haven't created a proposal yet">
                {canStartProposal
                  ? "Use “New proposal” to start one. You can save it as a draft and submit later."
                  : "You can start one once your department opens the proposal phase."}
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {proposals.map((proposal) => {
                  const isOwner = proposal.submittedBy === currentUserId;
                  const canAct = canActOn(proposal);
                  return (
                    <article
                      key={proposal.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-medium text-slate-900">
                            {proposal.title}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {isOwner
                              ? "Your proposal"
                              : `By ${proposal.submittedByName ?? "a teammate"}`}{" "}
                            · Supervisor:{" "}
                            {proposal.supervisorName ?? "not assigned yet"}
                          </p>
                        </div>
                        <span className="flex items-center gap-1">
                          <StatusBadge status={proposal.status} />
                          {proposal.deletedAt && (
                            <StatusBadge status="deleted" label="Deleted" />
                          )}
                        </span>
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                        <Users size={14} aria-hidden="true" />
                        {[
                          proposal.submittedByName ?? "Owner",
                          ...proposal.groupMembers.map(
                            (member) =>
                              `${member.name}${member.status !== "accepted" ? ` (${member.status})` : ""}`,
                          ),
                        ].join(", ")}
                      </p>
                      {proposal.reviewComment && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          {proposal.reviewedByName
                            ? `${proposal.reviewedByName}: `
                            : ""}
                          "{proposal.reviewComment}"
                        </p>
                      )}
                      {proposal.studentResponse && (
                        <p className="mt-2 text-xs text-blue-700">
                          {proposal.respondedByName
                            ? `${proposal.respondedByName} replied: `
                            : "Reply: "}
                          "{proposal.studentResponse}"
                        </p>
                      )}
                      {proposal.deletedAt && (
                        <p className="mt-2 text-xs text-slate-400">
                          Deleted by {proposal.deletedByName ?? "an admin"} on{" "}
                          {formatDate(proposal.deletedAt)}
                        </p>
                      )}
                      {defenses
                        .filter((defense) => defense.proposalId === proposal.id)
                        .map((defense) => (
                          <DefenseNotice key={defense.id} defense={defense} />
                        ))}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <DocumentActions
                          kind="proposals"
                          entityId={proposal.id}
                          filename={proposal.originalFilename}
                          fallbackName="proposal.pdf"
                          onError={showError}
                        />
                        {canAct && (
                          <span className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void showHistory(proposal)}
                              className={smallSecondaryButtonClass}
                            >
                              <History size={14} aria-hidden="true" /> History
                            </button>
                            {proposal.status === "draft" && (
                              <>
                                {isGroupLevel && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormError(null);
                                      setSelectedMember("");
                                      setGroupProposal(proposal);
                                    }}
                                    className={smallSecondaryButtonClass}
                                  >
                                    <Users size={14} aria-hidden="true" />{" "}
                                    Group
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openProposalForm(proposal)}
                                  className={smallPrimaryButtonClass}
                                >
                                  <Pencil size={14} aria-hidden="true" />{" "}
                                  Continue &amp; submit
                                </button>
                              </>
                            )}
                            {proposal.status === "changes_requested" && (
                              <button
                                type="button"
                                onClick={() => openFeedbackForm(proposal)}
                                className={smallPrimaryButtonClass}
                              >
                                <Send size={14} aria-hidden="true" /> Address
                                feedback
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {section === "progress" &&
          (!paper ? (
            noPaperState("Progress reports")
          ) : (
            <div className="space-y-4">
              <SectionHeader
                title="Progress reports"
                description="Submit one report for each progress review round your department schedules."
                action={
                  !paper.finalReportStatus && (
                    <button
                      type="button"
                      disabled={!canStartReport}
                      onClick={() => openReportForm(null)}
                      className={primaryButtonClass}
                    >
                      <FileText size={16} aria-hidden="true" />{" "}
                      {newReportPhaseLabel
                        ? `Start ${newReportPhaseLabel}`
                        : "New progress report"}
                    </button>
                  )
                }
              />
              <PhaseNotice notice={progressNotice} />
              {progressEligibility?.reason && !paper.finalReportStatus && (
                <BlockedReason>{progressEligibility.reason}</BlockedReason>
              )}
              <div className="space-y-3">
                {progressRounds.length === 0 && earlierAttempts.length === 0 && (
                  <EmptyState title="No progress review rounds yet">
                    Your department hasn't scheduled any progress review rounds
                    for your degree level yet.
                  </EmptyState>
                )}
                {progressRounds.map(({ phase, report }, index) =>
                  report ? (
                    <ProgressRoundCard
                      key={phase.id}
                      heading={`Round ${index + 1} · ${phase.label}`}
                      report={report}
                      defenses={defenses}
                      onOpen={openReportForm}
                      onError={showError}
                    />
                  ) : (
                    <article
                      key={phase.id}
                      className="rounded-xl border border-dashed border-slate-300 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-slate-700">
                            Round {index + 1} · {phase.label}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {roundWindowText(phase)}
                          </p>
                        </div>
                        <StatusBadge
                          status={phase.isOpen ? "open" : "not_started"}
                        />
                      </div>
                    </article>
                  ),
                )}
                {earlierAttempts.length > 0 && (
                  <>
                    <h3 className="pt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                      Earlier attempts
                    </h3>
                    {earlierAttempts.map((report) => (
                      <ProgressRoundCard
                        key={report.id}
                        heading={report.phaseLabel ?? "Progress report"}
                        report={report}
                        defenses={defenses}
                        onOpen={openReportForm}
                        onError={showError}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}

        {section === "defenses" && (
          <div className="space-y-4">
            <SectionHeader
              title="Defenses"
              description="When and where each of your reports will be defended, and who is on the panel."
            />
            {defenses.length === 0 ? (
              <EmptyState title="No defenses planned yet">
                Your department announces a defense for your proposal, progress
                reports and final report here.
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {[...defenses]
                  .sort(
                    (first, second) =>
                      Number(isPastDefense(first)) -
                        Number(isPastDefense(second)) ||
                      new Date(first.defenseDate).getTime() -
                        new Date(second.defenseDate).getTime(),
                  )
                  .map((defense) => (
                    <DefenseCard
                      key={defense.id}
                      defense={defense}
                      onError={showError}
                    />
                  ))}
              </div>
            )}
          </div>
        )}

        {section === "final" &&
          (!paper ? (
            noPaperState("Final submissions")
          ) : (
            <div className="space-y-4">
              <SectionHeader
                title="Final submission"
                description="Submit your final report to your supervisor. Once it's approved, your department schedules your defense and you submit the final thesis."
              />
              <PhaseNotice notice={defenseNotice} />
              {canSubmitFinalReport && finalEligibility?.reason && (
                <BlockedReason>{finalEligibility.reason}</BlockedReason>
              )}
              <ol className="space-y-3">
                <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Step 1
                      </p>
                      <h3 className="font-medium text-slate-900">
                        Final report
                      </h3>
                    </div>
                    <StatusBadge
                      status={paper.finalReportStatus ?? "not_submitted"}
                    />
                  </div>
                  {paper.finalReportReviewComment && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {paper.finalReportReviewedByName
                        ? `${paper.finalReportReviewedByName}: `
                        : ""}
                      "{paper.finalReportReviewComment}"
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <DocumentActions
                      kind="papers"
                      entityId={paper.id}
                      filename={paper.finalReportOriginalFilename}
                      fallbackName="final-report.pdf"
                      onError={showError}
                    />
                    {canSubmitFinalReport && (
                      <button
                        type="button"
                        disabled={!finalEligibility?.canStart}
                        onClick={() => {
                          resetForm();
                          setIsFinalReportFormOpen(true);
                        }}
                        className={smallPrimaryButtonClass}
                      >
                        <Send size={14} aria-hidden="true" />{" "}
                        {paper.finalReportStatus
                          ? "Resubmit final report"
                          : "Submit final report"}
                      </button>
                    )}
                  </div>
                </li>
                <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Step 2
                  </p>
                  <h3 className="font-medium text-slate-900">Final defense</h3>
                  {finalDefenses.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">
                      {paper.finalReportStatus === "approved"
                        ? "Your final report is approved. Your department will schedule your defense slot."
                        : "Your defense is scheduled after your supervisor approves the final report."}
                    </p>
                  ) : (
                    finalDefenses.map((defense) => (
                      <div
                        key={defense.id}
                        className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-slate-800">
                            {formatDate(defense.defenseDate)}
                            {defense.scheduledTime
                              ? ` at ${defense.scheduledTime.slice(0, 5)}`
                              : ""}
                            {defense.location ? ` · ${defense.location}` : ""}
                          </p>
                          <StatusBadge
                            status={
                              defense.submissionConfirmed
                                ? defense.currentStatus
                                : "awaiting_thesis"
                            }
                            label={
                              defense.submissionConfirmed
                                ? defense.currentStatus === "pending"
                                  ? "Thesis submitted"
                                  : formatStatus(defense.currentStatus)
                                : "Awaiting thesis"
                            }
                          />
                        </div>
                        {defense.panelNames.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            Panel: {defense.panelNames.join(", ")}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                          <DocumentActions
                            kind="defenses"
                            entityId={defense.id}
                            filename={defense.originalFilename}
                            fallbackName="final-thesis.pdf"
                            onError={showError}
                          />
                          {!defense.submissionConfirmed && (
                            <button
                              type="button"
                              onClick={() => {
                                resetForm();
                                setThesisDefense(defense);
                              }}
                              className={smallPrimaryButtonClass}
                            >
                              <Send size={14} aria-hidden="true" /> Submit
                              final thesis
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </li>
              </ol>
            </div>
          ))}
      </AppShell>

      {proposalForm && (
        <Modal
          title={proposalForm.id ? "Edit proposal" : "New proposal"}
          subtitle="Save a draft while you work, then submit it for review with the PDF attached."
          onClose={closeForms}
        >
          <form onSubmit={saveProposal} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Title
              <input
                required
                value={proposalForm.title}
                onChange={(event) =>
                  setProposalForm({
                    ...proposalForm,
                    title: event.target.value,
                  })
                }
                className={inputClass}
              />
            </label>
            {!proposalForm.id && !isGroupLevel && profile?.degreeLevel && (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                {profile.degreeLevel === "phd" ? "PhD" : "Master's"} proposals
                are individual, so you'll submit this proposal on your own.
              </p>
            )}
            {!proposalForm.id && isGroupLevel && (
              <label className="block text-sm font-medium text-slate-700">
                Group members{" "}
                <span className="font-normal text-slate-500">(up to 2)</span>
                <select
                  multiple
                  value={proposalForm.memberIds}
                  onChange={(event) =>
                    setProposalForm({
                      ...proposalForm,
                      memberIds: Array.from(
                        event.target.selectedOptions,
                        (option) => option.value,
                      ).slice(0, 2),
                    })
                  }
                  className={`${inputClass} h-24`}
                >
                  {availableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {proposalForm.memberIds.length}/2 selected. Invited members
                  must accept before the proposal can be submitted.
                </span>
              </label>
            )}
            <DocumentField
              label="Proposal document"
              existingFilename={editingProposal?.originalFilename ?? null}
              onView={
                editingProposal
                  ? () =>
                      void viewDocumentFile(
                        "proposals",
                        editingProposal.id,
                      ).catch((viewError: unknown) =>
                        setFormError(
                          errorMessage(
                            viewError,
                            "Unable to open the document.",
                          ),
                        ),
                      )
                  : undefined
              }
              file={formFile}
              onChange={setFormFile}
              required={false}
            />
            <FormError message={formError} />
            <FormActions
              onCancel={closeForms}
              busy={isSaving}
              draftLabel="Save draft"
              submitLabel="Submit for review"
              onIntent={(intent) => {
                submitIntent.current = intent;
              }}
            />
          </form>
        </Modal>
      )}

      {feedbackProposal && (
        <Modal
          title="Address feedback"
          subtitle={feedbackProposal.title}
          onClose={closeForms}
        >
          {feedbackProposal.reviewComment && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {feedbackProposal.reviewedByName
                ? `${feedbackProposal.reviewedByName}: `
                : ""}
              "{feedbackProposal.reviewComment}"
            </p>
          )}
          <form onSubmit={submitFeedback} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              What did you change?
              <textarea
                required
                rows={4}
                value={feedbackResponse}
                onChange={(event) => setFeedbackResponse(event.target.value)}
                placeholder="Explain how you addressed your supervisor's feedback..."
                className={inputClass}
              />
            </label>
            <DocumentField
              label="Revised proposal document (optional)"
              existingFilename={feedbackProposal.originalFilename}
              onView={() =>
                void viewDocumentFile("proposals", feedbackProposal.id).catch(
                  (viewError: unknown) =>
                    setFormError(
                      errorMessage(viewError, "Unable to open the document."),
                    ),
                )
              }
              file={formFile}
              onChange={setFormFile}
              required={false}
            />
            <FormError message={formError} />
            <FormActions
              onCancel={closeForms}
              busy={isSaving}
              submitLabel="Send to supervisor"
              onIntent={(intent) => {
                submitIntent.current = intent;
              }}
            />
          </form>
        </Modal>
      )}

      {reportForm && (
        <Modal
          title={
            reportForm.report
              ? reportForm.report.status === "changes_requested"
                ? "Revise progress report"
                : "Submit progress report"
              : "New progress report"
          }
          subtitle={
            reportForm.report?.phaseLabel ?? newReportPhaseLabel ?? undefined
          }
          onClose={closeForms}
        >
          {reportForm.report?.reviewComment && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {reportForm.report.reviewedByName
                ? `${reportForm.report.reviewedByName}: `
                : ""}
              "{reportForm.report.reviewComment}"
            </p>
          )}
          {!reportForm.report && progressEligibility?.deadlineAt && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
              <CalendarClock size={16} aria-hidden="true" /> Deadline:{" "}
              {formatDateTime(progressEligibility.deadlineAt)}
            </p>
          )}
          <form onSubmit={saveProgressReport} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Progress summary
              <textarea
                required
                rows={5}
                value={reportForm.content}
                onChange={(event) =>
                  setReportForm({ ...reportForm, content: event.target.value })
                }
                placeholder="What have you completed since the last review, and what's next?"
                className={inputClass}
              />
            </label>
            <DocumentField
              label="Progress report document"
              existingFilename={reportForm.report?.originalFilename ?? null}
              onView={
                reportForm.report
                  ? () =>
                      void viewDocumentFile(
                        "progress-reports",
                        reportForm.report!.id,
                      ).catch((viewError: unknown) =>
                        setFormError(
                          errorMessage(
                            viewError,
                            "Unable to open the document.",
                          ),
                        ),
                      )
                  : undefined
              }
              file={formFile}
              onChange={setFormFile}
              required={false}
            />
            <FormError message={formError} />
            <FormActions
              onCancel={closeForms}
              busy={isSaving}
              draftLabel={reportForm.report ? undefined : "Save draft"}
              submitLabel="Submit to supervisor"
              onIntent={(intent) => {
                submitIntent.current = intent;
              }}
            />
          </form>
        </Modal>
      )}

      {isFinalReportFormOpen && paper && (
        <Modal
          title={
            paper.finalReportStatus
              ? "Resubmit final report"
              : "Submit final report"
          }
          subtitle={paper.title}
          onClose={closeForms}
        >
          {paper.finalReportReviewComment && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {paper.finalReportReviewedByName
                ? `${paper.finalReportReviewedByName}: `
                : ""}
              "{paper.finalReportReviewComment}"
            </p>
          )}
          <form onSubmit={submitFinalReport} className="mt-4 space-y-4">
            <DocumentField
              label="Final report document"
              existingFilename={paper.finalReportOriginalFilename}
              onView={() =>
                void viewDocumentFile("papers", paper.id).catch(
                  (viewError: unknown) =>
                    setFormError(
                      errorMessage(viewError, "Unable to open the document."),
                    ),
                )
              }
              file={formFile}
              onChange={setFormFile}
              required
            />
            <p className="text-xs text-slate-500">
              Your supervisor reviews the final report before your defense can
              be scheduled.
            </p>
            <FormError message={formError} />
            <FormActions
              onCancel={closeForms}
              busy={isSaving}
              submitLabel="Submit final report"
              onIntent={(intent) => {
                submitIntent.current = intent;
              }}
            />
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
              onView={() =>
                void viewDocumentFile("defenses", thesisDefense.id).catch(
                  (viewError: unknown) =>
                    setFormError(
                      errorMessage(viewError, "Unable to open the document."),
                    ),
                )
              }
              file={formFile}
              onChange={setFormFile}
              required
            />
            <p className="text-xs text-slate-500">
              After submitting, the thesis can't be replaced. It goes to your
              defense panel.
            </p>
            <FormError message={formError} />
            <FormActions
              onCancel={closeForms}
              busy={isSaving}
              submitLabel="Submit final thesis"
              onIntent={(intent) => {
                submitIntent.current = intent;
              }}
            />
          </form>
        </Modal>
      )}

      {groupProposal && (
        <Modal
          title="Proposal group"
          subtitle="Invited members must accept before they count toward your group of 2–3."
          onClose={() => {
            setGroupProposal(null);
            setFormError(null);
          }}
        >
          <div className="mt-5 space-y-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              {groupProposal.submittedByName ?? "Owner"} (owner)
            </div>
            {groupProposal.groupMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span>
                  {member.name}{" "}
                  {member.status !== "accepted" && (
                    <span className="text-xs text-amber-600">
                      ({member.status})
                    </span>
                  )}
                </span>
                {groupProposal.submittedBy === currentUserId && (
                  <button
                    type="button"
                    onClick={() => void removeMember(groupProposal, member.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {groupProposal.submittedBy === currentUserId && (
              <div className="flex gap-2">
                <select
                  value={selectedMember}
                  onChange={(event) => setSelectedMember(event.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select a department student</option>
                  {availableMembers
                    .filter(
                      (member) =>
                        !groupProposal.groupMembers.some(
                          (selected) => selected.id === member.id,
                        ),
                    )
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={
                    !selectedMember || groupProposal.groupMembers.length >= 2
                  }
                  onClick={() => void addMember()}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Send invite
                </button>
              </div>
            )}
            <FormError message={formError} />
            <button
              type="button"
              onClick={() => {
                setGroupProposal(null);
                setFormError(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium"
            >
              Done
            </button>
          </div>
        </Modal>
      )}

      {historyProposal && (
        <Modal
          title="Submission history"
          subtitle={historyProposal.title}
          onClose={() => setHistoryProposal(null)}
        >
          {history.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No recorded submissions yet.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="border-l-2 border-blue-200 pl-3 text-sm"
                >
                  <p className="font-medium capitalize text-slate-800">
                    {formatStatus(item.entityType)} ·{" "}
                    {formatStatus(item.status)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.phaseLabel ?? "Unscheduled phase"} ·{" "}
                    {formatDateTime(item.createdAt)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {item.reviewedByName
                      ? `Reviewed by ${item.reviewedByName}`
                      : `Submitted by ${item.submittedByName ?? "student"}`}
                    {item.comments ? ` · ${item.comments}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}
    </>
  );
}

export default StudentDashboard;
