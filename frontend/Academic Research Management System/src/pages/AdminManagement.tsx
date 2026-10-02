import { useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  Gavel,
  Layers,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { gql } from "@apollo/client";
import { print } from "graphql";
import {
  BlockedReason,
  Card,
  DocumentActions,
  EmptyState,
  SectionHeader,
  SegmentedControl,
  StatCard,
  StatusBadge,
} from "../components/ui";
import { useToast } from "../hooks/useToast";
import { errorMessage, formatStatus } from "../utils/format";
import {
  DEFENSE_TONE_LABELS,
  DEFENSE_TONE_STYLES,
  defenseTone,
  formatDefenseDate,
} from "../utils/defenses";
import {
  CURRENT_BATCH_QUERY,
  DEFENSE_CANDIDATES_QUERY,
  PROFILES_QUERY,
  RESEARCH_PHASE_OPTIONS_QUERY,
  RESEARCH_PHASES_QUERY,
} from "../queries/queries";
import {
  CLOSE_RESEARCH_PHASE,
  CREATE_RESEARCH_PHASE,
  DELETE_RESEARCH_PHASE,
  OPEN_RESEARCH_PHASE,
  SCHEDULE_RESEARCH_DEFENSE,
  UPDATE_RESEARCH_PHASE,
} from "../mutations/mutations";

interface Department {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}
interface DegreeProgram {
  id: string;
  name: string;
  level: string;
  departmentId: string;
}
interface Cluster {
  id: string;
  name: string;
  departmentId: string;
}
interface User {
  id: string;
  name: string;
  role: string;
  degreeProgramId: string | null;
}
interface Proposal {
  id: string;
  submittedBy: string | null;
  submittedByName: string | null;
  title: string;
  status: string;
  supervisorId: string | null;
  supervisorName: string | null;
  clusterId: string | null;
  groupMembers: { id: string; name: string; status: string }[];
  reviewComment: string | null;
  reviewedByName: string | null;
  deletedAt: string | null;
  deletedByName: string | null;
  originalFilename: string | null;
  degreeLevel: string | null;
}
interface Profile {
  userId: string;
  userName: string;
  role: string;
  departmentId: string;
  departmentName: string;
  degreeProgramName: string | null;
  supervisorName: string | null;
  supervisorId: string | null;
  academicRank: string | null;
  maxStudents: number | null;
  status: string | null;
  rollNumber: string | null;
}
interface ScheduledDefense {
  id: string;
  kind: string;
  proposalId: string | null;
  progressReportId: string | null;
  paperId: string | null;
  paperTitle: string | null;
  defenseDate: string;
  scheduledTime: string | null;
  location: string | null;
  submissionConfirmed: boolean;
  phaseId: string | null;
  phaseLabel: string | null;
  currentStatus: string;
  degreeLevel: string | null;
  studentNames: string[];
  supervisorName: string | null;
  panelNames: string[];
  panelProfessorIds: string[];
  outcomeComments: string | null;
  outcomeRecordedAt: string | null;
  outcomeRecordedByName: string | null;
  requiresRedefense: boolean;
  hasEnded: boolean;
}
type DefenseKind = "proposal" | "progress_report" | "defense";
interface DefenseCandidate {
  // Filled in on the client for the all-levels overview list.
  degreeLevel?: string;
  kind: DefenseKind;
  targetId: string;
  title: string;
  status: string;
  studentNames: string[];
  supervisorName: string | null;
  phaseId: string | null;
  phaseLabel: string | null;
  suggestedDate: string | null;
  defense: ScheduledDefense | null;
}
// What the plan-defense form is planning: one proposal, progress report or final report.
interface PlanTarget {
  kind: string;
  targetId: string;
  title: string;
  phaseId: string | null;
  suggestedDate: string | null;
  supervisorName: string | null;
  existing: ScheduledDefense | null;
}
interface ResearchPhase {
  id: string;
  phaseType: string;
  degreeLevel: string;
  label: string;
  sequenceNumber: number;
  opensAt: string | null;
  deadlineAt: string | null;
  defenseDate: string | null;
  gracePeriodEnabled: boolean;
  isOpen: boolean;
  hasEnded: boolean;
  // pending | open | closed — set by the admin, never by the deadline passing.
  status: string;
  closedAt: string | null;
}
// Whether a phase type can be added next to a level's timeline (researchPhaseOptions).
interface PhaseOption {
  phaseType: string;
  allowed: boolean;
  reason: string | null;
  sequenceNumber: number;
}
interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

type AdminRole = "admin" | "super_admin";
export type DegreeLevel = "bachelors" | "masters" | "phd";
// The screens this module draws; the dashboard shell picks one from the URL.
export type AdminView =
  | "overview"
  | "timeline"
  | "proposals"
  | "defenses"
  | "setup"
  | "departments";
// What the sidebar and level picker show as waiting for the admin.
export interface AdminBadges {
  proposals: number;
  defenses: number;
  // Per level, so the level picker can show the count for the page it is on.
  proposalsByLevel: Record<DegreeLevel, number>;
  defensesByLevel: Record<DegreeLevel, number>;
}
interface Batch {
  id: string;
  label: string;
  status: string;
  startedAt: string;
}
interface AdminManagementProps {
  role: AdminRole;
  view: AdminView;
  // Timeline, proposals and defenses work on one degree level at a time.
  level: DegreeLevel;
  onNavigate: (section: AdminView | "people", level?: DegreeLevel) => void;
  onBadgesChange?: (badges: AdminBadges) => void;
  // Bumped by the dashboard when people change elsewhere, so the lists here reload.
  refreshKey?: number;
  // The admin's own department, named on the overview.
  departmentLabel?: string | null;
}
const ENDPOINT = import.meta.env.VITE_API_URL
const DEPARTMENTS = gql`
  query Departments {
    departments {
      id
      name
      code
      createdAt
    }
  }
`;
const DEGREES = gql`
  query DegreePrograms {
    degreePrograms {
      id
      name
      level
      departmentId
    }
  }
`;
const CLUSTERS = gql`
  query Clusters {
    clusters {
      id
      name
      departmentId
    }
  }
`;
const USERS = gql`
  query Users {
    users {
      id
      name
      role
      degreeProgramId
    }
  }
`;
const PROPOSALS = gql`
  query Proposals($includeDeleted: Boolean!) {
    proposals(includeDeleted: $includeDeleted) {
      id
      submittedBy
      submittedByName
      title
      status
      supervisorId
      supervisorName
      clusterId
      groupMembers {
        id
        name
        status
      }
      reviewComment
      reviewedByName
      deletedAt
      deletedByName
      originalFilename
      degreeLevel
    }
  }
`;
const DELETE_PROPOSAL_AS_ADMIN = gql`
  mutation DeleteProposalAsAdmin($adminInput: ProposalDeleteInput!) {
    deleteProposalAsAdmin(adminInput: $adminInput) {
      id
      deletedAt
      deletedByName
    }
  }
`;
const DEPARTMENT_DEFENSES = gql`
  query DepartmentDefenses {
    departmentDefenses {
      id
      kind
      proposalId
      progressReportId
      paperId
      paperTitle
      defenseDate
      scheduledTime
      location
      submissionConfirmed
      phaseId
      phaseLabel
      currentStatus
      degreeLevel
      studentNames
      supervisorName
      panelNames
      panelProfessorIds
      outcomeComments
      outcomeRecordedAt
      outcomeRecordedByName
      requiresRedefense
      hasEnded
    }
  }
`;
const CREATE_DEPARTMENT = gql`
  mutation CreateDepartment($adminInput: DepartmentCreateInput!) {
    createDepartment(adminInput: $adminInput) {
      id
      name
      code
      createdAt
    }
  }
`;
const UPDATE_DEPARTMENT = gql`
  mutation UpdateDepartment($adminInput: DepartmentUpdateInput!) {
    updateDepartment(adminInput: $adminInput) {
      id
      name
      code
      createdAt
    }
  }
`;
const DELETE_DEPARTMENT = gql`
  mutation DeleteDepartment($adminInput: DepartmentDeleteInput!) {
    deleteDepartment(adminInput: $adminInput) {
      id
      name
      code
      createdAt
    }
  }
`;
const CREATE_DEGREE = gql`
  mutation CreateDegree($adminInput: DegreeProgramsInput!) {
    createDegreeProgram(adminInput: $adminInput) {
      id
      name
      level
      departmentId
    }
  }
`;
const UPDATE_DEGREE = gql`
  mutation UpdateDegree($adminInput: DegreeProgramUpdateInput!) {
    updateDegreeProgram(adminInput: $adminInput) {
      id
      name
      level
      departmentId
    }
  }
`;
const DELETE_DEGREE = gql`
  mutation DeleteDegree($adminInput: DegreeProgramDeleteInput!) {
    deleteDegreeProgram(adminInput: $adminInput) {
      id
      name
      level
      departmentId
    }
  }
`;
const CREATE_CLUSTER = gql`
  mutation CreateCluster($adminInput: ClusterInput!) {
    createCluster(adminInput: $adminInput) {
      id
      name
      departmentId
    }
  }
`;
const UPDATE_CLUSTER = gql`
  mutation UpdateCluster($adminInput: ClusterUpdateInput!) {
    updateCluster(adminInput: $adminInput) {
      id
      name
      departmentId
    }
  }
`;
const DELETE_CLUSTER = gql`
  mutation DeleteCluster($adminInput: ClusterDeleteInput!) {
    deleteCluster(adminInput: $adminInput) {
      id
      name
      departmentId
    }
  }
`;
const ASSIGN_PROPOSAL = gql`
  mutation AssignProposal($adminInput: ProposalsReviewInput!) {
    assignProposal(adminInput: $adminInput) {
      id
      submittedBy
      submittedByName
      title
      status
      supervisorId
      supervisorName
      clusterId
    }
  }
`;
const ADD_PROPOSAL_MEMBER_AS_ADMIN = gql`
  mutation AddProposalMemberAsAdmin($studentInput: AdminProposalMemberInput!) {
    addProposalMemberAsAdmin(studentInput: $studentInput) {
      proposalId
      studentId
    }
  }
`;
const DELETE_PROPOSAL_MEMBER_AS_ADMIN = gql`
  mutation DeleteProposalMemberAsAdmin(
    $studentInput: AdminProposalMemberInput!
  ) {
    deleteProposalMemberAsAdmin(studentInput: $studentInput) {
      proposalId
      studentId
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


const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const buttonClass =
  "inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50";

const PHASE_TYPES = [
  {
    value: "proposal",
    label: "Proposal",
    hint: "Students submit their research proposals between the opening time and the deadline.",
  },
  {
    value: "progress_report",
    label: "Progress report",
    hint: "Add one progress report phase per review round. Each round has its own deadline.",
  },
  {
    value: "defense",
    label: "Final defense",
    hint: "One shared defense day. Individual time slots are scheduled per paper below.",
  },
] as const;
const DEGREE_LEVELS = [
  { value: "bachelors", label: "Bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
] as const;
const phaseTypeLabel = (phaseType: string) =>
  PHASE_TYPES.find((item) => item.value === phaseType)?.label ?? phaseType;
const degreeLevelLabel = (level: string) =>
  DEGREE_LEVELS.find((item) => item.value === level)?.label ?? level;
const emptyPhaseForm = {
  phaseType: "proposal",
  degreeLevel: "bachelors",
  label: "",
  opensAt: "",
  deadlineAt: "",
  defenseDate: "",
  gracePeriodEnabled: false,
};

const padTwo = (value: number) => String(value).padStart(2, "0");
// <input type="datetime-local"> wants local wall-clock time, not an ISO string in UTC.
const toDateTimeInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}T${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
};
// Supervision limits, kept in step with backend/app/constraints.py (which enforces them).
// One active project per degree level, per professor — a Bachelor's group is one project
// however many students it has. Mirrors backend/app/constraints.py.
const SUPERVISION_LIMITS = { projectsPerLevel: 1, totalStudents: 12 };
const ACTIVE_SUPERVISION_STATUSES = new Set([
  "assigned",
  "approved",
  "accepted",
  "changes_requested",
  "in_progress",
]);
// Stands in for "belongs to no research phase" in the round selector, where null
// already means "every round".
const NO_PHASE = "none";
const DEFENSE_KINDS: { value: DefenseKind; label: string }[] = [
  { value: "proposal", label: "Proposal defenses" },
  { value: "progress_report", label: "Progress report defenses" },
  { value: "defense", label: "Final defenses" },
];
const defenseReportLabel = (kind: string) =>
  kind === "proposal"
    ? "Proposal"
    : kind === "progress_report"
      ? "Progress report"
      : "Final report";
const defenseKindLabel = (kind: string) =>
  kind === "proposal"
    ? "Proposal defense"
    : kind === "progress_report"
      ? "Progress defense"
      : "Final defense";
const describeDefenseSlot = (defense: {
  defenseDate: string;
  scheduledTime: string | null;
  location: string | null;
}) =>
  `${new Date(defense.defenseDate).toLocaleDateString(undefined, { dateStyle: "medium" })}${defense.scheduledTime ? ` at ${defense.scheduledTime.slice(0, 5)}` : ""}${defense.location ? ` · ${defense.location}` : ""}`;
const formatPhaseDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

function phaseStatus(phase: ResearchPhase): {
  label: string;
  className: string;
} {
  // The admin's own status comes first: a phase runs because they opened it, not
  // because its dates say so. The dates only refine what an open phase is doing.
  if (phase.status === "pending")
    return { label: "Not started", className: "bg-slate-100 text-slate-600" };
  if (phase.status === "closed")
    return { label: "Closed", className: "bg-slate-200 text-slate-700" };
  const now = Date.now();
  if (phase.phaseType === "defense") {
    if (!phase.defenseDate)
      return { label: "No date", className: "bg-slate-100 text-slate-600" };
    const endOfDefenseDay = new Date(phase.defenseDate);
    endOfDefenseDay.setHours(23, 59, 59, 999);
    return endOfDefenseDay.getTime() < now
      ? { label: "Open · day held", className: "bg-amber-50 text-amber-700" }
      : { label: "Open · scheduled", className: "bg-emerald-50 text-emerald-700" };
  }
  if (phase.opensAt && new Date(phase.opensAt).getTime() > now)
    return { label: "Open · not yet due", className: "bg-blue-50 text-blue-700" };
  if (phase.deadlineAt && new Date(phase.deadlineAt).getTime() < now) {
    return phase.gracePeriodEnabled
      ? {
          label: "Past deadline · late allowed",
          className: "bg-amber-50 text-amber-700",
        }
      : { label: "Past deadline · no submissions", className: "bg-amber-50 text-amber-700" };
  }
  return { label: "Open", className: "bg-emerald-50 text-emerald-700" };
}

function AdminManagement({
  role,
  view,
  level,
  onNavigate,
  onBadgesChange,
  refreshKey = 0,
  departmentLabel = null,
}: AdminManagementProps) {
  const toast = useToast();
  const lifecycleLevel = level;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [degrees, setDegrees] = useState<DegreeProgram[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  // Only a failed load stays on screen; results of actions are toasts.
  const [loadError, setLoadError] = useState<string | null>(null);
  // Counts read 0 until the first load lands; don't show them as "nothing to do" yet.
  const [isLoaded, setIsLoaded] = useState(false);
  const [areCandidatesLoaded, setAreCandidatesLoaded] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  // The timeline runs proposal -> progress rounds -> final defense; the server says
  // which of those each level may add next, so the form offers nothing it would refuse.
  const [phaseOptions, setPhaseOptions] = useState<Record<string, PhaseOption[]>>({});
  // Every level and kind at once, for the overview and the sidebar counts.
  const [allCandidates, setAllCandidates] = useState<DefenseCandidate[]>([]);
  // Per-form errors so a failed submit shows inside the open modal, not on the page behind it.
  const [departmentFormError, setDepartmentFormError] = useState<string | null>(
    null,
  );
  const [degreeFormError, setDegreeFormError] = useState<string | null>(null);
  const [clusterFormError, setClusterFormError] = useState<string | null>(null);
  const [proposalFormError, setProposalFormError] = useState<string | null>(
    null,
  );
  const [editing, setEditing] = useState<{
    type: "department" | "degree" | "cluster";
    id: string;
  } | null>(null);
  const [departmentForm, setDepartmentForm] = useState({ name: "", code: "" });
  const [degreeForm, setDegreeForm] = useState({
    name: "",
    level: "bachelors",
    departmentId: "",
  });
  const [clusterForm, setClusterForm] = useState({
    name: "",
    departmentId: "",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    proposalId: "",
    supervisorId: "",
    clusterId: "",
  });
  const [isDepartmentFormOpen, setIsDepartmentFormOpen] = useState(false);
  const [isDegreeFormOpen, setIsDegreeFormOpen] = useState(false);
  const [isClusterFormOpen, setIsClusterFormOpen] = useState(false);
  const [isProposalFormOpen, setIsProposalFormOpen] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(
    null,
  );
  const [groupStudentId, setGroupStudentId] = useState("");
  const [scheduledDefenses, setScheduledDefenses] = useState<
    ScheduledDefense[]
  >([]);
  const [researchPhases, setResearchPhases] = useState<ResearchPhase[]>([]);
  const [defenseError, setDefenseError] = useState<string | null>(null);
  const [defenseKind, setDefenseKind] = useState<DefenseKind>("proposal");
  // Which research phase of that kind is shown — progress reports run in rounds
  // (Progress report 1, 2, ...), so their defenses are divided the same way.
  // null means every round; NO_PHASE means the ones from before the timeline.
  const [defensePhaseId, setDefensePhaseId] = useState<string | null>(null);
  const [defenseCandidates, setDefenseCandidates] = useState<
    DefenseCandidate[]
  >([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [planTarget, setPlanTarget] = useState<PlanTarget | null>(null);
  const [planForm, setPlanForm] = useState<{
    date: string;
    time: string;
    location: string;
    panelIds: string[];
  }>({ date: "", time: "", location: "", panelIds: [] });
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [phaseForm, setPhaseForm] = useState(emptyPhaseForm);
  const [isPhaseFormOpen, setIsPhaseFormOpen] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [phaseFormError, setPhaseFormError] = useState<string | null>(null);
  const [isSavingPhase, setIsSavingPhase] = useState(false);
  // Once the admin types their own title, stop replacing it with a suggestion.
  const [isPhaseLabelCustom, setIsPhaseLabelCustom] = useState(false);
  // Deleted proposals are left out of the admin's list; this asks for them back.
  // They were never really removed — the row and its PDF are still on file.
  const [showDeletedProposals, setShowDeletedProposals] = useState(false);
  const [phaseActionId, setPhaseActionId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [
        departmentData,
        degreeData,
        clusterData,
        userData,
        proposalData,
        profileData,
        defenseData,
        phaseData,
      ] = await Promise.all([
        request<{ departments: Department[] }>(DEPARTMENTS),
        request<{ degreePrograms: DegreeProgram[] }>(DEGREES),
        request<{ clusters: Cluster[] }>(CLUSTERS),
        request<{ users: User[] }>(USERS),
        request<{ proposals: Proposal[] }>(PROPOSALS, { includeDeleted: showDeletedProposals }),
        request<{ profiles: Profile[] }>(PROFILES_QUERY),
        request<{ departmentDefenses: ScheduledDefense[] }>(
          DEPARTMENT_DEFENSES,
        ),
        request<{ researchPhases: ResearchPhase[] }>(RESEARCH_PHASES_QUERY),
      ]);
      setDepartments(departmentData.departments);
      setDegrees(degreeData.degreePrograms);
      setClusters(clusterData.clusters);
      setUsers(userData.users);
      setProposals(proposalData.proposals);
      setProfiles(profileData.profiles);
      setScheduledDefenses(defenseData.departmentDefenses);
      setResearchPhases(phaseData.researchPhases);
      setLoadError(null);
    } catch (requestError) {
      setLoadError(errorMessage(requestError, "Unable to load management data."));
    }
    // The batch is only shown for context, so a failure here doesn't block the page.
    try {
      const batchData = await request<{ currentBatch: Batch | null }>(
        CURRENT_BATCH_QUERY,
      );
      setCurrentBatch(batchData.currentBatch);
    } catch {
      setCurrentBatch(null);
    }
    if (role === "admin") {
      try {
        const results = await Promise.all(
          DEGREE_LEVELS.map((item) =>
            request<{ researchPhaseOptions: PhaseOption[] }>(
              RESEARCH_PHASE_OPTIONS_QUERY,
              { degreeLevel: item.value },
            ).then((result) => [item.value, result.researchPhaseOptions] as const),
          ),
        );
        setPhaseOptions(Object.fromEntries(results));
      } catch {
        // Without them the form still works; the server refuses a phase out of order.
        setPhaseOptions({});
      }
    }
    // Only now is every list the page shows in place.
    setIsLoaded(true);
  };

  // Every report that could be defended, across all levels and kinds.
  const loadAllCandidates = async () => {
    if (role !== "admin") return;
    try {
      const results = await Promise.all(
        DEGREE_LEVELS.flatMap((item) =>
          DEFENSE_KINDS.map((kind) =>
            request<{ defenseCandidates: DefenseCandidate[] }>(
              DEFENSE_CANDIDATES_QUERY,
              { degreeLevel: item.value, kind: kind.value },
            ).then((result) =>
              result.defenseCandidates.map((candidate) => ({
                ...candidate,
                degreeLevel: item.value,
              })),
            ),
          ),
        ),
      );
      setAllCandidates(results.flat());
    } catch {
      // The per-level list on the Defenses page reports its own errors.
    } finally {
      setAreCandidatesLoaded(true);
    }
  };

  useEffect(() => {
    const initializeManagementData = async () => {
      await loadData();
    };

    void initializeManagementData();
    // Reloads when the admin asks to see deleted proposals, since that changes the query,
    // and when people were changed on another page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeletedProposals, refreshKey]);
  const departmentName = (id: string) =>
    departments.find((item) => item.id === id)?.name ?? "Unknown department";
  // Keep cluster rows grouped by department and predictable within each group.
  const sortedClusters = [...clusters].sort((firstCluster, secondCluster) => {
    const departmentOrder = departmentName(
      firstCluster.departmentId,
    ).localeCompare(departmentName(secondCluster.departmentId), undefined, {
      sensitivity: "base",
    });
    return (
      departmentOrder || firstCluster.name.localeCompare(secondCluster.name)
    );
  });
  const professors = users.filter(
    (user) => user.role.toLowerCase().replace(/^.*\./, "") === "professor",
  );
  const students = users.filter(
    (user) => user.role.toLowerCase().replace(/^.*\./, "") === "student",
  );
  // A professor's total supervised students across all their assigned proposals, optionally
  // ignoring one proposal's own load (so editing that proposal's assignment doesn't count it twice).
  // Students on a proposal: the owner plus accepted group members.
  const proposalSize = (proposal: Proposal) =>
    1 +
    proposal.groupMembers.filter((member) => member.status === "accepted")
      .length;
  // A professor's active supervision load, optionally ignoring the proposal being (re)assigned.
  const activeSupervised = (professorId: string, excludeProposalId?: string) =>
    proposals.filter(
      (proposal) =>
        proposal.supervisorId === professorId &&
        proposal.id !== excludeProposalId &&
        ACTIVE_SUPERVISION_STATUSES.has(proposal.status) &&
        !proposal.deletedAt,
    );
  const professorLoad = (professorId: string, excludeProposalId?: string) =>
    activeSupervised(professorId, excludeProposalId).reduce(
      (total, proposal) => total + proposalSize(proposal),
      0,
    );
  const professorCapacity = (professorId: string) =>
    profiles.find((profile) => profile.userId === professorId)?.maxStudents ??
    null;
  // Why a professor can't take this proposal, or null. Same limits as backend/app/constraints.py.
  const supervisionBlock = (
    professorId: string,
    proposal: Proposal | null,
  ): string | null => {
    if (!proposal) return null;
    const active = activeSupervised(professorId, proposal.id);
    const size = proposalSize(proposal);
    // A proposal with no degree level on file can't be placed at a level, so only the
    // overall caps below apply to it — same as the backend's own check.
    const level = proposal.degreeLevel;
    if (level) {
      const atLevel = active.filter((item) => item.degreeLevel === level);
      if (atLevel.length >= SUPERVISION_LIMITS.projectsPerLevel)
        return `already supervising a ${degreeLevelLabel(level)} ${level === "bachelors" ? "group" : "project"}`;
    }
    const load = professorLoad(professorId, proposal.id);
    if (load + size > SUPERVISION_LIMITS.totalStudents)
      return `already supervising ${SUPERVISION_LIMITS.totalStudents} students`;
    const capacity = professorCapacity(professorId);
    if (capacity !== null && load + size > capacity)
      return `at their limit of ${capacity} students`;
    return null;
  };
  // Assignment cue for the proposal table: green once a supervisor is on the proposal, red while
  // it still needs one. Deleted proposals stay neutral — nobody is waiting on an assignment for them.
  const assignmentTone = (proposal: Proposal) => {
    if (proposal.deletedAt) return { row: "", cell: "text-slate-500" };
    return proposal.supervisorId
      ? { row: "bg-emerald-50", cell: "text-emerald-700" }
      : { row: "bg-red-50", cell: "text-red-700" };
  };
  const selectedProposal =
    proposals.find((proposal) => proposal.id === assignmentForm.proposalId) ??
    null;
  const levelPhases = researchPhases
    .filter((phase) => phase.degreeLevel === lifecycleLevel)
    .sort((first, second) => first.sequenceNumber - second.sequenceNumber);
  const levelProposals = proposals.filter(
    (proposal) => proposal.degreeLevel === lifecycleLevel,
  );
  const levelDefenses = scheduledDefenses.filter(
    (defense) => defense.degreeLevel === lifecycleLevel,
  );
  const allKindDefenses = levelDefenses.filter(
    (defense) => defense.kind === defenseKind,
  );
  // The rounds this kind runs in: one research phase per round is what makes
  // "Progress report 1" and "Progress report 2" separate defenses. Numbered from
  // the phase's own sequence number, because two phases may share a label.
  const kindPhases = levelPhases.filter(
    (phase) => phase.phaseType === defenseKind,
  );
  const phaseChoices: { id: string; tab: string; full: string }[] =
    kindPhases.map((phase) => ({
      id: phase.id,
      tab: `Phase ${phase.sequenceNumber}`,
      full: `Phase ${phase.sequenceNumber} · ${phase.label}`,
    }));
  // A phase can be soft-deleted after its reports were submitted, and it then drops
  // out of researchPhases. Without this its reports would sit in no round at all.
  for (const item of [...allKindDefenses, ...defenseCandidates]) {
    if (
      item.phaseId &&
      !phaseChoices.some((choice) => choice.id === item.phaseId)
    ) {
      const label = item.phaseLabel ?? "Removed phase";
      phaseChoices.push({
        id: item.phaseId,
        tab: label,
        full: `${label} (removed from the timeline)`,
      });
    }
  }
  // Items from before the research timeline carry no phase, so they need a round of their own.
  if (
    allKindDefenses.some((defense) => !defense.phaseId) ||
    defenseCandidates.some((candidate) => !candidate.phaseId)
  ) {
    phaseChoices.push({ id: NO_PHASE, tab: "No phase", full: "No phase" });
  }
  // A phase picked at another degree level isn't one of this level's choices; ignore it.
  const activePhaseId = phaseChoices.some((choice) => choice.id === defensePhaseId)
    ? defensePhaseId
    : null;
  const inSelectedPhase = (item: { phaseId: string | null }) =>
    activePhaseId === null ||
    (activePhaseId === NO_PHASE
      ? !item.phaseId
      : item.phaseId === activePhaseId);
  const kindDefenses = allKindDefenses.filter(inSelectedPhase);
  const visibleCandidates = defenseCandidates.filter(inSelectedPhase);
  const selectedPhaseLabel =
    phaseChoices.find((choice) => choice.id === activePhaseId)?.full ?? null;
  // Only professors with a professor profile can sit on a panel.
  const panelChoices = profiles
    .filter((profile) => profile.role.toLowerCase() === "professor")
    .sort((first, second) => first.userName.localeCompare(second.userName));
  const selectedProposalLevel = selectedProposal?.degreeLevel ?? null;
  // The chosen professor is never greyed out in the list (it has to stay selectable), so
  // spell out the rule they break here instead — the same sentence the backend refuses with.
  const selectedSupervisorBlock = (() => {
    const supervisor = professors.find(
      (item) => item.id === assignmentForm.supervisorId,
    );
    if (!supervisor || !selectedProposal) return null;
    const reason = supervisionBlock(supervisor.id, selectedProposal);
    return reason
      ? `${supervisor.name} is ${reason} — this assignment will be refused.`
      : null;
  })();
  // Students already owning or belonging to a different active proposal's group can't be picked
  // again; a rejected or deleted proposal frees its students.
  const committedElsewhereIds = new Set(
    proposals
      .filter(
        (proposal) =>
          proposal.id !== selectedProposal?.id &&
          proposal.status !== "rejected" &&
          proposal.status !== "withdrawn" &&
          !proposal.deletedAt,
      )
      .flatMap((proposal) => [
        proposal.submittedBy,
        ...proposal.groupMembers.map((member) => member.id),
      ])
      .filter((id): id is string => Boolean(id)),
  );
  const editable = (type: "department" | "degree" | "cluster", id: string) =>
    setEditing({ type, id });

  const saveDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    setDepartmentFormError(null);
    try {
      if (editing?.type === "department")
        await request(UPDATE_DEPARTMENT, {
          adminInput: { id: editing.id, ...departmentForm },
        });
      else await request(CREATE_DEPARTMENT, { adminInput: departmentForm });
      setDepartmentForm({ name: "", code: "" });
      setEditing(null);
      setIsDepartmentFormOpen(false);
      toast.success("Department saved.");
      await loadData();
    } catch (e) {
      setDepartmentFormError(
        e instanceof Error ? e.message : "Unable to save department.",
      );
    }
  };
  const closeDepartmentForm = () => {
    setIsDepartmentFormOpen(false);
    setEditing(null);
    setDepartmentForm({ name: "", code: "" });
    setDepartmentFormError(null);
  };
  const saveDegree = async (event: React.FormEvent) => {
    event.preventDefault();
    setDegreeFormError(null);
    try {
      if (editing?.type === "degree")
        await request(UPDATE_DEGREE, {
          adminInput: { id: editing.id, ...degreeForm },
        });
      else await request(CREATE_DEGREE, { adminInput: degreeForm });
      setDegreeForm({ name: "", level: "bachelors", departmentId: "" });
      setEditing(null);
      setIsDegreeFormOpen(false);
      toast.success("Degree program saved.");
      await loadData();
    } catch (e) {
      setDegreeFormError(
        e instanceof Error ? e.message : "Unable to save degree program.",
      );
    }
  };
  const saveCluster = async (event: React.FormEvent) => {
    event.preventDefault();
    setClusterFormError(null);
    try {
      if (editing?.type === "cluster")
        await request(UPDATE_CLUSTER, {
          adminInput: { id: editing.id, ...clusterForm },
        });
      else await request(CREATE_CLUSTER, { adminInput: clusterForm });
      setClusterForm({ name: "", departmentId: "" });
      setEditing(null);
      setIsClusterFormOpen(false);
      toast.success("Cluster saved.");
      await loadData();
    } catch (e) {
      setClusterFormError(
        e instanceof Error ? e.message : "Unable to save cluster.",
      );
    }
  };
  const deleteItem = async (
    mutation: ReturnType<typeof gql>,
    id: string,
    label: string,
  ) => {
    try {
      await request(mutation, { adminInput: { id } });
      toast.success(`${label} deleted.`);
      await loadData();
    } catch (e) {
      toast.error(errorMessage(e, `Unable to delete ${label.toLowerCase()}.`));
    }
  };

  const loadDefenseCandidates = async (level: string, kind: DefenseKind) => {
    setIsLoadingCandidates(true);
    setDefenseError(null);
    try {
      const result = await request<{ defenseCandidates: DefenseCandidate[] }>(
        DEFENSE_CANDIDATES_QUERY,
        { degreeLevel: level, kind },
      );
      setDefenseCandidates(result.defenseCandidates);
    } catch (requestError) {
      setDefenseError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load what can be defended.",
      );
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const showDefenses = (
    level: string,
    kind: DefenseKind,
    phaseId: string | null = null,
  ) => {
    setDefenseKind(kind);
    setDefensePhaseId(phaseId);
    setDefenseCandidates([]);
    void loadDefenseCandidates(level, kind);
  };

  const openPlanForm = (target: PlanTarget) => {
    const existing = target.existing;
    const day = existing?.defenseDate ?? target.suggestedDate;
    setPlanForm({
      date: day ? toDateTimeInput(day).slice(0, 10) : "",
      time: existing?.scheduledTime?.slice(0, 5) ?? "",
      location: existing?.location ?? "",
      panelIds: existing?.panelProfessorIds ?? [],
    });
    setDefenseError(null);
    setPlanTarget(target);
  };

  const togglePanelMember = (professorId: string) =>
    setPlanForm((current) => ({
      ...current,
      panelIds: current.panelIds.includes(professorId)
        ? current.panelIds.filter((id) => id !== professorId)
        : [...current.panelIds, professorId],
    }));

  const savePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!planTarget) return;
    const targetKey =
      planTarget.kind === "proposal"
        ? "proposalId"
        : planTarget.kind === "progress_report"
          ? "progressReportId"
          : "paperId";
    setIsSavingPlan(true);
    setDefenseError(null);
    try {
      await request(SCHEDULE_RESEARCH_DEFENSE, {
        adminInput: {
          [targetKey]: planTarget.targetId,
          phaseId: planTarget.phaseId,
          // Local midnight, so the day doesn't shift in timezones behind UTC.
          defenseDate: new Date(`${planForm.date}T00:00`).toISOString(),
          scheduledTime: planForm.time,
          location: planForm.location.trim() || null,
          panelProfessorIds: planForm.panelIds,
        },
      });
      toast.success(
        `Defense ${planTarget.existing ? "rescheduled" : "planned"} for "${planTarget.title}". The students, supervisor and panel were notified.`,
      );
      setPlanTarget(null);
      await loadData();
      await loadDefenseCandidates(lifecycleLevel, defenseKind);
      await loadAllCandidates();
    } catch (requestError) {
      setDefenseError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to plan the defense.",
      );
    } finally {
      setIsSavingPlan(false);
    }
  };

  const setPhaseOpen = async (phase: ResearchPhase, open: boolean) => {
    if (
      !open &&
      !window.confirm(
        `Close "${phase.label}"? Students can no longer submit into it, everything already submitted stays reviewable, and the next phase for this degree level can then be started.`,
      )
    )
      return;
    setPhaseActionId(phase.id);
    try {
      const result = await request<{
        openResearchPhase?: { notifiedCount: number | null };
      }>(open ? OPEN_RESEARCH_PHASE : CLOSE_RESEARCH_PHASE, {
        adminInput: { id: phase.id },
      });
      const notified = result.openResearchPhase?.notifiedCount ?? null;
      toast.success(
        open
          ? `"${phase.label}" is open${notified ? ` — ${notified} ${notified === 1 ? "person was" : "people were"} notified` : ""}.`
          : `"${phase.label}" is closed. The next phase for this degree level can now be started.`,
      );
      await loadData();
    } catch (requestError) {
      toast.error(
        errorMessage(requestError, `Unable to ${open ? "open" : "close"} the phase.`),
      );
    } finally {
      setPhaseActionId(null);
    }
  };

  const deletePhase = async (phase: ResearchPhase) => {
    if (
      !window.confirm(
        `Delete "${phase.label}" from the timeline? Its submissions, history and defenses stay on record, but the phase no longer appears in any dashboard.`,
      )
    )
      return;
    try {
      await request(DELETE_RESEARCH_PHASE, { adminInput: { id: phase.id } });
      toast.success(`"${phase.label}" was removed from the timeline.`);
      await loadData();
    } catch (requestError) {
      toast.error(errorMessage(requestError, "Unable to delete the research phase."));
    }
  };

  // A title like "Progress report 3" for the next phase of this type.
  const suggestPhase = (phaseType: string, degreeLevel: string) => {
    const levelPhases = researchPhases.filter(
      (phase) => phase.degreeLevel === degreeLevel,
    );
    const round =
      levelPhases.filter((phase) => phase.phaseType === phaseType).length + 1;
    const baseLabel =
      phaseType === "proposal"
        ? "Proposal submission"
        : phaseTypeLabel(phaseType);
    const label =
      phaseType === "progress_report" || round > 1
        ? `${baseLabel} ${round}`
        : baseLabel;
    return { label };
  };
  const optionsFor = (degreeLevel: string) => phaseOptions[degreeLevel] ?? [];
  const optionFor = (degreeLevel: string, phaseType: string) =>
    optionsFor(degreeLevel).find((option) => option.phaseType === phaseType) ?? null;
  // The first kind the level may add, in timeline order; proposal if the server hasn't said.
  const firstAllowedType = (degreeLevel: string) =>
    optionsFor(degreeLevel).find((option) => option.allowed)?.phaseType ?? "proposal";

  const openNewPhaseForm = (degreeLevel = "bachelors") => {
    const phaseType = firstAllowedType(degreeLevel);
    setEditingPhaseId(null);
    setIsPhaseLabelCustom(false);
    setPhaseFormError(null);
    setPhaseForm({
      ...emptyPhaseForm,
      phaseType,
      degreeLevel,
      ...suggestPhase(phaseType, degreeLevel),
    });
    setIsPhaseFormOpen(true);
  };

  const openEditPhaseForm = (phase: ResearchPhase) => {
    setEditingPhaseId(phase.id);
    setIsPhaseLabelCustom(true);
    setPhaseFormError(null);
    setPhaseForm({
      phaseType: phase.phaseType,
      degreeLevel: phase.degreeLevel,
      label: phase.label,
      opensAt: toDateTimeInput(phase.opensAt),
      deadlineAt: toDateTimeInput(phase.deadlineAt),
      defenseDate: toDateTimeInput(phase.defenseDate).slice(0, 10),
      gracePeriodEnabled: phase.gracePeriodEnabled,
    });
    setIsPhaseFormOpen(true);
  };

  const closePhaseForm = () => {
    setIsPhaseFormOpen(false);
    setEditingPhaseId(null);
    setPhaseFormError(null);
  };

  // Stage and degree level can only change while creating; the suggestions follow them.
  const changePhaseKind = (changes: {
    phaseType?: string;
    degreeLevel?: string;
  }) => {
    const next = { ...phaseForm, ...changes };
    // Moving to another level keeps the stage only if that level may add it next.
    if (changes.degreeLevel && !optionFor(next.degreeLevel, next.phaseType)?.allowed) {
      next.phaseType = firstAllowedType(next.degreeLevel);
    }
    const suggestion = suggestPhase(next.phaseType, next.degreeLevel);
    setPhaseForm({
      ...next,
      label: isPhaseLabelCustom ? next.label : suggestion.label,
    });
  };

  const savePhase = async (event: React.FormEvent) => {
    event.preventDefault();
    setPhaseFormError(null);
    const isDefense = phaseForm.phaseType === "defense";
    if (
      !isDefense &&
      new Date(phaseForm.opensAt).getTime() >=
        new Date(phaseForm.deadlineAt).getTime()
    ) {
      setPhaseFormError("The deadline must be later than the opening time.");
      return;
    }
    const schedule = {
      label: phaseForm.label.trim(),
      opensAt: isDefense ? null : new Date(phaseForm.opensAt).toISOString(),
      deadlineAt: isDefense
        ? null
        : new Date(phaseForm.deadlineAt).toISOString(),
      // Local midnight, so the defense day doesn't shift a day in timezones behind UTC.
      defenseDate: isDefense
        ? new Date(`${phaseForm.defenseDate}T00:00`).toISOString()
        : null,
      gracePeriodEnabled: isDefense ? false : phaseForm.gracePeriodEnabled,
    };
    setIsSavingPhase(true);
    try {
      let notifiedCount: number | null;
      if (editingPhaseId) {
        const result = await request<{
          updateResearchPhase: { notifiedCount: number | null };
        }>(UPDATE_RESEARCH_PHASE, {
          adminInput: { id: editingPhaseId, ...schedule },
        });
        notifiedCount = result.updateResearchPhase.notifiedCount;
      } else {
        const result = await request<{
          createResearchPhase: { notifiedCount: number | null };
        }>(CREATE_RESEARCH_PHASE, {
          adminInput: {
            phaseType: phaseForm.phaseType,
            degreeLevel: phaseForm.degreeLevel,
            ...schedule,
          },
        });
        notifiedCount = result.createResearchPhase.notifiedCount;
      }
      // A new phase is only drafted, so nobody hears about it until it is opened.
      const audience = notifiedCount
        ? `${notifiedCount} ${notifiedCount === 1 ? "person was" : "people were"} notified.`
        : editingPhaseId
          ? "Nobody was notified — a phase only announces itself once it is open."
          : "Open it when the previous phase for this degree level has closed.";
      toast.success(
        `${editingPhaseId ? "Research phase updated" : "Research phase added to the timeline"}. ${audience}`,
      );
      closePhaseForm();
      await loadData();
    } catch (requestError) {
      setPhaseFormError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save the research phase.",
      );
    } finally {
      setIsSavingPhase(false);
    }
  };

  const assignProposal = async (event: React.FormEvent) => {
    event.preventDefault();
    setProposalFormError(null);
    try {
      await request(ASSIGN_PROPOSAL, {
        adminInput: {
          proposalId: assignmentForm.proposalId,
          supervisorId: assignmentForm.supervisorId,
          clusterId: assignmentForm.clusterId || null,
          status: "assigned",
        },
      });
      toast.success("Proposal assigned.");
      setAssignmentForm({ proposalId: "", supervisorId: "", clusterId: "" });
      setEditingProposalId(null);
      setIsProposalFormOpen(false);
      await loadData();
    } catch (e) {
      setProposalFormError(
        e instanceof Error ? e.message : "Unable to assign proposal.",
      );
    }
  };

  const adjustProposalMember = async (
    proposal: Proposal,
    studentId: string,
    add: boolean,
  ) => {
    setProposalFormError(null);
    try {
      await request(
        add ? ADD_PROPOSAL_MEMBER_AS_ADMIN : DELETE_PROPOSAL_MEMBER_AS_ADMIN,
        {
          studentInput: { proposalId: proposal.id, studentId },
        },
      );
      setGroupStudentId("");
      await loadData();
    } catch (requestError) {
      setProposalFormError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update proposal group.",
      );
    }
  };

  useEffect(() => {
    const initializeCandidates = async () => {
      await loadAllCandidates();
    };
    void initializeCandidates();
    // Loaded once; savePlan refreshes it after every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Defenses page lists one level and kind at a time; reload it when the
  // admin opens the page or picks another level in the header.
  useEffect(() => {
    if (view !== "defenses") return;
    const reloadCandidates = async () => {
      await loadDefenseCandidates(level, defenseKind);
    };
    void reloadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, level]);

  // What is waiting on the admin, for the overview cards, sidebar and level picker.
  const waitingProposals = proposals.filter(
    (proposal) =>
      !proposal.supervisorId &&
      !proposal.deletedAt &&
      proposal.status === "submitted",
  );
  const unplanned = allCandidates.filter((candidate) => !candidate.defense);
  const awaitingVerdict = scheduledDefenses.filter(
    (defense) => defense.hasEnded && defense.currentStatus === "pending",
  );
  const openPhases = researchPhases.filter((phase) => phase.status === "open");
  const upcomingDefenses = scheduledDefenses
    .filter((defense) => !defense.hasEnded && defense.currentStatus === "pending")
    .sort(
      (first, second) =>
        new Date(first.defenseDate).getTime() -
        new Date(second.defenseDate).getTime(),
    );
  const professorsWithoutProfile = professors.filter(
    (professor) =>
      !profiles.some(
        (profile) =>
          profile.userId === professor.id &&
          profile.role.toLowerCase() === "professor",
      ),
  );
  const proposalsAt = (value: string) =>
    waitingProposals.filter((proposal) => proposal.degreeLevel === value).length;
  const unplannedAt = (value: string) =>
    unplanned.filter((candidate) => candidate.degreeLevel === value).length;
  // Primitive values, so the effect below only runs when a count really changes.
  const proposalsBachelors = proposalsAt("bachelors");
  const proposalsMasters = proposalsAt("masters");
  const proposalsPhd = proposalsAt("phd");
  const defensesBachelors = unplannedAt("bachelors");
  const defensesMasters = unplannedAt("masters");
  const defensesPhd = unplannedAt("phd");
  useEffect(() => {
    onBadgesChange?.({
      proposals: proposalsBachelors + proposalsMasters + proposalsPhd,
      defenses: defensesBachelors + defensesMasters + defensesPhd,
      proposalsByLevel: {
        bachelors: proposalsBachelors,
        masters: proposalsMasters,
        phd: proposalsPhd,
      },
      defensesByLevel: {
        bachelors: defensesBachelors,
        masters: defensesMasters,
        phd: defensesPhd,
      },
    });
  }, [
    onBadgesChange,
    proposalsBachelors,
    proposalsMasters,
    proposalsPhd,
    defensesBachelors,
    defensesMasters,
    defensesPhd,
  ]);

  const unplannedOfKind = (kind: DefenseKind) =>
    unplanned.filter(
      (candidate) =>
        candidate.degreeLevel === lifecycleLevel && candidate.kind === kind,
    ).length;
  const sortedLevelProposals = [...levelProposals].sort(
    (first, second) =>
      Number(waitingProposals.includes(second)) -
        Number(waitingProposals.includes(first)) ||
      Number(Boolean(first.deletedAt)) - Number(Boolean(second.deletedAt)),
  );
  const openAssignment = (proposal: Proposal | null) => {
    setEditingProposalId(proposal?.id ?? null);
    setAssignmentForm({
      proposalId: proposal?.id ?? "",
      supervisorId: proposal?.supervisorId ?? "",
      clusterId: proposal?.clusterId ?? "",
    });
    setGroupStudentId("");
    setProposalFormError(null);
    setIsProposalFormOpen(true);
  };
  // What the timeline can take next, in words, for the level being viewed.
  const levelOptions = optionsFor(lifecycleLevel);
  const addableTypes = levelOptions.filter((option) => option.allowed);
  const timelineComplete = levelPhases.some((phase) => phase.phaseType === "defense");
  const nextStepText =
    addableTypes.length === 0
      ? null
      : `Next: step ${addableTypes[0].sequenceNumber} can be ${addableTypes
          .map((option) =>
            option.phaseType === "proposal"
              ? "the proposal phase"
              : option.phaseType === "progress_report"
                ? "another progress report round"
                : "the final defense",
          )
          .join(" or ")}.`;
  const iconButton =
    "inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700";
  const deleteButton =
    "inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700";

  return (
    <>
      {loadError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {loadError}
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      )}

      {/* Until the first load lands every list is empty, which would read as
          "nothing here" — so say it is loading instead. */}
      {view === "overview" && !(isLoaded && areCandidatesLoaded) && (
        <p className="text-sm text-slate-500">Loading your department...</p>
      )}
      {view !== "overview" && !isLoaded && (
        <p className="text-sm text-slate-500">Loading...</p>
      )}
      {view === "overview" && isLoaded && areCandidatesLoaded && (
        <div className="space-y-6">
          <SectionHeader
            title="What needs your attention"
            description={[
              departmentLabel,
              currentBatch ? `Current batch: ${currentBatch.label}` : null,
              "Click a card to go straight to it.",
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={UserCheck}
              label="Proposals need a supervisor"
              value={waitingProposals.length}
              hint="Submitted and not yet assigned"
              highlight={waitingProposals.length > 0}
              onClick={() => onNavigate("proposals")}
            />
            <StatCard
              icon={CalendarClock}
              label="Not yet scheduled for a defense"
              value={unplanned.length}
              hint="Proposals and reports with no defense planned"
              highlight={unplanned.length > 0}
              onClick={() => onNavigate("defenses")}
            />
            <StatCard
              icon={Gavel}
              label="Waiting for panel verdicts"
              value={awaitingVerdict.length}
              hint="The panels decide these themselves"
              onClick={() => onNavigate("defenses")}
            />
            <StatCard
              icon={Layers}
              label="Open phases"
              value={openPhases.length}
              hint="Across all degree levels"
              onClick={() => onNavigate("timeline")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {DEGREE_LEVELS.map((item) => {
              const phases = researchPhases
                .filter((phase) => phase.degreeLevel === item.value)
                .sort((first, second) => first.sequenceNumber - second.sequenceNumber);
              const open = phases.find((phase) => phase.status === "open");
              const next = phases.find((phase) => phase.status === "pending");
              const proposalsHere = waitingProposals.filter(
                (proposal) => proposal.degreeLevel === item.value,
              ).length;
              const unplannedHere = unplanned.filter(
                (candidate) => candidate.degreeLevel === item.value,
              ).length;
              return (
                <Card key={item.value}>
                  <h3 className="font-semibold text-slate-900">{item.label}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {open ? (
                      <>
                        <span className="font-medium text-emerald-700">Open:</span>{" "}
                        {open.label}
                        {open.deadlineAt
                          ? ` · deadline ${formatPhaseDateTime(open.deadlineAt)}`
                          : open.defenseDate
                            ? ` · defense day ${formatDefenseDate(open.defenseDate)}`
                            : ""}
                      </>
                    ) : next ? (
                      <>No phase open. Next up: {next.label}</>
                    ) : phases.length === 0 ? (
                      "No timeline yet"
                    ) : (
                      "Every phase is closed"
                    )}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm">
                    <li className="flex justify-between gap-2">
                      <span className="text-slate-600">Need a supervisor</span>
                      <span className={proposalsHere ? "font-semibold text-amber-700" : "text-slate-400"}>
                        {proposalsHere}
                      </span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-slate-600">Not yet scheduled</span>
                      <span className={unplannedHere ? "font-semibold text-amber-700" : "text-slate-400"}>
                        {unplannedHere}
                      </span>
                    </li>
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(
                      [
                        ["timeline", "Timeline"],
                        ["proposals", "Proposals"],
                        ["defenses", "Defenses"],
                      ] as const
                    ).map(([target, label]) => (
                      <button
                        key={target}
                        type="button"
                        onClick={() => onNavigate(target, item.value)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="text-sm font-semibold text-slate-900">Upcoming defenses</h3>
              {upcomingDefenses.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Nothing scheduled.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {upcomingDefenses.slice(0, 6).map((defense) => (
                    <li key={defense.id} className="py-2 text-sm">
                      <p className="font-medium text-slate-800">
                        {defense.paperTitle ?? "Untitled research"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {defenseKindLabel(defense.kind)} ·{" "}
                        {degreeLevelLabel(defense.degreeLevel ?? "")} ·{" "}
                        {describeDefenseSlot(defense)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-slate-900">People</h3>
              <p className="mt-2 text-sm text-slate-600">
                {students.length} student{students.length === 1 ? "" : "s"} ·{" "}
                {professors.length} professor{professors.length === 1 ? "" : "s"}
              </p>
              {professorsWithoutProfile.length > 0 && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {professorsWithoutProfile.length} professor
                  {professorsWithoutProfile.length === 1 ? " has" : "s have"} no
                  profile yet, so they can't sit on a defense panel.
                </p>
              )}
              <button
                type="button"
                onClick={() => onNavigate("people")}
                className="mt-3 text-sm font-medium text-blue-700 hover:underline"
              >
                Manage people
              </button>
            </Card>
          </div>
        </div>
      )}

      {isLoaded && view === "timeline" && (
        <div className="space-y-4">
          <SectionHeader
            title={`${degreeLevelLabel(lifecycleLevel)} research timeline`}
            description="The timeline runs in this order: one proposal phase, then as many progress report rounds as you need (at least one), then the final defense. Draft the phases, then open each one in turn. Opening a phase notifies the students and professors involved. Phases can be deleted once they've ended."
            action={
              <button
                type="button"
                disabled={levelOptions.length > 0 && addableTypes.length === 0}
                onClick={() => openNewPhaseForm(lifecycleLevel)}
                className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Plus size={16} aria-hidden="true" />
                Add research phase
              </button>
            }
          />
          {currentBatch && (
            <p className="text-sm text-slate-500">
              Batch: <span className="font-medium text-slate-700">{currentBatch.label}</span>
              {" · "}started {formatDefenseDate(currentBatch.startedAt)}
            </p>
          )}
          {nextStepText && <p className="text-sm font-medium text-slate-700">{nextStepText}</p>}
          {levelOptions.length > 0 && addableTypes.length === 0 && (
            <BlockedReason>
              {timelineComplete
                ? "This timeline is complete: it ends with the final defense, so nothing more can be added."
                : optionFor(lifecycleLevel, "proposal")?.reason ===
                    "The proposal phase has to be the first step of the timeline"
                  ? "This timeline doesn't start with a proposal phase, and a proposal phase can only be the first step. Close and delete the phases on it once they've ended, then start again with the proposal phase."
                  : levelOptions.map((option) => option.reason).filter(Boolean).join(" ")}
            </BlockedReason>
          )}
          {levelPhases.length === 0 ? (
            <EmptyState
              title={`No ${degreeLevelLabel(lifecycleLevel)} research phases scheduled yet`}
            >
              Start with a proposal phase, then add a progress report phase for
              each review round and a final defense.
            </EmptyState>
          ) : (
            <Card>
              <ol className="space-y-4 border-l-2 border-slate-200 pl-5">
                {levelPhases.map((phase) => {
                  const status = phaseStatus(phase);
                  return (
                    <li key={phase.id} className="relative">
                      <span className="absolute -left-[33px] top-0 flex size-6 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[11px] font-semibold text-white">
                        {phase.sequenceNumber}
                      </span>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{phase.label}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                              {phaseTypeLabel(phase.phaseType)}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 font-medium ${status.className}`}>
                              {status.label}
                            </span>
                          </p>
                          <p className="mt-1.5 text-xs text-slate-500">
                            {phase.phaseType === "defense"
                              ? `Defense day: ${phase.defenseDate ? new Date(phase.defenseDate).toLocaleDateString(undefined, { dateStyle: "medium" }) : "not set"}`
                              : `${phase.opensAt ? formatPhaseDateTime(phase.opensAt) : "?"} → deadline ${phase.deadlineAt ? formatPhaseDateTime(phase.deadlineAt) : "?"}`}
                            {phase.closedAt
                              ? ` · closed ${formatPhaseDateTime(phase.closedAt)}`
                              : ""}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={phaseActionId === phase.id}
                            title={
                              phase.status === "open"
                                ? `Close ${phase.label} so the next phase can start`
                                : `Start ${phase.label} — only possible once every earlier phase for this degree level has closed`
                            }
                            onClick={() =>
                              void setPhaseOpen(phase, phase.status !== "open")
                            }
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              phase.status === "open"
                                ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                                : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {phase.status === "open"
                              ? "Close"
                              : phase.status === "closed"
                                ? "Reopen"
                                : "Open"}
                          </button>
                          <button
                            type="button"
                            disabled={phase.status === "closed"}
                            title={
                              phase.status === "closed"
                                ? "Reopen the phase to change its schedule"
                                : `Edit ${phase.label}`
                            }
                            aria-label={`Edit ${phase.label}`}
                            onClick={() => openEditPhaseForm(phase)}
                            className={`${iconButton} disabled:cursor-not-allowed disabled:opacity-40`}
                          >
                            <Pencil size={17} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={!phase.hasEnded}
                            title={
                              phase.hasEnded
                                ? `Delete ${phase.label}`
                                : phase.phaseType === "defense"
                                  ? "Can be deleted after the defense day"
                                  : "Can be deleted after the deadline"
                            }
                            aria-label={`Delete ${phase.label}`}
                            onClick={() => void deletePhase(phase)}
                            className={`${deleteButton} disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500`}
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                One phase is open at a time per degree level. Open the next one
                once the one before it is closed; closing a phase only stops new
                submissions, so its reviews and defenses can still go ahead.
              </p>
            </Card>
          )}
        </div>
      )}

      {isLoaded && view === "proposals" && (
        <div className="space-y-4">
          <SectionHeader
            title={`${degreeLevelLabel(lifecycleLevel)} proposals`}
            description={`Assign each submitted ${degreeLevelLabel(lifecycleLevel)} proposal to a supervising professor and, optionally, a cluster. Proposals waiting for a supervisor are listed first.`}
            action={
              <>
                {/* A deleted proposal is only hidden — its row and PDF are still on file. */}
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={showDeletedProposals}
                    onChange={(event) => setShowDeletedProposals(event.target.checked)}
                    className="size-4 rounded border-slate-300"
                  />
                  Show deleted
                </label>
                <button type="button" onClick={() => openAssignment(null)} className={buttonClass}>
                  <Plus size={16} aria-hidden="true" />
                  Assign proposal
                </button>
              </>
            }
          />
          {sortedLevelProposals.length === 0 ? (
            <EmptyState title={`No ${degreeLevelLabel(lifecycleLevel)} proposals yet`}>
              Proposals appear here once students submit them.
            </EmptyState>
          ) : (
            <Card className="!p-0">
              <ul className="divide-y divide-slate-100">
                {sortedLevelProposals.map((proposal) => {
                  const tone = assignmentTone(proposal);
                  return (
                    <li key={proposal.id} className={`p-4 ${tone.row}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{proposal.title}</p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {proposal.submittedByName ?? "Unknown student"}
                            {proposal.degreeLevel === "bachelors"
                              ? ` · group ${proposal.groupMembers.length + 1}/3${proposal.groupMembers.length > 0 ? `: ${proposal.groupMembers.map((member) => member.name).join(", ")}` : ""}`
                              : " · individual"}
                          </p>
                          <p className={`mt-0.5 text-xs font-medium ${tone.cell}`}>
                            Supervisor: {proposal.supervisorName ?? "not assigned yet"}
                          </p>
                          {proposal.reviewComment && (
                            <p className="mt-1 text-xs text-slate-500">
                              {proposal.reviewedByName ? `${proposal.reviewedByName}: ` : ""}"
                              {proposal.reviewComment}"
                            </p>
                          )}
                          {proposal.deletedAt && (
                            <p className="mt-1 text-xs text-slate-400">
                              Deleted by {proposal.deletedByName ?? "an admin"} on{" "}
                              {new Date(proposal.deletedAt).toLocaleDateString()}
                            </p>
                          )}
                          <div className="mt-2">
                            <DocumentActions
                              kind="proposals"
                              entityId={proposal.id}
                              filename={proposal.originalFilename}
                              fallbackName="proposal.pdf"
                              onError={(text) => toast.error(text)}
                            />
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <StatusBadge status={proposal.status} />
                          {proposal.deletedAt && <StatusBadge status="deleted" label="Deleted" />}
                          {!proposal.deletedAt && (
                            <button
                              type="button"
                              onClick={() => openAssignment(proposal)}
                              className={
                                proposal.supervisorId
                                  ? "inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  : "inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                              }
                            >
                              {proposal.supervisorId ? "Change assignment" : "Assign supervisor"}
                            </button>
                          )}
                          {proposal.status === "rejected" && !proposal.deletedAt && (
                            <button
                              type="button"
                              title={`Delete rejected proposal "${proposal.title}"`}
                              aria-label={`Delete rejected proposal "${proposal.title}"`}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete rejected proposal "${proposal.title}"? It will remain visible in history for the student and professor.`,
                                  )
                                ) {
                                  void deleteItem(DELETE_PROPOSAL_AS_ADMIN, proposal.id, "Proposal");
                                }
                              }}
                              className={deleteButton}
                            >
                              <Trash2 size={17} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}

      {isLoaded && view === "defenses" && (
        <div className="space-y-4">
          <SectionHeader
            title={`${degreeLevelLabel(lifecycleLevel)} defenses`}
            description="Every proposal, progress report and approved final report can be defended. Plan when and where, choose an odd-sized panel, and the students, supervisor and panel are notified. The panel decides the outcome by majority."
          />
          <SegmentedControl
            label="Report type"
            options={DEFENSE_KINDS.map((kind) => ({
              value: kind.value,
              label: kind.label,
              count: unplannedOfKind(kind.value) || undefined,
            }))}
            value={defenseKind}
            onChange={(kind) => showDefenses(lifecycleLevel, kind)}
          />
          {/* Progress reports run in rounds, so their defenses divide into the same
              phases. A kind with a single round has nothing to divide. */}
          {phaseChoices.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Phase</span>
              <SegmentedControl
                label="Research phase"
                options={[
                  { value: "all", label: "All phases" },
                  ...phaseChoices.map((choice) => ({ value: choice.id, label: choice.tab })),
                ]}
                value={activePhaseId ?? "all"}
                onChange={(value) => setDefensePhaseId(value === "all" ? null : value)}
              />
            </div>
          )}
          {defenseError && !planTarget && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{defenseError}</p>
          )}

          <section>
            <h3 className="text-sm font-semibold text-slate-900">
              Needs a defense
              {selectedPhaseLabel ? ` · ${selectedPhaseLabel}` : ""}
            </h3>
            {isLoadingCandidates ? (
              <p className="mt-2 text-sm text-slate-500">Loading...</p>
            ) : visibleCandidates.filter((candidate) => !candidate.defense).length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                {visibleCandidates.length > 0
                  ? "Everything here already has a defense planned."
                  : defenseKind === "defense"
                    ? `No ${degreeLevelLabel(lifecycleLevel)} paper has an approved final report yet.`
                    : `No ${degreeLevelLabel(lifecycleLevel)} ${defenseReportLabel(defenseKind).toLowerCase()} has been submitted yet.`}
              </p>
            ) : (
              <Card className="mt-2 !p-0">
                <ul className="divide-y divide-slate-100">
                  {visibleCandidates
                    .filter((candidate) => !candidate.defense)
                    .map((candidate) => (
                      <li
                        key={candidate.targetId}
                        className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{candidate.title}</p>
                          <p className="text-xs text-slate-500">
                            {defenseReportLabel(candidate.kind)}
                            {candidate.phaseLabel ? ` · ${candidate.phaseLabel}` : ""} ·{" "}
                            {candidate.studentNames.join(", ") || "No students"} · Supervisor:{" "}
                            {candidate.supervisorName ?? "not assigned"} ·{" "}
                            <span className="capitalize">{formatStatus(candidate.status)}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            openPlanForm({
                              kind: candidate.kind,
                              targetId: candidate.targetId,
                              title: candidate.title,
                              phaseId: candidate.phaseId,
                              suggestedDate: candidate.suggestedDate,
                              supervisorName: candidate.supervisorName,
                              existing: null,
                            })
                          }
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Plan defense
                        </button>
                      </li>
                    ))}
                </ul>
              </Card>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">
              Planned {defenseKindLabel(defenseKind).toLowerCase()}s
              {selectedPhaseLabel ? ` · ${selectedPhaseLabel}` : ""}
            </h3>
            {kindDefenses.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                {selectedPhaseLabel
                  ? `Nothing planned for ${selectedPhaseLabel} yet.`
                  : "Nothing planned yet."}
              </p>
            ) : (
              <Card className="mt-2 !p-0">
                <ul className="divide-y divide-slate-100">
                  {kindDefenses.map((defense) => {
                    const targetId =
                      defense.proposalId ?? defense.progressReportId ?? defense.paperId;
                    const tone = defenseTone(defense);
                    return (
                      <li key={defense.id} className={`p-4 text-sm ${DEFENSE_TONE_STYLES[tone].row}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">
                              {defense.paperTitle ?? "Untitled research"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {defenseReportLabel(defense.kind)}
                              {defense.phaseLabel ? ` · ${defense.phaseLabel}` : ""} ·{" "}
                              {defense.studentNames.join(", ") || "—"}
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                              <CalendarDays size={14} aria-hidden="true" />
                              {formatDefenseDate(defense.defenseDate)}
                              {defense.scheduledTime ? ` · ${defense.scheduledTime.slice(0, 5)}` : ""}
                              {` · ${defense.location ?? "location not set"}`}
                            </p>
                            <p className="text-xs text-slate-500">
                              Panel: {defense.panelNames.join(", ") || "No panel yet"}
                            </p>
                            {defense.kind === "defense" && defense.currentStatus === "pending" && (
                              <p className="text-xs text-slate-500">
                                {defense.submissionConfirmed ? "Thesis submitted" : "Awaiting thesis"}
                              </p>
                            )}
                            {defense.requiresRedefense && (
                              <p className="mt-1 text-xs font-medium text-amber-800">Has to defend again</p>
                            )}
                            {defense.outcomeComments && (
                              <p className="mt-1 max-w-xl whitespace-pre-line text-xs text-slate-600">
                                "{defense.outcomeComments}"
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${DEFENSE_TONE_STYLES[tone].badge}`}>
                              {DEFENSE_TONE_LABELS[tone]}
                            </span>
                            {targetId && defense.currentStatus === "pending" && !defense.hasEnded && (
                              <button
                                type="button"
                                onClick={() =>
                                  openPlanForm({
                                    kind: defense.kind,
                                    targetId,
                                    title: defense.paperTitle ?? "this report",
                                    phaseId: defense.phaseId,
                                    suggestedDate: null,
                                    supervisorName: defense.supervisorName,
                                    existing: defense,
                                  })
                                }
                                className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                              >
                                Reschedule
                              </button>
                            )}
                            {/* The panel's own majority settles a heard defense. */}
                            {defense.hasEnded && defense.currentStatus === "pending" && (
                              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                                Awaiting panel verdicts
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </section>
        </div>
      )}

      {isLoaded && view === "setup" && (
        <div className="space-y-8">
          <section className="space-y-3">
            <SectionHeader
              title="Degree programs"
              description="The programs students can be enrolled in. A program is created automatically the first time you add a student at a level that has none."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setDegreeForm({ name: "", level: "bachelors", departmentId: "" });
                    setIsDegreeFormOpen(true);
                  }}
                  className={buttonClass}
                >
                  <Plus size={16} aria-hidden="true" />
                  Add degree program
                </button>
              }
            />
            {degrees.length === 0 ? (
              <EmptyState title="No degree programs yet" />
            ) : (
              <Card className="!p-0">
                <ul className="divide-y divide-slate-100">
                  {degrees.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-800">{item.name}</span>
                        <span className="block text-xs text-slate-500">{degreeLevelLabel(item.level)}</span>
                      </span>
                      <span className="flex shrink-0">
                        <button
                          type="button"
                          title={`Edit ${item.name}`}
                          aria-label={`Edit ${item.name}`}
                          onClick={() => {
                            editable("degree", item.id);
                            setDegreeForm({ name: item.name, level: item.level, departmentId: item.departmentId });
                            setIsDegreeFormOpen(true);
                          }}
                          className={iconButton}
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${item.name}`}
                          aria-label={`Delete ${item.name}`}
                          onClick={() => {
                            if (window.confirm(`Delete degree program "${item.name}"?`))
                              void deleteItem(DELETE_DEGREE, item.id, "Degree program");
                          }}
                          className={deleteButton}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
          <section className="space-y-3">
            <SectionHeader
              title="Research clusters"
              description="Groups of related research. A proposal can be placed in a cluster when you assign its supervisor."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setClusterForm({ name: "", departmentId: "" });
                    setIsClusterFormOpen(true);
                  }}
                  className={buttonClass}
                >
                  <Plus size={16} aria-hidden="true" />
                  Add cluster
                </button>
              }
            />
            {sortedClusters.length === 0 ? (
              <EmptyState title="No clusters yet" />
            ) : (
              <Card className="!p-0">
                <ul className="divide-y divide-slate-100">
                  {sortedClusters.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="min-w-0 font-medium text-slate-800">{item.name}</span>
                      <span className="flex shrink-0">
                        <button
                          type="button"
                          title={`Edit ${item.name}`}
                          aria-label={`Edit ${item.name}`}
                          onClick={() => {
                            editable("cluster", item.id);
                            setClusterForm({ name: item.name, departmentId: item.departmentId });
                            setIsClusterFormOpen(true);
                          }}
                          className={iconButton}
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${item.name}`}
                          aria-label={`Delete ${item.name}`}
                          onClick={() => {
                            if (window.confirm(`Delete cluster "${item.name}"?`))
                              void deleteItem(DELETE_CLUSTER, item.id, "Cluster");
                          }}
                          className={deleteButton}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        </div>
      )}

      {isLoaded && view === "departments" && (
        <div className="space-y-4">
          <SectionHeader
            title="Departments"
            description="Each department has its own administrator, degree programs, clusters and research timeline."
            action={
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setDepartmentForm({ name: "", code: "" });
                  setIsDepartmentFormOpen(true);
                }}
                className={buttonClass}
              >
                <Plus size={16} aria-hidden="true" />
                Create department
              </button>
            }
          />
          {departments.length === 0 ? (
            <EmptyState title="No departments yet" />
          ) : (
            <Card className="!p-0">
              <ul className="divide-y divide-slate-100">
                {departments.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-800">{item.name}</span>
                      <span className="block text-xs text-slate-500">
                        Code {item.code} · created {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                    <span className="flex shrink-0">
                      <button
                        type="button"
                        title={`Edit ${item.name}`}
                        aria-label={`Edit ${item.name}`}
                        onClick={() => {
                          editable("department", item.id);
                          setDepartmentForm({ name: item.name, code: item.code });
                          setIsDepartmentFormOpen(true);
                        }}
                        className={iconButton}
                      >
                        <Pencil size={17} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title={`Delete ${item.name}`}
                        aria-label={`Delete ${item.name}`}
                        onClick={() => {
                          if (window.confirm(`Delete department "${item.name}"?`))
                            void deleteItem(DELETE_DEPARTMENT, item.id, "Department");
                        }}
                        className={deleteButton}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {isDegreeFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editing?.type === "degree"
                    ? "Edit degree program"
                    : "Create degree program"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editing?.type === "degree"
                    ? "Update the degree program details."
                    : "Add a degree program to a department."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close degree program form"
                onClick={() => {
                  setEditing(null);
                  setDegreeForm({
                    name: "",
                    level: "bachelors",
                    departmentId: "",
                  });
                  setIsDegreeFormOpen(false);
                  setDegreeFormError(null);
                }}
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={saveDegree}>
              <label className="block text-sm font-medium text-slate-700">
                Program name
                <input
                  required
                  value={degreeForm.name}
                  onChange={(event) =>
                    setDegreeForm({
                      ...degreeForm,
                      name: event.target.value,
                    })
                  }
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Level
                <select
                  required
                  value={degreeForm.level}
                  onChange={(event) =>
                    setDegreeForm({
                      ...degreeForm,
                      level: event.target.value,
                    })
                  }
                  className={inputClass}
                >
                  <option value="bachelors">Bachelor's</option>
                  <option value="masters">Master's</option>
                  <option value="phd">PhD</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Department
                <select
                  required
                  value={degreeForm.departmentId}
                  onChange={(event) =>
                    setDegreeForm({
                      ...degreeForm,
                      departmentId: event.target.value,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">Select department</option>
                  {departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {degreeFormError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {degreeFormError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setDegreeForm({
                      name: "",
                      level: "bachelors",
                      departmentId: "",
                    });
                    setIsDegreeFormOpen(false);
                    setDegreeFormError(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {editing?.type === "degree"
                    ? "Save changes"
                    : "Create degree program"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isClusterFormOpen && (
        /* Cluster forms use a modal so creation stays focused above the table. */
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditing(null);
              setClusterForm({ name: "", departmentId: "" });
              setIsClusterFormOpen(false);
              setClusterFormError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cluster-form-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            {/* The dialog header identifies the current create or edit action. */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="cluster-form-title"
                  className="text-xl font-semibold text-slate-900"
                >
                  {editing?.type === "cluster"
                    ? "Edit cluster"
                    : "Create cluster"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add a research cluster and assign it to a department.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setClusterForm({ name: "", departmentId: "" });
                  setIsClusterFormOpen(false);
                  setClusterFormError(null);
                }}
                aria-label="Close cluster form"
                title="Close cluster form"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* The cluster fields collect the values required by the GraphQL mutation. */}
            <form onSubmit={saveCluster} className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Cluster name
                <input
                  required
                  autoFocus
                  value={clusterForm.name}
                  onChange={(event) =>
                    setClusterForm({
                      ...clusterForm,
                      name: event.target.value,
                    })
                  }
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Department
                <select
                  required
                  value={clusterForm.departmentId}
                  onChange={(event) =>
                    setClusterForm({
                      ...clusterForm,
                      departmentId: event.target.value,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">Select department</option>
                  {departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {clusterFormError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {clusterFormError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setClusterForm({ name: "", departmentId: "" });
                    setIsClusterFormOpen(false);
                    setClusterFormError(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Plus size={16} aria-hidden="true" />
                  {editing?.type === "cluster"
                    ? "Save changes"
                    : "Create cluster"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isProposalFormOpen && (
        /* Assignment fields keep the selected proposal and reviewers together in one dialog. */
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="proposal-form-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="proposal-form-title"
                  className="text-xl font-semibold text-slate-900"
                >
                  {editingProposalId
                    ? "Edit proposal assignment"
                    : "Assign student proposal"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a professor, optionally place the proposal in a
                  cluster, and manage its group members.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close proposal assignment form"
                title="Close proposal assignment form"
                onClick={() => {
                  setIsProposalFormOpen(false);
                  setGroupStudentId("");
                  setProposalFormError(null);
                }}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={assignProposal} className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Student proposal
                <select
                  required
                  value={assignmentForm.proposalId}
                  onChange={(event) => {
                    setAssignmentForm({
                      ...assignmentForm,
                      proposalId: event.target.value,
                    });
                    setGroupStudentId("");
                  }}
                  className={inputClass}
                >
                  <option value="">Select student proposal</option>
                  {levelProposals
                    .filter(
                      (proposal) =>
                        proposal.submittedBy &&
                        students.some(
                          (student) =>
                            student.id === proposal.submittedBy,
                        ),
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} ({item.status})
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Professor
                <select
                  required
                  value={assignmentForm.supervisorId}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      supervisorId: event.target.value,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">Select professor</option>
                  {professors.map((item) => {
                    const capacity = professorCapacity(item.id);
                    const load = professorLoad(
                      item.id,
                      selectedProposal?.id ?? undefined,
                    );
                    const blocked =
                      item.id === assignmentForm.supervisorId
                        ? null
                        : supervisionBlock(item.id, selectedProposal);
                    return (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={Boolean(blocked)}
                      >
                        {item.name} ({load}
                        {capacity !== null ? `/${capacity}` : ""}{" "}
                        students){blocked ? ` — ${blocked}` : ""}
                      </option>
                    );
                  })}
                </select>
                {selectedSupervisorBlock && (
                  <span className="text-xs font-normal text-red-600">
                    {selectedSupervisorBlock}
                  </span>
                )}
                {selectedProposalLevel && (
                  <span className="text-xs font-normal text-slate-500">
                    {selectedProposalLevel === "bachelors"
                      ? "A professor can supervise one Bachelor's group at a time"
                      : `A professor can supervise one ${degreeLevelLabel(selectedProposalLevel)} project at a time`}
                    {`, and ${SUPERVISION_LIMITS.totalStudents} students overall.`}
                  </span>
                )}
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Cluster
                <select
                  value={assignmentForm.clusterId}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      clusterId: event.target.value,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">Select cluster (optional)</option>
                  {sortedClusters.map((item) => (
                    <option key={item.id} value={item.id}>
                      {departmentName(item.departmentId)}: {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedProposal &&
                selectedProposal.degreeLevel !== "bachelors" && (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    {degreeLevelLabel(
                      selectedProposal.degreeLevel ?? "",
                    )}{" "}
                    proposals are individual work, so there are no group
                    members to manage.
                  </p>
                )}
              {selectedProposal &&
                selectedProposal.degreeLevel === "bachelors" && (
                  <div className="grid gap-1.5 text-sm font-medium text-slate-700">
                    Group members{" "}
                    <span className="font-normal text-slate-500">
                      ({selectedProposal.groupMembers.length + 1}/3
                      students)
                    </span>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-normal text-slate-700">
                      <p className="font-medium">
                        {selectedProposal.submittedByName ??
                          "Proposal owner"}{" "}
                        (owner)
                      </p>
                      {selectedProposal.groupMembers.map((member) => (
                        <div
                          key={member.id}
                          className="mt-2 flex items-center justify-between"
                        >
                          <span>{member.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              void adjustProposalMember(
                                selectedProposal,
                                member.id,
                                false,
                              )
                            }
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 flex gap-2 font-normal">
                      <select
                        value={groupStudentId}
                        onChange={(event) =>
                          setGroupStudentId(event.target.value)
                        }
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">
                          Select department student
                        </option>
                        {students
                          .filter(
                            (student) =>
                              student.id !==
                                selectedProposal.submittedBy &&
                              !selectedProposal.groupMembers.some(
                                (member) => member.id === student.id,
                              ) &&
                              !committedElsewhereIds.has(student.id),
                          )
                          .map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={
                          !groupStudentId ||
                          selectedProposal.groupMembers.length >= 2
                        }
                        onClick={() =>
                          void adjustProposalMember(
                            selectedProposal,
                            groupStudentId,
                            true,
                          )
                        }
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              {proposalFormError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {proposalFormError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProposalId(null);
                    setIsProposalFormOpen(false);
                    setGroupStudentId("");
                    setProposalFormError(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Plus size={16} aria-hidden="true" />
                  Assign proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {planTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {planTarget.existing ? "Reschedule defense" : "Plan defense"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {defenseKindLabel(planTarget.kind)} · {planTarget.title}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close defense form"
                onClick={() => setPlanTarget(null)}
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={savePlan} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Date
                  <input
                    required
                    type="date"
                    value={planForm.date}
                    onChange={(event) =>
                      setPlanForm({ ...planForm, date: event.target.value })
                    }
                    className={inputClass}
                  />
                  {planTarget.suggestedDate && !planTarget.existing && (
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Pre-filled with the final defense day from the timeline.
                    </span>
                  )}
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Time
                  <input
                    required
                    type="time"
                    value={planForm.time}
                    onChange={(event) =>
                      setPlanForm({ ...planForm, time: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Location
                <input
                  required
                  value={planForm.location}
                  onChange={(event) =>
                    setPlanForm({ ...planForm, location: event.target.value })
                  }
                  placeholder="e.g. Seminar hall, Block B"
                  className={inputClass}
                />
              </label>
              <fieldset>
                <legend className="text-sm font-medium text-slate-700">
                  Defense panel{" "}
                  <span className="font-normal text-slate-500">
                    ({planForm.panelIds.length} selected)
                  </span>
                </legend>
                {/* The panel decides by majority, so an even one could tie. The
                    backend refuses it either way — this just says so first. */}
                {planForm.panelIds.length % 2 === 0 && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {planForm.panelIds.length === 0
                      ? "Pick an odd number of professors — the panel decides the outcome by majority."
                      : "An even panel could tie. Add or remove one member."}
                  </p>
                )}
                {panelChoices.length === 0 ? (
                  <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    No professor has a professor profile yet. Create one under
                    Users → Professors → Profiles to add them to panels.
                  </p>
                ) : (
                  <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                    {panelChoices.map((professor) => (
                      <label
                        key={professor.userId}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={planForm.panelIds.includes(professor.userId)}
                          onChange={() => togglePanelMember(professor.userId)}
                        />
                        <span>
                          {professor.userName}
                          {professor.userName === planTarget.supervisorName && (
                            <span className="ml-1 text-xs text-slate-400">
                              (supervisor)
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {professors.length > panelChoices.length &&
                  panelChoices.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      {professors.length - panelChoices.length} professor
                      {professors.length - panelChoices.length === 1
                        ? " isn't"
                        : "s aren't"}{" "}
                      listed because they have no professor profile.
                    </p>
                  )}
              </fieldset>
              {defenseError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {defenseError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPlanTarget(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlan}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingPlan
                    ? "Saving..."
                    : planTarget.existing
                      ? "Reschedule and notify"
                      : "Plan and notify"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isPhaseFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingPhaseId
                    ? "Edit research phase"
                    : "Add research phase"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingPhaseId
                    ? "If the phase is open, the students and professors involved are told the schedule changed."
                    : "The phase is added as a draft. Nobody is notified until you open it on the timeline."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close research phase form"
                onClick={closePhaseForm}
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={savePhase} className="mt-6 space-y-4">
              <fieldset disabled={Boolean(editingPhaseId)}>
                <legend className="text-sm font-medium text-slate-700">
                  Research stage
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {PHASE_TYPES.map((type) => {
                    const option = optionFor(phaseForm.degreeLevel, type.value);
                    // While editing, the stage is fixed, so only the one being edited shows.
                    const blocked = !editingPhaseId && option !== null && !option.allowed;
                    return (
                      <label
                        key={type.value}
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium has-disabled:cursor-not-allowed has-disabled:opacity-50 ${phaseForm.phaseType === type.value ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                      >
                        <input
                          type="radio"
                          name="phaseType"
                          value={type.value}
                          disabled={blocked}
                          checked={phaseForm.phaseType === type.value}
                          onChange={() =>
                            changePhaseKind({ phaseType: type.value })
                          }
                          className="sr-only"
                        />
                        {type.label}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {
                    PHASE_TYPES.find(
                      (type) => type.value === phaseForm.phaseType,
                    )?.hint
                  }
                </p>
                {!editingPhaseId && (
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                    {PHASE_TYPES.map((type) => {
                      const option = optionFor(phaseForm.degreeLevel, type.value);
                      return option && !option.allowed ? (
                        <li key={type.value}>
                          <span className="font-medium text-slate-600">{type.label}:</span>{" "}
                          {option.reason}
                        </li>
                      ) : null;
                    })}
                  </ul>
                )}
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <label className="block text-sm font-medium text-slate-700">
                  Degree level
                  <select
                    value={phaseForm.degreeLevel}
                    disabled={Boolean(editingPhaseId)}
                    onChange={(event) =>
                      changePhaseKind({ degreeLevel: event.target.value })
                    }
                    className={`${inputClass} disabled:bg-slate-100`}
                  >
                    {DEGREE_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </label>
                {/* Steps are numbered in the order phases are added, so there is nothing to type. */}
                <div className="block text-sm font-medium text-slate-700">
                  Step
                  <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal text-slate-600">
                    {editingPhaseId
                      ? (researchPhases.find((phase) => phase.id === editingPhaseId)?.sequenceNumber ?? "—")
                      : (optionFor(phaseForm.degreeLevel, phaseForm.phaseType)?.sequenceNumber ?? "Next")}
                  </p>
                </div>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Title
                <input
                  required
                  value={phaseForm.label}
                  onChange={(event) => {
                    setIsPhaseLabelCustom(true);
                    setPhaseForm({ ...phaseForm, label: event.target.value });
                  }}
                  placeholder="e.g. Progress report 2"
                  className={inputClass}
                />
              </label>
              {phaseForm.phaseType === "defense" ? (
                <label className="block text-sm font-medium text-slate-700">
                  Defense day
                  <input
                    required
                    type="date"
                    value={phaseForm.defenseDate}
                    onChange={(event) =>
                      setPhaseForm({
                        ...phaseForm,
                        defenseDate: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Opens at
                      <input
                        required
                        type="datetime-local"
                        value={phaseForm.opensAt}
                        onChange={(event) =>
                          setPhaseForm({
                            ...phaseForm,
                            opensAt: event.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Deadline
                      <input
                        required
                        type="datetime-local"
                        min={phaseForm.opensAt || undefined}
                        value={phaseForm.deadlineAt}
                        onChange={(event) =>
                          setPhaseForm({
                            ...phaseForm,
                            deadlineAt: event.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={phaseForm.gracePeriodEnabled}
                      onChange={(event) =>
                        setPhaseForm({
                          ...phaseForm,
                          gracePeriodEnabled: event.target.checked,
                        })
                      }
                      className="mt-0.5"
                    />
                    <span>
                      Allow late submissions
                      <span className="block text-xs text-slate-500">
                        Students can still submit after the deadline.
                      </span>
                    </span>
                  </label>
                </>
              )}
              {phaseFormError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {phaseFormError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePhaseForm}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPhase}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingPhase
                    ? "Saving..."
                    : editingPhaseId
                      ? "Save changes"
                      : "Add to timeline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDepartmentFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editing?.type === "department"
                    ? "Edit department"
                    : "Create department"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editing?.type === "department"
                    ? "Update the department details."
                    : "Add a department to the research workspace."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close department form"
                onClick={closeDepartmentForm}
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={saveDepartment} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Department name
                <input
                  required
                  value={departmentForm.name}
                  onChange={(event) =>
                    setDepartmentForm({
                      ...departmentForm,
                      name: event.target.value,
                    })
                  }
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Department code
                <input
                  required
                  value={departmentForm.code}
                  onChange={(event) =>
                    setDepartmentForm({
                      ...departmentForm,
                      code: event.target.value,
                    })
                  }
                  className={inputClass}
                />
              </label>
              {departmentFormError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {departmentFormError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDepartmentForm}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {editing?.type === "department"
                    ? "Save changes"
                    : "Create department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
export default AdminManagement;
