import { useEffect, useState } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  Gavel,
  GraduationCap,
  NotebookPen,
  Users,
} from "lucide-react";
import { gql } from "@apollo/client";
import { print } from "graphql";
import AppShell, { type NavItem } from "../components/AppShell";
import DefenseNotice from "../components/DefenseNotice";
import DefenseCard, { type DefenseDetails } from "../components/DefenseCard";
import {
  Card,
  DocumentActions,
  EmptyState,
  FormError,
  Modal,
  ProfileCard,
  SectionHeader,
  SegmentedControl,
  StatusBadge,
} from "../components/ui";
import { useSection } from "../hooks/useSection";
import { useToast } from "../hooks/useToast";
import {
  DEFENSE_TONE_LABELS,
  DEFENSE_TONE_STYLES,
  defenseTone,
  formatDefenseDate,
  reportLabel,
} from "../utils/defenses";
import { MY_PANEL_DEFENSES_QUERY } from "../queries/queries";
import { SUBMIT_DEFENSE_VERDICT } from "../mutations/mutations";
import { resolveAvatarUrl, uploadAvatarImage } from "../utils/uploadAvatar";
import {
  degreeLevelLabel,
  errorMessage,
  formatDate,
  formatDateTime,
  formatStatus,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallPrimaryButtonClass,
} from "../utils/format";

interface CurrentUser {
  name: string;
  avatarUrl: string | null;
}

interface MyProfile {
  name: string;
  email: string;
  avatarUrl: string | null;
  departmentName: string | null;
  academicRank: string | null;
  maxStudents: number | null;
}

interface Proposal {
  id: string;
  submittedByName: string | null;
  title: string;
  status: string;
  supervisorName: string | null;
  clusterName: string | null;
  groupMembers: { id: string; name: string }[];
  reviewComment: string | null;
  reviewedByName: string | null;
  studentResponse: string | null;
  respondedByName: string | null;
  deletedAt: string | null;
  deletedByName: string | null;
  originalFilename: string | null;
  degreeLevel: string | null;
}

interface Paper {
  id: string;
  proposalId: string | null;
  degreeLevel: string | null;
  title: string;
  status: string;
  finalReportStatus: string | null;
  finalReportReviewComment: string | null;
  finalReportOriginalFilename: string | null;
}
interface ProgressReport {
  id: string;
  paperId: string;
  submittedByName: string | null;
  content: string;
  status: string;
  submittedAt: string;
  originalFilename: string | null;
  reviewComment: string | null;
  phaseLabel: string | null;
  deadlineAt: string | null;
}
interface Defense {
  id: string;
  kind: string;
  paperId: string | null;
  proposalId: string | null;
  progressReportId: string | null;
  phaseLabel: string | null;
  panelNames: string[];
  defenseDate: string;
  scheduledTime: string | null;
  location: string | null;
  submissionConfirmed: boolean;
  originalFilename: string | null;
  currentStatus: string;
  outcomeComments: string | null;
  outcomeRecordedByName: string | null;
  requiresRedefense: boolean;
  hasEnded: boolean;
}

interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

type Decision = "approved" | "rejected" | "changes_requested";
type PanelLevel = "bachelors" | "masters" | "phd";
type LevelFilter = PanelLevel | "all";
const LEVEL_FILTERS: { value: LevelFilter; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "bachelors", label: "Bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
];
const SECTIONS = ["todo", "students", "panels", "profile"] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_TITLES: Record<Section, string> = {
  todo: "To-do",
  students: "My students",
  panels: "Defense panels",
  profile: "My profile",
};
const DECISIONS: Decision[] = ["approved", "changes_requested", "rejected"];

const ENDPOINT = import.meta.env.VITE_API_URL;
const CURRENT_USER = gql`
  query CurrentUser {
    currentUser {
      name
      avatarUrl
    }
  }
`;
const MY_PROFILE = gql`
  query MyProfessorProfile {
    myProfessorProfile {
      name
      email
      avatarUrl
      departmentName
      academicRank
      maxStudents
    }
  }
`;
const ASSIGNED_PROPOSALS = gql`
  query AssignedProposals {
    assignedProposals {
      id
      submittedByName
      title
      status
      supervisorName
      clusterName
      groupMembers {
        id
        name
      }
      reviewComment
      reviewedByName
      studentResponse
      respondedByName
      deletedAt
      deletedByName
      originalFilename
      degreeLevel
    }
  }
`;
const REVIEW_PROPOSAL = gql`
  mutation ReviewProposal($professorInput: ProposalReviewDecisionInput!) {
    reviewProposal(professorInput: $professorInput) {
      id
      status
      reviewComment
      reviewedByName
    }
  }
`;
const SUPERVISED_PAPERS = gql`
  query SupervisedPapers {
    supervisedPapers {
      id
      proposalId
      degreeLevel
      title
      status
      finalReportStatus
      finalReportReviewComment
      finalReportOriginalFilename
    }
  }
`;
const SUPERVISED_PROGRESS_REPORTS = gql`
  query SupervisedProgressReports {
    supervisedProgressReports {
      id
      paperId
      submittedByName
      content
      status
      submittedAt
      originalFilename
      reviewComment
      phaseLabel
      deadlineAt
    }
  }
`;
const SUPERVISED_DEFENSES = gql`
  query SupervisedDefenses {
    supervisedDefenses {
      id
      kind
      paperId
      proposalId
      progressReportId
      phaseLabel
      panelNames
      defenseDate
      scheduledTime
      location
      submissionConfirmed
      originalFilename
      currentStatus
      outcomeComments
      outcomeRecordedByName
      requiresRedefense
      hasEnded
    }
  }
`;
const REVIEW_PROGRESS_REPORT = gql`
  mutation ReviewProgressReport($professorInput: ProgressReportReviewInput!) {
    reviewProgressReport(professorInput: $professorInput) {
      id
      status
    }
  }
`;
const REVIEW_FINAL_REPORT = gql`
  mutation ReviewFinalReport($professorInput: FinalReportReviewInput!) {
    reviewFinalReport(professorInput: $professorInput) {
      id
      finalReportStatus
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

// One piece of research the professor supervises: the proposal, and once it is
// approved, the paper it became with its reports and defenses.
interface Research {
  key: string;
  proposal: Proposal | null;
  paper: Paper | null;
  level: string | null;
}

function DecisionPicker({
  value,
  onChange,
}: {
  value: Decision;
  onChange: (decision: Decision) => void;
}) {
  return (
    <div className="grid gap-1.5 text-sm font-medium text-slate-700">
      Decision
      <div className="flex flex-wrap gap-2">
        {DECISIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
              value === option
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {formatStatus(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfessorDashboard() {
  const toast = useToast();
  const [section, goTo] = useSection(SECTIONS, "todo");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [reviewing, setReviewing] = useState<Proposal | null>(null);
  const [decision, setDecision] = useState<Decision>("approved");
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [studentLevel, setStudentLevel] = useState<LevelFilter>("all");
  const [panelLevel, setPanelLevel] = useState<LevelFilter>("all");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [defenses, setDefenses] = useState<Defense[]>([]);
  const [panelDefenses, setPanelDefenses] = useState<DefenseDetails[]>([]);
  // The panel decides a defense itself: each member votes, and the majority settles
  // it the moment the last vote lands. No admin confirms it afterwards.
  const [verdictTarget, setVerdictTarget] = useState<DefenseDetails | null>(
    null,
  );
  const [verdictForm, setVerdictForm] = useState<{
    verdict: "accept" | "reject";
    comments: string;
  }>({
    verdict: "accept",
    comments: "",
  });
  const [isSavingVerdict, setIsSavingVerdict] = useState(false);
  const [verdictError, setVerdictError] = useState<string | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [isSubmittingPaperReview, setIsSubmittingPaperReview] = useState(false);
  const [reviewingReport, setReviewingReport] = useState<ProgressReport | null>(
    null,
  );
  const [reviewingFinalReport, setReviewingFinalReport] =
    useState<Paper | null>(null);
  const [paperDecision, setPaperDecision] = useState<Decision>("approved");
  const [paperComment, setPaperComment] = useState("");

  const showError = (message: string) => toast.error(message);

  const submitVerdict = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!verdictTarget) return;
    setVerdictError(null);
    setIsSavingVerdict(true);
    try {
      const result = await request<{
        submitDefenseVerdict: { currentStatus: string };
      }>(SUBMIT_DEFENSE_VERDICT, {
        professorInput: {
          defenseId: verdictTarget.id,
          verdict: verdictForm.verdict,
          comments: verdictForm.comments.trim() || null,
        },
      });
      // Still pending means other members have yet to vote.
      const status = result.submitDefenseVerdict.currentStatus;
      toast.success(
        status === "pending"
          ? "Your verdict is recorded. The outcome is decided once every panel member has voted."
          : status === "accepted"
            ? "The panel passed this defense. Everyone involved has been notified."
            : "The panel did not pass this defense. Everyone involved has been notified.",
      );
      setVerdictTarget(null);
      await loadPapers();
    } catch (requestError) {
      setVerdictError(
        errorMessage(requestError, "Unable to submit your verdict."),
      );
    } finally {
      setIsSavingVerdict(false);
    }
  };

  const load = async () => {
    try {
      const result = await request<{ assignedProposals: Proposal[] }>(
        ASSIGNED_PROPOSALS,
      );
      setProposals(result.assignedProposals);
      setLoadError(null);
    } catch (requestError) {
      setLoadError(
        errorMessage(requestError, "Unable to load assigned proposals."),
      );
    }
  };

  const loadPapers = async () => {
    try {
      const [papersResult, reportsResult, defensesResult, panelResult] =
        await Promise.all([
          request<{ supervisedPapers: Paper[] }>(SUPERVISED_PAPERS),
          request<{ supervisedProgressReports: ProgressReport[] }>(
            SUPERVISED_PROGRESS_REPORTS,
          ),
          request<{ supervisedDefenses: Defense[] }>(SUPERVISED_DEFENSES),
          request<{ myPanelDefenses: DefenseDetails[] }>(
            MY_PANEL_DEFENSES_QUERY,
          ),
        ]);
      setPapers(papersResult.supervisedPapers);
      setProgressReports(reportsResult.supervisedProgressReports);
      setDefenses(defensesResult.supervisedDefenses);
      setPanelDefenses(panelResult.myPanelDefenses);
    } catch (requestError) {
      setLoadError(
        errorMessage(requestError, "Unable to load supervised papers."),
      );
    }
  };

  const reloadAll = async () => {
    await Promise.all([load(), loadPapers()]);
  };

  useEffect(() => {
    const loadAccount = async () => {
      try {
        const [userResult, profileResult] = await Promise.all([
          request<{ currentUser: CurrentUser }>(CURRENT_USER),
          request<{ myProfessorProfile: MyProfile }>(MY_PROFILE),
        ]);
        setCurrentUser(userResult.currentUser);
        setProfile(profileResult.myProfessorProfile);
      } catch {
        // Profile details are a nice-to-have here; a failed lookup shouldn't block the page.
      }
    };
    const initialize = async () => {
      await Promise.all([load(), loadPapers()]);
      setIsLoaded(true);
    };
    void loadAccount();
    void initialize();
  }, []);

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

  const openReview = (proposal: Proposal) => {
    setReviewing(proposal);
    setDecision(
      proposal.status === "approved" ||
        proposal.status === "rejected" ||
        proposal.status === "changes_requested"
        ? (proposal.status as Decision)
        : "approved",
    );
    setComment(proposal.reviewComment ?? "");
    setReviewError(null);
  };

  const closeReview = () => {
    setReviewing(null);
    setReviewError(null);
  };

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewing) return;
    setIsSubmittingReview(true);
    setReviewError(null);
    try {
      await request(REVIEW_PROPOSAL, {
        professorInput: {
          proposalId: reviewing.id,
          status: decision,
          comment: comment.trim() || null,
        },
      });
      closeReview();
      toast.success(`Review saved: ${formatStatus(decision)}.`);
      // Approving creates the paper, so both lists change.
      await reloadAll();
    } catch (requestError) {
      setReviewError(errorMessage(requestError, "Unable to submit review."));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // A student's written reply to "changes_requested" feedback comes back with status
  // "submitted" again — approving it here is the same reviewProposal call, just a
  // one-click shortcut instead of opening the full review form for the common case.
  const approveCorrection = async (proposal: Proposal) => {
    try {
      await request(REVIEW_PROPOSAL, {
        professorInput: {
          proposalId: proposal.id,
          status: "approved",
          comment: null,
        },
      });
      toast.success(`"${proposal.title}" approved.`);
      await reloadAll();
    } catch (requestError) {
      toast.error(
        errorMessage(requestError, "Unable to approve the proposal."),
      );
    }
  };

  const openReportReview = (report: ProgressReport) => {
    setReviewingReport(report);
    setPaperDecision("approved");
    setPaperComment("");
    setPaperError(null);
  };

  const closePaperReview = () => {
    setReviewingReport(null);
    setReviewingFinalReport(null);
    setPaperError(null);
  };

  const submitReportReview = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!reviewingReport) return;
    setPaperError(null);
    setIsSubmittingPaperReview(true);
    try {
      await request(REVIEW_PROGRESS_REPORT, {
        professorInput: {
          id: reviewingReport.id,
          status: paperDecision,
          comment: paperComment.trim() || null,
        },
      });
      setReviewingReport(null);
      toast.success(
        `Progress report review saved: ${formatStatus(paperDecision)}.`,
      );
      await loadPapers();
    } catch (requestError) {
      setPaperError(errorMessage(requestError, "Unable to submit review."));
    } finally {
      setIsSubmittingPaperReview(false);
    }
  };

  const openFinalReportReview = (paper: Paper) => {
    setReviewingFinalReport(paper);
    setPaperDecision("approved");
    setPaperComment("");
    setPaperError(null);
  };

  const submitFinalReportReview = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!reviewingFinalReport) return;
    setPaperError(null);
    setIsSubmittingPaperReview(true);
    try {
      await request(REVIEW_FINAL_REPORT, {
        professorInput: {
          paperId: reviewingFinalReport.id,
          status: paperDecision,
          comment: paperComment.trim() || null,
        },
      });
      setReviewingFinalReport(null);
      toast.success(
        `Final report review saved: ${formatStatus(paperDecision)}.`,
      );
      await loadPapers();
    } catch (requestError) {
      setPaperError(errorMessage(requestError, "Unable to submit review."));
    } finally {
      setIsSubmittingPaperReview(false);
    }
  };

  const openVerdict = (defense: DefenseDetails) => {
    setVerdictForm({ verdict: "accept", comments: "" });
    setVerdictError(null);
    setVerdictTarget(defense);
  };

  const studentNames = (proposal: Proposal | null) =>
    proposal
      ? [
          proposal.submittedByName ?? "Unknown student",
          ...proposal.groupMembers.map((member) => member.name),
        ].join(", ")
      : "Students not listed";

  // Everything waiting on this professor, oldest decisions first within each kind.
  const proposalsToReview = proposals.filter(
    (proposal) =>
      !proposal.deletedAt &&
      ["submitted", "assigned"].includes(proposal.status),
  );
  const reportsToReview = progressReports.filter(
    (report) => report.status === "submitted",
  );
  const finalsToReview = papers.filter(
    (paper) => paper.finalReportStatus === "submitted",
  );
  const verdictsDue = panelDefenses.filter(
    (defense) => defense.hasEnded && defense.currentStatus === "pending",
  );
  const upcomingPanels = panelDefenses
    .filter(
      (defense) => !defense.hasEnded && defense.currentStatus === "pending",
    )
    .sort(
      (first, second) =>
        new Date(first.defenseDate).getTime() -
        new Date(second.defenseDate).getTime(),
    );
  const todoCount =
    proposalsToReview.length +
    reportsToReview.length +
    finalsToReview.length +
    verdictsDue.length;

  const paperTitle = (paperId: string) =>
    papers.find((paper) => paper.id === paperId)?.title ?? "Research paper";
  const paperLevel = (paperId: string) =>
    papers.find((paper) => paper.id === paperId)?.degreeLevel ?? null;

  // Each paper next to the proposal it came from, then proposals not yet approved.
  const research: Research[] = [
    ...papers.map((paper) => {
      const proposal =
        proposals.find((item) => item.id === paper.proposalId) ?? null;
      return {
        key: paper.id,
        proposal,
        paper,
        level: paper.degreeLevel ?? proposal?.degreeLevel ?? null,
      };
    }),
    ...proposals
      .filter(
        (proposal) => !papers.some((paper) => paper.proposalId === proposal.id),
      )
      .map((proposal) => ({
        key: proposal.id,
        proposal,
        paper: null,
        level: proposal.degreeLevel,
      })),
  ];
  const needsMe = (item: Research) =>
    (item.proposal !== null && proposalsToReview.includes(item.proposal)) ||
    (item.paper !== null &&
      (item.paper.finalReportStatus === "submitted" ||
        reportsToReview.some((report) => report.paperId === item.paper!.id)));
  const visibleResearch = research
    .filter((item) => studentLevel === "all" || item.level === studentLevel)
    // Work waiting on the professor first, deleted proposals last.
    .sort(
      (first, second) =>
        Number(needsMe(second)) - Number(needsMe(first)) ||
        Number(Boolean(first.proposal?.deletedAt)) -
          Number(Boolean(second.proposal?.deletedAt)),
    );
  const visiblePanels = panelDefenses
    .filter(
      (defense) => panelLevel === "all" || defense.degreeLevel === panelLevel,
    )
    .sort(
      (first, second) =>
        Number(first.hasEnded && first.currentStatus !== "pending") -
          Number(second.hasEnded && second.currentStatus !== "pending") ||
        new Date(first.defenseDate).getTime() -
          new Date(second.defenseDate).getTime(),
    );
  const countAtLevel = <T,>(items: T[], levelOf: (item: T) => string | null) =>
    LEVEL_FILTERS.map((filter) => ({
      ...filter,
      count: items.filter(
        (item) => filter.value === "all" || levelOf(item) === filter.value,
      ).length,
    }));

  const nav: NavItem[] = [
    { key: "todo", label: "To-do", icon: ClipboardCheck, badge: todoCount },
    { key: "students", label: "My students", icon: Users },
    {
      key: "panels",
      label: "Defense panels",
      icon: Gavel,
      badge: verdictsDue.length,
    },
  ];

  const todoRow = ({
    key,
    kind,
    icon: Icon,
    title,
    detail,
    level,
    actions,
  }: {
    key: string;
    kind: string;
    icon: typeof FileText;
    title: string;
    detail: React.ReactNode;
    level: string | null;
    actions: React.ReactNode;
  }) => (
    <li
      key={key}
      className="flex flex-wrap items-center justify-between gap-3 p-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            {kind}
            {level ? (
              <span className="ml-2 font-medium normal-case tracking-normal text-slate-400">
                {degreeLevelLabel(level)}
              </span>
            ) : null}
          </p>
          <p className="font-medium text-slate-900">{title}</p>
          <div className="text-xs text-slate-500">{detail}</div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {actions}
      </div>
    </li>
  );

  const reviewButton = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className={smallPrimaryButtonClass}>
      {label}
    </button>
  );

  return (
    <>
      <AppShell
        roleLabel="Professor workspace"
        nav={nav}
        active={section}
        title={SECTION_TITLES[section]}
        user={{
          name: currentUser?.name,
          email: profile?.email,
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
              onClick={() => void reloadAll()}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        {section === "profile" && (
          <ProfileCard
            name={profile?.name ?? currentUser?.name ?? "Professor"}
            avatarUrl={resolveAvatarUrl(profile?.avatarUrl)}
            fields={[
              { label: "Email", value: profile?.email ?? "—" },
              {
                label: "Department",
                value: profile?.departmentName ?? "Not assigned",
              },
              {
                label: "Academic rank",
                value: profile?.academicRank ?? "Not available",
              },
              {
                label: "Max students",
                value: profile?.maxStudents ?? "Not available",
              },
            ]}
          />
        )}

        {section === "todo" &&
          (!isLoaded ? (
            <p className="text-sm text-slate-500">Loading your work...</p>
          ) : (
            <div className="space-y-6">
              <SectionHeader
                title={
                  todoCount === 0
                    ? "You're all caught up"
                    : `${todoCount} item${todoCount === 1 ? "" : "s"} waiting for you`
                }
                description="Proposals and reports your students have submitted, and defenses where your panel's verdict is due."
              />
              {todoCount === 0 ? (
                <EmptyState title="Nothing needs your review right now">
                  New submissions and defenses that need your verdict will
                  appear here.
                </EmptyState>
              ) : (
                <Card className="!p-0">
                  <ul className="divide-y divide-slate-100">
                    {verdictsDue.map((defense) =>
                      todoRow({
                        key: `verdict-${defense.id}`,
                        kind: "Verdict due",
                        icon: Gavel,
                        title: defense.paperTitle ?? "Untitled research",
                        level: defense.degreeLevel,
                        detail: (
                          <>
                            {reportLabel(defense.kind)} defense
                            {defense.phaseLabel
                              ? ` · ${defense.phaseLabel}`
                              : ""}{" "}
                            · held {formatDefenseDate(defense.defenseDate)} ·{" "}
                            {defense.studentNames.join(", ") || "—"}
                          </>
                        ),
                        actions: reviewButton("Give or change verdict", () =>
                          openVerdict(defense),
                        ),
                      }),
                    )}
                    {proposalsToReview.map((proposal) =>
                      todoRow({
                        key: `proposal-${proposal.id}`,
                        kind: proposal.studentResponse
                          ? "Revised proposal"
                          : "Proposal",
                        icon: NotebookPen,
                        title: proposal.title,
                        level: proposal.degreeLevel,
                        detail: (
                          <>
                            {studentNames(proposal)}
                            {proposal.studentResponse && (
                              <span className="mt-0.5 block text-blue-700">
                                {proposal.respondedByName
                                  ? `${proposal.respondedByName} replied: `
                                  : "Reply: "}
                                "{proposal.studentResponse}"
                              </span>
                            )}
                            <span className="mt-1 block">
                              <DocumentActions
                                kind="proposals"
                                entityId={proposal.id}
                                filename={proposal.originalFilename}
                                fallbackName="proposal.pdf"
                                onError={showError}
                                showName={false}
                              />
                            </span>
                          </>
                        ),
                        actions: (
                          <>
                            {proposal.studentResponse && (
                              <button
                                type="button"
                                onClick={() => void approveCorrection(proposal)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                            )}
                            {reviewButton("Review", () => openReview(proposal))}
                          </>
                        ),
                      }),
                    )}
                    {reportsToReview.map((report) =>
                      todoRow({
                        key: `report-${report.id}`,
                        kind: report.phaseLabel ?? "Progress report",
                        icon: FileText,
                        title: paperTitle(report.paperId),
                        level: paperLevel(report.paperId),
                        detail: (
                          <>
                            By {report.submittedByName ?? "student"} ·{" "}
                            {formatDate(report.submittedAt)}
                            <span className="mt-1 block">
                              <DocumentActions
                                kind="progress-reports"
                                entityId={report.id}
                                filename={report.originalFilename}
                                fallbackName="progress-report.pdf"
                                onError={showError}
                                showName={false}
                              />
                            </span>
                          </>
                        ),
                        actions: reviewButton("Review", () =>
                          openReportReview(report),
                        ),
                      }),
                    )}
                    {finalsToReview.map((paper) =>
                      todoRow({
                        key: `final-${paper.id}`,
                        kind: "Final report",
                        icon: GraduationCap,
                        title: paper.title,
                        level: paper.degreeLevel,
                        detail: (
                          <span className="mt-1 block">
                            <DocumentActions
                              kind="papers"
                              entityId={paper.id}
                              filename={paper.finalReportOriginalFilename}
                              fallbackName="final-report.pdf"
                              onError={showError}
                              showName={false}
                            />
                          </span>
                        ),
                        actions: reviewButton("Review", () =>
                          openFinalReportReview(paper),
                        ),
                      }),
                    )}
                  </ul>
                </Card>
              )}

              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Coming up on your panels
                </h3>
                {upcomingPanels.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">
                    No upcoming defenses.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {upcomingPanels.slice(0, 5).map((defense) => (
                      <li
                        key={defense.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-800">
                            {defense.paperTitle ?? "Untitled research"}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {reportLabel(defense.kind)} defense ·{" "}
                            {defense.studentNames.join(", ") || "—"}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <CalendarDays size={14} aria-hidden="true" />
                          {formatDefenseDate(defense.defenseDate)}
                          {defense.scheduledTime
                            ? ` · ${defense.scheduledTime.slice(0, 5)}`
                            : ""}
                          {defense.location ? ` · ${defense.location}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {upcomingPanels.length > 0 && (
                  <button
                    type="button"
                    onClick={() => goTo("panels")}
                    className="mt-2 text-sm font-medium text-blue-700 hover:underline"
                  >
                    See all your panels
                  </button>
                )}
              </div>
            </div>
          ))}

        {section === "students" && (
          <div className="space-y-4">
            <SectionHeader
              title="Research you supervise"
              description="One card per proposal or paper, with every submission and defense in order. Bachelor's research is group work; Master's and PhD research is individual."
            />
            <SegmentedControl
              label="Degree level"
              options={countAtLevel(research, (item) => item.level)}
              value={studentLevel}
              onChange={setStudentLevel}
            />
            {visibleResearch.length === 0 ? (
              <EmptyState title="No research here yet">
                Your department administrator assigns proposals to you. Once you
                approve one it becomes a paper you supervise.
              </EmptyState>
            ) : (
              visibleResearch.map((item) => {
                const { proposal, paper } = item;
                const reports = paper
                  ? progressReports.filter(
                      (report) => report.paperId === paper.id,
                    )
                  : [];
                const finalDefenses = paper
                  ? defenses.filter((defense) => defense.paperId === paper.id)
                  : [];
                return (
                  <article
                    key={item.key}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-400">
                          {degreeLevelLabel(item.level)}
                          {proposal?.clusterName
                            ? ` · ${proposal.clusterName}`
                            : ""}
                        </p>
                        <h3 className="font-semibold text-slate-900">
                          {paper?.title ?? proposal?.title}
                        </h3>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                          <Users size={14} aria-hidden="true" />
                          {studentNames(proposal)}
                        </p>
                      </div>
                      {needsMe(item) && (
                        <StatusBadge
                          status="submitted"
                          label="Needs your review"
                        />
                      )}
                    </div>

                    <ol className="mt-4 space-y-3 border-l-2 border-slate-100 pl-4">
                      {proposal && (
                        <li>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-800">
                              Proposal
                            </p>
                            <span className="flex items-center gap-1">
                              <StatusBadge status={proposal.status} />
                              {proposal.deletedAt && (
                                <StatusBadge status="deleted" label="Deleted" />
                              )}
                            </span>
                          </div>
                          {proposal.reviewComment && (
                            <p className="mt-1 text-xs text-slate-500">
                              Your comment: "{proposal.reviewComment}"
                            </p>
                          )}
                          {proposal.studentResponse && (
                            <p className="mt-1 text-xs text-blue-700">
                              {proposal.respondedByName
                                ? `${proposal.respondedByName} replied: `
                                : "Reply: "}
                              "{proposal.studentResponse}"
                            </p>
                          )}
                          {proposal.deletedAt && (
                            <p className="mt-1 text-xs text-slate-400">
                              Deleted by {proposal.deletedByName ?? "an admin"}{" "}
                              on {formatDate(proposal.deletedAt)}
                            </p>
                          )}
                          {defenses
                            .filter(
                              (defense) => defense.proposalId === proposal.id,
                            )
                            .map((defense) => (
                              <DefenseNotice
                                key={defense.id}
                                defense={defense}
                              />
                            ))}
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <DocumentActions
                              kind="proposals"
                              entityId={proposal.id}
                              filename={proposal.originalFilename}
                              fallbackName="proposal.pdf"
                              onError={showError}
                            />
                            {proposal.deletedAt ? (
                              <span className="text-xs text-slate-400">
                                Deleted — view only
                              </span>
                            ) : (
                              <span className="flex gap-2">
                                {proposal.studentResponse &&
                                  proposalsToReview.includes(proposal) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void approveCorrection(proposal)
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                                    >
                                      Approve
                                    </button>
                                  )}
                                <button
                                  type="button"
                                  onClick={() => openReview(proposal)}
                                  className={
                                    proposalsToReview.includes(proposal)
                                      ? smallPrimaryButtonClass
                                      : "inline-flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                                  }
                                >
                                  {proposalsToReview.includes(proposal)
                                    ? "Review"
                                    : "Change review"}
                                </button>
                              </span>
                            )}
                          </div>
                        </li>
                      )}

                      {paper && (
                        <li>
                          <p className="text-sm font-medium text-slate-800">
                            Progress reports
                          </p>
                          {reports.length === 0 ? (
                            <p className="mt-1 text-xs text-slate-500">
                              No progress reports submitted yet.
                            </p>
                          ) : (
                            reports.map((report) => (
                              <div
                                key={report.id}
                                className="mt-2 rounded-lg bg-slate-50 p-3 text-sm"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="font-medium text-slate-800">
                                      {report.phaseLabel ?? "Progress report"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      By {report.submittedByName ?? "student"} ·{" "}
                                      {formatDate(report.submittedAt)}
                                      {report.deadlineAt
                                        ? ` · deadline ${formatDateTime(report.deadlineAt)}`
                                        : ""}
                                    </p>
                                  </div>
                                  <StatusBadge status={report.status} />
                                </div>
                                <p className="mt-2 whitespace-pre-line text-slate-700">
                                  {report.content}
                                </p>
                                {report.reviewComment && (
                                  <p className="mt-1 text-xs text-blue-600">
                                    Your comment: "{report.reviewComment}"
                                  </p>
                                )}
                                {defenses
                                  .filter(
                                    (defense) =>
                                      defense.progressReportId === report.id,
                                  )
                                  .map((defense) => (
                                    <DefenseNotice
                                      key={defense.id}
                                      defense={defense}
                                    />
                                  ))}
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                                  <DocumentActions
                                    kind="progress-reports"
                                    entityId={report.id}
                                    filename={report.originalFilename}
                                    fallbackName="progress-report.pdf"
                                    onError={showError}
                                  />
                                  {report.status === "submitted" &&
                                    reviewButton("Review", () =>
                                      openReportReview(report),
                                    )}
                                </div>
                              </div>
                            ))
                          )}
                        </li>
                      )}

                      {paper && (
                        <li>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-800">
                              Final report
                            </p>
                            <StatusBadge
                              status={
                                paper.finalReportStatus ?? "not_submitted"
                              }
                            />
                          </div>
                          {paper.finalReportReviewComment && (
                            <p className="mt-1 text-xs text-blue-600">
                              Your comment: "{paper.finalReportReviewComment}"
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <DocumentActions
                              kind="papers"
                              entityId={paper.id}
                              filename={paper.finalReportOriginalFilename}
                              fallbackName="final-report.pdf"
                              onError={showError}
                            />
                            {paper.finalReportStatus === "submitted" &&
                              reviewButton("Review", () =>
                                openFinalReportReview(paper),
                              )}
                          </div>
                        </li>
                      )}

                      {paper && (
                        <li>
                          <p className="text-sm font-medium text-slate-800">
                            Final defense
                          </p>
                          {finalDefenses.length === 0 ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {paper.finalReportStatus === "approved"
                                ? "Not scheduled yet. The department schedules it now that you've approved the final report."
                                : "Scheduled by the department after you approve the final report."}
                            </p>
                          ) : (
                            finalDefenses.map((defense) => (
                              <div
                                key={defense.id}
                                className={`mt-2 rounded-lg border p-3 text-sm ${DEFENSE_TONE_STYLES[defenseTone(defense)].card}`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-slate-700">
                                    {formatDefenseDate(defense.defenseDate)}
                                    {defense.scheduledTime
                                      ? ` at ${defense.scheduledTime.slice(0, 5)}`
                                      : ""}
                                    {defense.location
                                      ? ` · ${defense.location}`
                                      : ""}
                                  </p>
                                  <span
                                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${DEFENSE_TONE_STYLES[defenseTone(defense)].badge}`}
                                  >
                                    {defense.currentStatus === "pending" &&
                                    !defense.submissionConfirmed
                                      ? "Awaiting thesis"
                                      : DEFENSE_TONE_LABELS[
                                          defenseTone(defense)
                                        ]}
                                  </span>
                                </div>
                                {defense.panelNames.length > 0 && (
                                  <p className="text-xs text-slate-500">
                                    Panel: {defense.panelNames.join(", ")}
                                  </p>
                                )}
                                {defense.requiresRedefense && (
                                  <p className="mt-1 text-xs font-medium text-amber-800">
                                    Has to be defended again — the department
                                    will announce the new date.
                                  </p>
                                )}
                                {defense.outcomeComments && (
                                  <p className="mt-1 whitespace-pre-line text-xs text-slate-700">
                                    <span className="font-semibold">
                                      Panel feedback
                                      {defense.outcomeRecordedByName
                                        ? ` (${defense.outcomeRecordedByName})`
                                        : ""}
                                      :
                                    </span>{" "}
                                    {defense.outcomeComments}
                                  </p>
                                )}
                                <div className="mt-2">
                                  <DocumentActions
                                    kind="defenses"
                                    entityId={defense.id}
                                    filename={defense.originalFilename}
                                    fallbackName="final-thesis.pdf"
                                    onError={showError}
                                    viewLabel="View thesis"
                                  />
                                </div>
                              </div>
                            ))
                          )}
                        </li>
                      )}
                    </ol>
                  </article>
                );
              })
            )}
          </div>
        )}

        {section === "panels" && (
          <div className="space-y-4">
            <SectionHeader
              title="Defenses you sit on"
              description="Which report is defended, when, where, and the document to assess. After the defense day, give your verdict; the panel's majority decides."
            />
            <SegmentedControl
              label="Degree level"
              options={countAtLevel(
                panelDefenses,
                (defense) => defense.degreeLevel,
              )}
              value={panelLevel}
              onChange={setPanelLevel}
            />
            {visiblePanels.length === 0 ? (
              <EmptyState title="You aren't on any panel here yet">
                The department adds you to a panel when it schedules a defense.
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {visiblePanels.map((defense) => (
                  <div key={defense.id}>
                    <DefenseCard
                      defense={defense}
                      showPeople
                      onError={showError}
                    />
                    {defense.hasEnded &&
                      defense.currentStatus === "pending" && (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                          <p className="text-xs text-blue-900">
                            Your panel decides this one. The outcome is settled
                            once every member has voted.
                          </p>
                          {reviewButton("Give or change verdict", () =>
                            openVerdict(defense),
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </AppShell>

      {reviewing && (
        <Modal
          title="Review proposal"
          subtitle={reviewing.title}
          onClose={closeReview}
        >
          {reviewing.studentResponse && (
            <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              {reviewing.respondedByName
                ? `${reviewing.respondedByName} addressed your feedback: `
                : "The group replied: "}
              "{reviewing.studentResponse}"
            </p>
          )}
          <div className="mt-4">
            <DocumentActions
              kind="proposals"
              entityId={reviewing.id}
              filename={reviewing.originalFilename}
              fallbackName="proposal.pdf"
              onError={setReviewError}
            />
          </div>
          <form onSubmit={submitReview} className="mt-4 space-y-4">
            <DecisionPicker value={decision} onChange={setDecision} />
            <label className="block text-sm font-medium text-slate-700">
              Comment{" "}
              <span className="font-normal text-slate-500">(optional)</span>
              <textarea
                rows={4}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Share feedback with the student..."
                className={inputClass}
              />
            </label>
            <FormError message={reviewError} />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeReview}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingReview}
                className={primaryButtonClass}
              >
                {isSubmittingReview ? "Submitting..." : "Submit review"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {(reviewingReport || reviewingFinalReport) && (
        <Modal
          title={
            reviewingReport ? "Review progress report" : "Review final report"
          }
          subtitle={
            reviewingReport
              ? `${reviewingReport.phaseLabel ?? "Progress report"} · ${paperTitle(reviewingReport.paperId)}`
              : reviewingFinalReport?.title
          }
          onClose={closePaperReview}
        >
          {reviewingReport && (
            <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {reviewingReport.content}
            </p>
          )}
          <div className="mt-4">
            {reviewingReport ? (
              <DocumentActions
                kind="progress-reports"
                entityId={reviewingReport.id}
                filename={reviewingReport.originalFilename}
                fallbackName="progress-report.pdf"
                onError={setPaperError}
              />
            ) : (
              reviewingFinalReport && (
                <DocumentActions
                  kind="papers"
                  entityId={reviewingFinalReport.id}
                  filename={reviewingFinalReport.finalReportOriginalFilename}
                  fallbackName="final-report.pdf"
                  onError={setPaperError}
                />
              )
            )}
          </div>
          <form
            onSubmit={
              reviewingReport ? submitReportReview : submitFinalReportReview
            }
            className="mt-4 space-y-4"
          >
            <DecisionPicker value={paperDecision} onChange={setPaperDecision} />
            <label className="block text-sm font-medium text-slate-700">
              Comment{" "}
              <span className="font-normal text-slate-500">(optional)</span>
              <textarea
                rows={4}
                value={paperComment}
                onChange={(event) => setPaperComment(event.target.value)}
                placeholder="Share feedback with the student..."
                className={inputClass}
              />
            </label>
            <FormError message={paperError} />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closePaperReview}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingPaperReview}
                className={primaryButtonClass}
              >
                {isSubmittingPaperReview ? "Submitting..." : "Submit review"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {verdictTarget && (
        <Modal
          title="Your verdict"
          subtitle={`${verdictTarget.paperTitle ?? "Untitled research"} · ${verdictTarget.studentNames.join(", ") || "the student"}`}
          onClose={() => setVerdictTarget(null)}
        >
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            The panel of {verdictTarget.panelNames.length} decides this by
            majority. Nobody sees your vote until every member has voted. If you
            already voted, submitting again replaces your vote.
          </p>
          <form onSubmit={submitVerdict} className="mt-4 space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    value: "accept" as const,
                    label: "Accept",
                    hint: "Passed, as far as you are concerned.",
                    selected: "border-emerald-400 bg-emerald-50",
                  },
                  {
                    value: "reject" as const,
                    label: "Reject",
                    hint: "Not good enough yet. Say why below.",
                    selected: "border-red-400 bg-red-50",
                  },
                ] as const
              ).map((choice) => (
                <label
                  key={choice.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${verdictForm.verdict === choice.value ? choice.selected : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <input
                    type="radio"
                    name="verdict"
                    className="mt-1"
                    checked={verdictForm.verdict === choice.value}
                    onChange={() =>
                      setVerdictForm({
                        ...verdictForm,
                        verdict: choice.value,
                      })
                    }
                  />
                  <span>
                    <span className="block font-medium text-slate-800">
                      {choice.label}
                    </span>
                    <span className="text-xs text-slate-500">
                      {choice.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Feedback for the student
              {verdictForm.verdict === "reject" ? "" : " (optional)"}
              <textarea
                required={verdictForm.verdict === "reject"}
                rows={4}
                value={verdictForm.comments}
                onChange={(event) =>
                  setVerdictForm({
                    ...verdictForm,
                    comments: event.target.value,
                  })
                }
                placeholder="What the student should know about your decision."
                className={inputClass}
              />
            </label>
            <FormError message={verdictError} />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setVerdictTarget(null)}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingVerdict}
                className={primaryButtonClass}
              >
                {isSavingVerdict ? "Saving..." : "Submit verdict"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default ProfessorDashboard;
