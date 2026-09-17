import { useEffect, useState } from "react";
import { Download, Eye, FileText, Menu, X } from "lucide-react";
import { gql } from "@apollo/client";
import { print } from "graphql";
import { useNavigate } from "react-router-dom";
import NavigationBar from "../components/NavigationBar";
import NotificationBell from "../components/NotificationBell";
import DefenseNotice from "../components/DefenseNotice";
import DefenseCard, { type DefenseDetails } from "../components/DefenseCard";
import { isPastDefense } from "../utils/defenses";
import { MY_PANEL_DEFENSES_QUERY } from "../queries/queries";
import { resolveAvatarUrl, uploadAvatarImage } from "../utils/uploadAvatar";
import { downloadDocumentFile, downloadProposalFile, viewDocumentFile, viewProposalFile } from "../utils/proposalFile";

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
  panelNames: string[];
  defenseDate: string;
  scheduledTime: string | null;
  location: string | null;
  submissionConfirmed: boolean;
  originalFilename: string | null;
  currentStatus: string;
}

interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

type Decision = "approved" | "rejected" | "changes_requested";
type ResearchTab = "proposals" | "progress" | "final" | "panels";
type PanelLevel = "bachelors" | "masters" | "phd";
const PANEL_LEVELS: { value: PanelLevel; label: string }[] = [
  { value: "bachelors", label: "Bachelor's defense" },
  { value: "masters", label: "Master's defense" },
  { value: "phd", label: "PhD defense" },
];

const ENDPOINT = "http://127.0.0.1:8000/graphql";
const CURRENT_USER = gql`query CurrentUser { currentUser { name avatarUrl } }`;
const MY_PROFILE = gql`query MyProfessorProfile { myProfessorProfile { name email avatarUrl departmentName academicRank maxStudents } }`;
const ASSIGNED_PROPOSALS = gql`
  query AssignedProposals {
    assignedProposals {
      id
      submittedByName
      title
      status
      supervisorName
      clusterName
      groupMembers { id name }
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
    reviewProposal(professorInput: $professorInput) { id status reviewComment reviewedByName }
  }
`;
const SUPERVISED_PAPERS = gql`query SupervisedPapers { supervisedPapers { id title status finalReportStatus finalReportReviewComment finalReportOriginalFilename } }`;
const SUPERVISED_PROGRESS_REPORTS = gql`query SupervisedProgressReports { supervisedProgressReports { id paperId submittedByName content status submittedAt originalFilename reviewComment phaseLabel deadlineAt } }`;
const SUPERVISED_DEFENSES = gql`query SupervisedDefenses { supervisedDefenses { id kind paperId proposalId progressReportId panelNames defenseDate scheduledTime location submissionConfirmed originalFilename currentStatus } }`;
const REVIEW_PROGRESS_REPORT = gql`mutation ReviewProgressReport($professorInput: ProgressReportReviewInput!) { reviewProgressReport(professorInput: $professorInput) { id status } }`;
const REVIEW_FINAL_REPORT = gql`mutation ReviewFinalReport($professorInput: FinalReportReviewInput!) { reviewFinalReport(professorInput: $professorInput) { id finalReportStatus } }`;

const statusStyles: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  accepted: "bg-emerald-50 text-emerald-700",
  submitted: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-700",
  changes_requested: "bg-amber-50 text-amber-700",
  assigned: "bg-slate-100 text-slate-600",
};

const formatStatus = (status: string) => status.replace(/_/g, " ");

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

function ProfessorDashboard() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Proposal | null>(null);
  const [decision, setDecision] = useState<Decision>("approved");
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [activeView, setActiveView] = useState<"proposals" | "profile">("proposals");
  const [researchTab, setResearchTab] = useState<ResearchTab>("proposals");
  const [proposalLevel, setProposalLevel] = useState<PanelLevel>("bachelors");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [defenses, setDefenses] = useState<Defense[]>([]);
  const [panelDefenses, setPanelDefenses] = useState<DefenseDetails[]>([]);
  const [panelLevel, setPanelLevel] = useState<PanelLevel>("bachelors");
  const [paperError, setPaperError] = useState<string | null>(null);
  const [reviewingReport, setReviewingReport] = useState<ProgressReport | null>(null);
  const [reviewingFinalReport, setReviewingFinalReport] = useState<Paper | null>(null);
  const [paperDecision, setPaperDecision] = useState<Decision>("approved");
  const [paperComment, setPaperComment] = useState("");

  const load = async () => {
    try {
      const result = await request<{ assignedProposals: Proposal[] }>(ASSIGNED_PROPOSALS);
      setProposals(result.assignedProposals);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load assigned proposals.");
    }
  };

  const loadPapers = async () => {
    try {
      const [papersResult, reportsResult, defensesResult, panelResult] = await Promise.all([
        request<{ supervisedPapers: Paper[] }>(SUPERVISED_PAPERS),
        request<{ supervisedProgressReports: ProgressReport[] }>(SUPERVISED_PROGRESS_REPORTS),
        request<{ supervisedDefenses: Defense[] }>(SUPERVISED_DEFENSES),
        request<{ myPanelDefenses: DefenseDetails[] }>(MY_PANEL_DEFENSES_QUERY),
      ]);
      setPapers(papersResult.supervisedPapers);
      setProgressReports(reportsResult.supervisedProgressReports);
      setDefenses(defensesResult.supervisedDefenses);
      setPanelDefenses(panelResult.myPanelDefenses);
    } catch (requestError) {
      setPaperError(requestError instanceof Error ? requestError.message : "Unable to load supervised papers.");
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await load();
      await loadPapers();
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
    void initialize();
  }, []);

  const handleUploadAvatar = async (file: File) => {
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const avatarUrl = await uploadAvatarImage(file);
      setCurrentUser((current) => (current ? { ...current, avatarUrl } : current));
      setProfile((current) => (current ? { ...current, avatarUrl } : current));
    } catch (uploadError) {
      setAvatarError(uploadError instanceof Error ? uploadError.message : "Unable to upload image.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const openReview = (proposal: Proposal) => {
    setReviewing(proposal);
    setDecision(
      proposal.status === "approved" || proposal.status === "rejected" || proposal.status === "changes_requested"
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
        professorInput: { proposalId: reviewing.id, status: decision, comment: comment.trim() || null },
      });
      closeReview();
      await load();
    } catch (requestError) {
      setReviewError(requestError instanceof Error ? requestError.message : "Unable to submit review.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // A student's written reply to "changes_requested" feedback comes back with status
  // "submitted" again — approving it here is the same reviewProposal call, just a
  // one-click shortcut instead of opening the full review form for the common case.
  const approveCorrection = async (proposal: Proposal) => {
    setError(null);
    try {
      await request(REVIEW_PROPOSAL, { professorInput: { proposalId: proposal.id, status: "approved", comment: null } });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to approve the proposal.");
    }
  };

  const openReportReview = (report: ProgressReport) => {
    setReviewingReport(report);
    setPaperDecision("approved");
    setPaperComment("");
    setPaperError(null);
  };

  const submitReportReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewingReport) return;
    setPaperError(null);
    try {
      await request(REVIEW_PROGRESS_REPORT, {
        professorInput: { id: reviewingReport.id, status: paperDecision, comment: paperComment.trim() || null },
      });
      setReviewingReport(null);
      await loadPapers();
    } catch (requestError) {
      setPaperError(requestError instanceof Error ? requestError.message : "Unable to submit review.");
    }
  };

  const openFinalReportReview = (paper: Paper) => {
    setReviewingFinalReport(paper);
    setPaperDecision("approved");
    setPaperComment("");
    setPaperError(null);
  };

  const submitFinalReportReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewingFinalReport) return;
    setPaperError(null);
    try {
      await request(REVIEW_FINAL_REPORT, {
        professorInput: { paperId: reviewingFinalReport.id, status: paperDecision, comment: paperComment.trim() || null },
      });
      setReviewingFinalReport(null);
      await loadPapers();
    } catch (requestError) {
      setPaperError(requestError instanceof Error ? requestError.message : "Unable to submit review.");
    }
  };

  const tabs: { value: ResearchTab; label: string; count: number }[] = [
    { value: "proposals", label: "Proposals", count: proposals.filter((proposal) => !proposal.deletedAt && ["submitted", "assigned"].includes(proposal.status)).length },
    { value: "progress", label: "Progress reports", count: progressReports.filter((report) => report.status === "submitted").length },
    { value: "final", label: "Final submissions", count: papers.filter((paper) => paper.finalReportStatus === "submitted").length },
    { value: "panels", label: "Defense panels", count: panelDefenses.filter((defense) => !isPastDefense(defense) && defense.currentStatus === "pending").length },
  ];
  const proposalsAtLevel = (level: PanelLevel) => proposals.filter((proposal) => proposal.degreeLevel === level);
  const panelDefensesAtLevel = (level: PanelLevel) => panelDefenses.filter((defense) => defense.degreeLevel === level);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      <NavigationBar
        open={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
        role="professor"
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
              <p className="text-xs uppercase tracking-[0.2em] text-blue-600">Professor workspace</p>
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
                  <h2 className="text-2xl font-semibold text-slate-900">{profile?.name ?? "Professor"}</h2>
                </div>
                {profile ? (
                  <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt><dd className="mt-1 text-sm text-slate-700">{profile.email}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Department</dt><dd className="mt-1 text-sm text-slate-700">{profile.departmentName ?? "Not assigned"}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Academic rank</dt><dd className="mt-1 text-sm text-slate-700">{profile.academicRank ?? "Not available"}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Max students</dt><dd className="mt-1 text-sm text-slate-700">{profile.maxStudents ?? "Not available"}</dd></div>
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
                    onClick={() => setResearchTab(item.value)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${researchTab === item.value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    {item.label}
                    {item.count > 0 && (
                      <span className={`rounded-full px-1.5 text-xs ${researchTab === item.value ? "bg-white/25 text-white" : "bg-amber-100 text-amber-800"}`} title="Waiting for your review">{item.count}</span>
                    )}
                  </button>
                ))}
              </div>
              {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              {paperError && !reviewingReport && !reviewingFinalReport && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{paperError}</p>}
              {researchTab === "proposals" && (
              <div>
              <p className="mt-4 text-sm text-slate-500">Proposals assigned to you by your department administrator. Bachelor's proposals are group work; Master's and PhD proposals are individual.</p>
              <div className="mt-4 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Degree level">
                {PANEL_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    role="tab"
                    aria-selected={proposalLevel === level.value}
                    onClick={() => setProposalLevel(level.value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${proposalLevel === level.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    {level.label.replace("defense", "proposals")} <span className="ml-1 text-xs text-slate-400">{proposalsAtLevel(level.value).length}</span>
                  </button>
                ))}
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Proposal</th>
                      <th className="px-4 py-3">Students</th>
                      <th className="px-4 py-3">Cluster</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposalsAtLevel(proposalLevel).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          No {PANEL_LEVELS.find((level) => level.value === proposalLevel)?.label.replace(" defense", "")} proposals have been assigned to you.
                        </td>
                      </tr>
                    ) : (
                      proposalsAtLevel(proposalLevel).map((proposal) => (
                        <tr key={proposal.id} className="border-b border-slate-100">
                          <td className="px-4 py-3 font-medium text-slate-800">{proposal.title}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {[proposal.submittedByName ?? "Unknown student", ...proposal.groupMembers.map((member) => member.name)].join(", ")}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{proposal.clusterName ?? "Not assigned"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[proposal.status] ?? "bg-slate-100 text-slate-600"}`}>
                              {formatStatus(proposal.status)}
                            </span>
                            {proposal.deletedAt && (
                              <span className="ml-1 inline-block rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">Deleted</span>
                            )}
                            {proposal.reviewComment && (
                              <p className="mt-1 max-w-xs text-xs text-slate-500">"{proposal.reviewComment}"</p>
                            )}
                            {proposal.studentResponse && (
                              <p className="mt-1 max-w-xs text-xs text-blue-600">{proposal.respondedByName ? `${proposal.respondedByName} replied: ` : "Reply: "}"{proposal.studentResponse}"</p>
                            )}
                            {proposal.deletedAt && (
                              <p className="mt-1 max-w-xs text-xs text-slate-400">Deleted by {proposal.deletedByName ?? "an admin"} on {new Date(proposal.deletedAt).toLocaleDateString()}</p>
                            )}
                            {defenses.filter((defense) => defense.proposalId === proposal.id).map((defense) => <div key={defense.id} className="max-w-xs"><DefenseNotice defense={defense} /></div>)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {proposal.originalFilename && (
                              <>
                                <button
                                  type="button"
                                  title="View proposal document"
                                  onClick={() => void viewProposalFile(proposal.id).catch((viewError: unknown) => setError(viewError instanceof Error ? viewError.message : "Unable to open the document."))}
                                  className="mr-1 inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  type="button"
                                  title="Download proposal document"
                                  onClick={() => void downloadProposalFile(proposal.id, proposal.originalFilename ?? "proposal.pdf").catch((downloadError: unknown) => setError(downloadError instanceof Error ? downloadError.message : "Unable to download the document."))}
                                  className="mr-2 inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <Download size={16} />
                                </button>
                              </>
                            )}
                            {proposal.deletedAt ? (
                              <span className="text-xs text-slate-400">Deleted — view only</span>
                            ) : (
                              <>
                                {proposal.studentResponse && (
                                  <button
                                    type="button"
                                    onClick={() => void approveCorrection(proposal)}
                                    className="mr-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openReview(proposal)}
                                  className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                                >
                                  Review
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
              )}
              {researchTab === "panels" && (
                <div className="mt-4">
                  <p className="text-sm text-slate-500">Defenses you are on the panel of: which report is defended, when, where, and the document to assess.</p>
                  <div className="mt-4 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Degree level">
                    {PANEL_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        role="tab"
                        aria-selected={panelLevel === level.value}
                        onClick={() => setPanelLevel(level.value)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${panelLevel === level.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                      >
                        {level.label} <span className="ml-1 text-xs text-slate-400">{panelDefensesAtLevel(level.value).length}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 space-y-3">
                    {panelDefensesAtLevel(panelLevel).length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                        You aren't on any {PANEL_LEVELS.find((level) => level.value === panelLevel)?.label.toLowerCase()} panel yet.
                      </p>
                    ) : (
                      panelDefensesAtLevel(panelLevel)
                        .sort((first, second) => Number(isPastDefense(first)) - Number(isPastDefense(second)) || new Date(first.defenseDate).getTime() - new Date(second.defenseDate).getTime())
                        .map((defense) => <DefenseCard key={defense.id} defense={defense} showPeople onError={(message) => setError(message)} />)
                    )}
                  </div>
                </div>
              )}
              {researchTab === "progress" && (
                <div className="mt-4">
                  <p className="text-sm text-slate-500">Progress reports submitted by the students you supervise, grouped by paper.</p>
                  {papers.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No supervised papers yet. A paper is created when you approve a proposal.</p>
                  ) : (
                    papers.map((paper) => {
                      const reports = progressReports.filter((report) => report.paperId === paper.id);
                      return (
                        <div key={paper.id} className="mt-4 rounded-xl border border-slate-200 p-4">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FileText size={16} aria-hidden="true" /> {paper.title}</h3>
                          {reports.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-500">No progress reports submitted yet.</p>
                          ) : (
                            reports.map((report) => (
                              <div key={report.id} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="font-medium text-slate-800">{report.phaseLabel ?? "Progress report"}</p>
                                    <p className="text-xs text-slate-500">By {report.submittedByName ?? "student"} · {new Date(report.submittedAt).toLocaleDateString()}{report.deadlineAt ? ` · deadline ${new Date(report.deadlineAt).toLocaleString()}` : ""}</p>
                                  </div>
                                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[report.status] ?? "bg-slate-100 text-slate-600"}`}>{formatStatus(report.status)}</span>
                                </div>
                                <p className="mt-2 whitespace-pre-line text-slate-700">{report.content}</p>
                                {report.reviewComment && <p className="mt-1 text-xs text-blue-600">Your comment: "{report.reviewComment}"</p>}
                                {defenses.filter((defense) => defense.progressReportId === report.id).map((defense) => <DefenseNotice key={defense.id} defense={defense} />)}
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                  {report.originalFilename && (
                                    <>
                                      <button type="button" onClick={() => void viewDocumentFile("progress-reports", report.id).catch((viewError: unknown) => setError(viewError instanceof Error ? viewError.message : "Unable to open the document."))} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"><Eye size={14} /> View</button>
                                      <button type="button" onClick={() => void downloadDocumentFile("progress-reports", report.id, report.originalFilename ?? "progress-report.pdf").catch((downloadError: unknown) => setError(downloadError instanceof Error ? downloadError.message : "Unable to download the document."))} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"><Download size={14} /> Download</button>
                                    </>
                                  )}
                                  {report.status === "submitted" && (
                                    <button type="button" onClick={() => openReportReview(report)} className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">Review</button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {researchTab === "final" && (
                <div className="mt-4">
                  <p className="text-sm text-slate-500">Final reports to review, and the defenses your department has scheduled for your students.</p>
                  {papers.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No supervised papers yet. A paper is created when you approve a proposal.</p>
                  ) : (
                    papers.map((paper) => (
                      <div key={paper.id} className="mt-4 rounded-xl border border-slate-200 p-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FileText size={16} aria-hidden="true" /> {paper.title}</h3>
                        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-slate-800">Final report</p>
                            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[paper.finalReportStatus ?? ""] ?? "bg-slate-100 text-slate-600"}`}>
                              {paper.finalReportStatus ? formatStatus(paper.finalReportStatus) : "Not submitted"}
                            </span>
                          </div>
                          {paper.finalReportReviewComment && <p className="mt-1 text-xs text-blue-600">Your comment: "{paper.finalReportReviewComment}"</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            {paper.finalReportOriginalFilename && (
                              <>
                                <button type="button" onClick={() => void viewDocumentFile("papers", paper.id).catch((viewError: unknown) => setError(viewError instanceof Error ? viewError.message : "Unable to open the document."))} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"><Eye size={14} /> View</button>
                                <button type="button" onClick={() => void downloadDocumentFile("papers", paper.id, paper.finalReportOriginalFilename ?? "final-report.pdf").catch((downloadError: unknown) => setError(downloadError instanceof Error ? downloadError.message : "Unable to download the document."))} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"><Download size={14} /> Download</button>
                              </>
                            )}
                            {paper.finalReportStatus === "submitted" && (
                              <button type="button" onClick={() => openFinalReportReview(paper)} className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">Review</button>
                            )}
                          </div>
                        </div>
                        {defenses.filter((defense) => defense.paperId === paper.id).length === 0 ? (
                          <p className="mt-3 text-xs text-slate-500">No defense scheduled yet. The department schedules it after you approve the final report.</p>
                        ) : (
                          defenses.filter((defense) => defense.paperId === paper.id).map((defense) => (
                            <div key={defense.id} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium text-slate-800">Final defense</p>
                                <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                                  {defense.submissionConfirmed ? (defense.currentStatus === "pending" ? "Thesis submitted" : formatStatus(defense.currentStatus)) : "Awaiting thesis"}
                                </span>
                              </div>
                              <p className="mt-1 text-slate-700">{new Date(defense.defenseDate).toLocaleDateString()}{defense.scheduledTime ? ` at ${defense.scheduledTime.slice(0, 5)}` : ""}{defense.location ? ` · ${defense.location}` : ""}</p>
                              {defense.panelNames.length > 0 && <p className="text-xs text-slate-500">Panel: {defense.panelNames.join(", ")}</p>}
                              {defense.originalFilename && (
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                  <button type="button" onClick={() => void viewDocumentFile("defenses", defense.id).catch((viewError: unknown) => setError(viewError instanceof Error ? viewError.message : "Unable to open the document."))} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"><Eye size={14} /> View thesis</button>
                                  <button type="button" onClick={() => void downloadDocumentFile("defenses", defense.id, defense.originalFilename ?? "final-thesis.pdf").catch((downloadError: unknown) => setError(downloadError instanceof Error ? downloadError.message : "Unable to download the document."))} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"><Download size={14} /> Download</button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Review proposal</h2>
                <p className="mt-1 text-sm text-slate-500">{reviewing.title}</p>
              </div>
              <button
                type="button"
                aria-label="Close review form"
                onClick={closeReview}
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {reviewing.studentResponse && (
              <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                {reviewing.respondedByName ? `${reviewing.respondedByName} addressed your feedback: ` : "The group replied: "}"{reviewing.studentResponse}"
              </p>
            )}
            <form onSubmit={submitReview} className="mt-6 space-y-4">
              <div className="grid gap-1.5 text-sm font-medium text-slate-700">
                Decision
                <div className="flex flex-wrap gap-2">
                  {(["approved", "changes_requested", "rejected"] as Decision[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDecision(option)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                        decision === option
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {formatStatus(option)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Comment <span className="font-normal text-slate-500">(optional)</span>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Share feedback with the student..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              {reviewError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{reviewError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeReview}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingReview ? "Submitting..." : "Submit review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {(reviewingReport || reviewingFinalReport) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{reviewingReport ? "Review progress report" : "Review final report"}</h2>
                {reviewingReport && <p className="mt-1 text-sm text-slate-500">{reviewingReport.content}</p>}
              </div>
              <button
                type="button"
                aria-label="Close review form"
                onClick={() => { setReviewingReport(null); setReviewingFinalReport(null); }}
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={reviewingReport ? submitReportReview : submitFinalReportReview} className="mt-6 space-y-4">
              <div className="grid gap-1.5 text-sm font-medium text-slate-700">
                Decision
                <div className="flex flex-wrap gap-2">
                  {(["approved", "changes_requested", "rejected"] as Decision[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPaperDecision(option)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                        paperDecision === option
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {formatStatus(option)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Comment <span className="font-normal text-slate-500">(optional)</span>
                <textarea
                  rows={4}
                  value={paperComment}
                  onChange={(event) => setPaperComment(event.target.value)}
                  placeholder="Share feedback with the student..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              {paperError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{paperError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setReviewingReport(null); setReviewingFinalReport(null); }}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Submit review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfessorDashboard;
