import { useEffect, useState } from "react";
import { Download, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { gql } from "@apollo/client";
import { print } from "graphql";
import { downloadProposalFile, viewProposalFile } from "../utils/proposalFile";
import { DEFENSE_CANDIDATES_QUERY, PROFILES_QUERY, RESEARCH_PHASES_QUERY } from "../queries/queries";
import { CREATE_RESEARCH_PHASE, DELETE_RESEARCH_PHASE, SCHEDULE_RESEARCH_DEFENSE, UPDATE_RESEARCH_PHASE } from "../mutations/mutations";

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
}
type DefenseKind = "proposal" | "progress_report" | "defense";
interface DefenseCandidate {
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
interface PlanTarget { kind: string; targetId: string; title: string; phaseId: string | null; suggestedDate: string | null; supervisorName: string | null; existing: ScheduledDefense | null; }
interface ResearchPhase { id: string; phaseType: string; degreeLevel: string; label: string; sequenceNumber: number; opensAt: string | null; deadlineAt: string | null; defenseDate: string | null; gracePeriodEnabled: boolean; isOpen: boolean; hasEnded: boolean; }
interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

type Tab = "departments" | "degrees" | "clusters" | "lifecycle";
type LifecycleSection = "timeline" | "proposals" | "defenses";
type AdminRole = "admin" | "super_admin";
const ENDPOINT = "http://127.0.0.1:8000/graphql";
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
  query Proposals {
    proposals {
      id
      submittedBy
      submittedByName
      title
      status
      supervisorId
      supervisorName
      clusterId
      groupMembers { id name status }
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
const DEPARTMENT_DEFENSES = gql`query DepartmentDefenses { departmentDefenses { id kind proposalId progressReportId paperId paperTitle defenseDate scheduledTime location submissionConfirmed phaseId phaseLabel currentStatus degreeLevel studentNames supervisorName panelNames panelProfessorIds } }`;
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
    addProposalMemberAsAdmin(studentInput: $studentInput) { proposalId studentId }
  }
`;
const DELETE_PROPOSAL_MEMBER_AS_ADMIN = gql`
  mutation DeleteProposalMemberAsAdmin($studentInput: AdminProposalMemberInput!) {
    deleteProposalMemberAsAdmin(studentInput: $studentInput) { proposalId studentId }
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

const statusStyles: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  changes_requested: "bg-amber-50 text-amber-700",
  assigned: "bg-slate-100 text-slate-600",
};
const formatStatus = (status: string) => status.replace(/_/g, " ");

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const buttonClass =
  "inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50";

const PHASE_TYPES = [
  { value: "proposal", label: "Proposal", hint: "Students submit their research proposals between the opening time and the deadline." },
  { value: "progress_report", label: "Progress report", hint: "Add one progress report phase per review round. Each round has its own deadline." },
  { value: "defense", label: "Final defense", hint: "One shared defense day. Individual time slots are scheduled per paper below." },
] as const;
const DEGREE_LEVELS = [
  { value: "bachelors", label: "Bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
] as const;
const phaseTypeLabel = (phaseType: string) => PHASE_TYPES.find((item) => item.value === phaseType)?.label ?? phaseType;
const degreeLevelLabel = (level: string) => DEGREE_LEVELS.find((item) => item.value === level)?.label ?? level;
const emptyPhaseForm = { phaseType: "proposal", degreeLevel: "bachelors", label: "", sequenceNumber: "1", opensAt: "", deadlineAt: "", defenseDate: "", gracePeriodEnabled: false };

const padTwo = (value: number) => String(value).padStart(2, "0");
// <input type="datetime-local"> wants local wall-clock time, not an ISO string in UTC.
const toDateTimeInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}T${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
};
// Supervision limits, kept in step with backend/app/constraints.py (which enforces them).
const SUPERVISION_LIMITS = { bachelorsGroups: 1, mastersStudents: 5, phdStudents: 4, totalStudents: 12 };
const ACTIVE_SUPERVISION_STATUSES = new Set(["assigned", "approved", "accepted", "changes_requested", "in_progress"]);
const DEFENSE_KINDS: { value: DefenseKind; label: string }[] = [
  { value: "proposal", label: "Proposal defenses" },
  { value: "progress_report", label: "Progress report defenses" },
  { value: "defense", label: "Final defenses" },
];
const defenseReportLabel = (kind: string) =>
  kind === "proposal" ? "Proposal" : kind === "progress_report" ? "Progress report" : "Final report";
const defenseKindLabel = (kind: string) =>
  kind === "proposal" ? "Proposal defense" : kind === "progress_report" ? "Progress defense" : "Final defense";
const describeDefenseSlot = (defense: { defenseDate: string; scheduledTime: string | null; location: string | null }) =>
  `${new Date(defense.defenseDate).toLocaleDateString(undefined, { dateStyle: "medium" })}${defense.scheduledTime ? ` at ${defense.scheduledTime.slice(0, 5)}` : ""}${defense.location ? ` · ${defense.location}` : ""}`;
const formatPhaseDateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function phaseStatus(phase: ResearchPhase): { label: string; className: string } {
  const now = Date.now();
  if (phase.phaseType === "defense") {
    if (!phase.defenseDate) return { label: "No date", className: "bg-slate-100 text-slate-600" };
    const endOfDefenseDay = new Date(phase.defenseDate);
    endOfDefenseDay.setHours(23, 59, 59, 999);
    return endOfDefenseDay.getTime() < now
      ? { label: "Held", className: "bg-slate-100 text-slate-600" }
      : { label: "Scheduled", className: "bg-blue-50 text-blue-700" };
  }
  if (phase.opensAt && new Date(phase.opensAt).getTime() > now) return { label: "Upcoming", className: "bg-slate-100 text-slate-600" };
  if (phase.deadlineAt && new Date(phase.deadlineAt).getTime() < now) {
    return phase.gracePeriodEnabled
      ? { label: "Past deadline · late allowed", className: "bg-amber-50 text-amber-700" }
      : { label: "Closed", className: "bg-red-50 text-red-700" };
  }
  return { label: "Open", className: "bg-emerald-50 text-emerald-700" };
}

function AdminManagement({ role }: { role: AdminRole }) {
  const [tab, setTab] = useState<Tab>(role === "super_admin" ? "departments" : "degrees");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [degrees, setDegrees] = useState<DegreeProgram[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-form errors so a failed submit shows inside the open modal, not on the page behind it.
  const [departmentFormError, setDepartmentFormError] = useState<string | null>(null);
  const [degreeFormError, setDegreeFormError] = useState<string | null>(null);
  const [clusterFormError, setClusterFormError] = useState<string | null>(null);
  const [proposalFormError, setProposalFormError] = useState<string | null>(null);
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
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [groupStudentId, setGroupStudentId] = useState("");
  const [scheduledDefenses, setScheduledDefenses] = useState<ScheduledDefense[]>([]);
  const [researchPhases, setResearchPhases] = useState<ResearchPhase[]>([]);
  const [lifecycleSection, setLifecycleSection] = useState<LifecycleSection>("timeline");
  const [defenseError, setDefenseError] = useState<string | null>(null);
  // The lifecycle tab works on one degree level at a time.
  const [lifecycleLevel, setLifecycleLevel] = useState("bachelors");
  const [defenseKind, setDefenseKind] = useState<DefenseKind>("proposal");
  const [defenseCandidates, setDefenseCandidates] = useState<DefenseCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [planTarget, setPlanTarget] = useState<PlanTarget | null>(null);
  const [planForm, setPlanForm] = useState<{ date: string; time: string; location: string; panelIds: string[] }>({ date: "", time: "", location: "", panelIds: [] });
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [phaseForm, setPhaseForm] = useState(emptyPhaseForm);
  const [isPhaseFormOpen, setIsPhaseFormOpen] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [phaseFormError, setPhaseFormError] = useState<string | null>(null);
  const [isSavingPhase, setIsSavingPhase] = useState(false);
  // Once the admin types their own title, stop replacing it with a suggestion.
  const [isPhaseLabelCustom, setIsPhaseLabelCustom] = useState(false);

  const loadData = async () => {
    setError(null);
    try {
      const [departmentData, degreeData, clusterData, userData, proposalData, profileData, defenseData, phaseData] =
        await Promise.all([
          request<{ departments: Department[] }>(DEPARTMENTS),
          request<{ degreePrograms: DegreeProgram[] }>(DEGREES),
          request<{ clusters: Cluster[] }>(CLUSTERS),
          request<{ users: User[] }>(USERS),
          request<{ proposals: Proposal[] }>(PROPOSALS),
          request<{ profiles: Profile[] }>(PROFILES_QUERY),
          request<{ departmentDefenses: ScheduledDefense[] }>(DEPARTMENT_DEFENSES),
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
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load management data.",
      );
    }
  };

  useEffect(() => {
    const initializeManagementData = async () => {
      await loadData();
    };

    void initializeManagementData();
  }, []);
  const departmentName = (id: string) =>
    departments.find((item) => item.id === id)?.name ?? "Unknown department";
  // Keep cluster rows grouped by department and predictable within each group.
  const sortedClusters = [...clusters].sort((firstCluster, secondCluster) => {
    const departmentOrder = departmentName(firstCluster.departmentId).localeCompare(
      departmentName(secondCluster.departmentId),
      undefined,
      { sensitivity: "base" },
    );
    return departmentOrder || firstCluster.name.localeCompare(secondCluster.name);
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
  const proposalSize = (proposal: Proposal) => 1 + proposal.groupMembers.filter((member) => member.status === "accepted").length;
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
    activeSupervised(professorId, excludeProposalId).reduce((total, proposal) => total + proposalSize(proposal), 0);
  const professorCapacity = (professorId: string) =>
    profiles.find((profile) => profile.userId === professorId)?.maxStudents ?? null;
  // Why a professor can't take this proposal, or null. Same limits as backend/app/constraints.py.
  const supervisionBlock = (professorId: string, proposal: Proposal | null): string | null => {
    if (!proposal) return null;
    const active = activeSupervised(professorId, proposal.id);
    const size = proposalSize(proposal);
    const atLevel = active.filter((item) => item.degreeLevel === proposal.degreeLevel);
    const studentsAtLevel = atLevel.reduce((total, item) => total + proposalSize(item), 0);
    if (proposal.degreeLevel === "bachelors" && atLevel.length >= SUPERVISION_LIMITS.bachelorsGroups) return "already supervising a Bachelor's group";
    if (proposal.degreeLevel === "masters" && studentsAtLevel + size > SUPERVISION_LIMITS.mastersStudents) return `already supervising ${SUPERVISION_LIMITS.mastersStudents} Master's students`;
    if (proposal.degreeLevel === "phd" && studentsAtLevel + size > SUPERVISION_LIMITS.phdStudents) return `already supervising ${SUPERVISION_LIMITS.phdStudents} PhD students`;
    const load = professorLoad(professorId, proposal.id);
    if (load + size > SUPERVISION_LIMITS.totalStudents) return `already supervising ${SUPERVISION_LIMITS.totalStudents} students`;
    const capacity = professorCapacity(professorId);
    if (capacity !== null && load + size > capacity) return `at their limit of ${capacity} students`;
    return null;
  };
  const awaitingAssignment = (level: string) =>
    proposals.filter((proposal) => proposal.degreeLevel === level && !proposal.supervisorId && !proposal.deletedAt && proposal.status === "submitted").length;
  const selectedProposal = proposals.find((proposal) => proposal.id === assignmentForm.proposalId) ?? null;
  const levelPhases = researchPhases
    .filter((phase) => phase.degreeLevel === lifecycleLevel)
    .sort((first, second) => first.sequenceNumber - second.sequenceNumber);
  const levelProposals = proposals.filter((proposal) => proposal.degreeLevel === lifecycleLevel);
  const levelDefenses = scheduledDefenses.filter((defense) => defense.degreeLevel === lifecycleLevel);
  const kindDefenses = levelDefenses.filter((defense) => defense.kind === defenseKind);
  // Only professors with a professor profile can sit on a panel.
  const panelChoices = profiles
    .filter((profile) => profile.role.toLowerCase() === "professor")
    .sort((first, second) => first.userName.localeCompare(second.userName));
  const selectedProposalLevel = selectedProposal?.degreeLevel ?? null;
  // Students already owning or belonging to a different active proposal's group can't be picked
  // again; a rejected or deleted proposal frees its students.
  const committedElsewhereIds = new Set(
    proposals
      .filter((proposal) => proposal.id !== selectedProposal?.id && proposal.status !== "rejected" && proposal.status !== "withdrawn" && !proposal.deletedAt)
      .flatMap((proposal) => [proposal.submittedBy, ...proposal.groupMembers.map((member) => member.id)])
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
      setMessage("Department saved.");
      await loadData();
    } catch (e) {
      setDepartmentFormError(e instanceof Error ? e.message : "Unable to save department.");
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
      setMessage("Degree program saved.");
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
      setMessage("Cluster saved.");
      await loadData();
    } catch (e) {
      setClusterFormError(e instanceof Error ? e.message : "Unable to save cluster.");
    }
  };
  const deleteItem = async (
    mutation: ReturnType<typeof gql>,
    id: string,
    label: string,
  ) => {
    try {
      await request(mutation, { adminInput: { id } });
      setMessage(`${label} deleted.`);
      await loadData();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `Unable to delete ${label.toLowerCase()}.`,
      );
    }
  };

  const loadDefenseCandidates = async (level: string, kind: DefenseKind) => {
    setIsLoadingCandidates(true);
    setDefenseError(null);
    try {
      const result = await request<{ defenseCandidates: DefenseCandidate[] }>(DEFENSE_CANDIDATES_QUERY, { degreeLevel: level, kind });
      setDefenseCandidates(result.defenseCandidates);
    } catch (requestError) {
      setDefenseError(requestError instanceof Error ? requestError.message : "Unable to load what can be defended.");
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const showDefenses = (level: string, kind: DefenseKind) => {
    setDefenseKind(kind);
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
    const targetKey = planTarget.kind === "proposal" ? "proposalId" : planTarget.kind === "progress_report" ? "progressReportId" : "paperId";
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
      setMessage(`Defense ${planTarget.existing ? "rescheduled" : "planned"} for "${planTarget.title}". The students, supervisor and panel were notified.`);
      setPlanTarget(null);
      await loadData();
      await loadDefenseCandidates(lifecycleLevel, defenseKind);
    } catch (requestError) {
      setDefenseError(requestError instanceof Error ? requestError.message : "Unable to plan the defense.");
    } finally {
      setIsSavingPlan(false);
    }
  };

  const deletePhase = async (phase: ResearchPhase) => {
    if (!window.confirm(`Delete "${phase.label}" from the timeline? Its submissions, history and defenses stay on record, but the phase no longer appears in any dashboard.`)) return;
    setError(null);
    setMessage(null);
    try {
      await request(DELETE_RESEARCH_PHASE, { adminInput: { id: phase.id } });
      setMessage(`"${phase.label}" was removed from the timeline.`);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete the research phase.");
    }
  };

  // Next free step number for the level, plus a title like "Progress report 3".
  const suggestPhase = (phaseType: string, degreeLevel: string) => {
    const levelPhases = researchPhases.filter((phase) => phase.degreeLevel === degreeLevel);
    const nextSequence = levelPhases.reduce((highest, phase) => Math.max(highest, phase.sequenceNumber), 0) + 1;
    const round = levelPhases.filter((phase) => phase.phaseType === phaseType).length + 1;
    const baseLabel = phaseType === "proposal" ? "Proposal submission" : phaseTypeLabel(phaseType);
    const label = phaseType === "progress_report" || round > 1 ? `${baseLabel} ${round}` : baseLabel;
    return { sequenceNumber: String(nextSequence), label };
  };

  const openNewPhaseForm = (degreeLevel = "bachelors") => {
    const hasProposalPhase = researchPhases.some((phase) => phase.degreeLevel === degreeLevel && phase.phaseType === "proposal");
    const phaseType = hasProposalPhase ? "progress_report" : "proposal";
    setEditingPhaseId(null);
    setIsPhaseLabelCustom(false);
    setPhaseFormError(null);
    setPhaseForm({ ...emptyPhaseForm, phaseType, degreeLevel, ...suggestPhase(phaseType, degreeLevel) });
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
      sequenceNumber: String(phase.sequenceNumber),
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
  const changePhaseKind = (changes: { phaseType?: string; degreeLevel?: string }) => {
    const next = { ...phaseForm, ...changes };
    const suggestion = suggestPhase(next.phaseType, next.degreeLevel);
    setPhaseForm({ ...next, sequenceNumber: suggestion.sequenceNumber, label: isPhaseLabelCustom ? next.label : suggestion.label });
  };

  const savePhase = async (event: React.FormEvent) => {
    event.preventDefault();
    setPhaseFormError(null);
    const isDefense = phaseForm.phaseType === "defense";
    if (!isDefense && new Date(phaseForm.opensAt).getTime() >= new Date(phaseForm.deadlineAt).getTime()) {
      setPhaseFormError("The deadline must be later than the opening time.");
      return;
    }
    const schedule = {
      label: phaseForm.label.trim(),
      sequenceNumber: Number(phaseForm.sequenceNumber),
      opensAt: isDefense ? null : new Date(phaseForm.opensAt).toISOString(),
      deadlineAt: isDefense ? null : new Date(phaseForm.deadlineAt).toISOString(),
      // Local midnight, so the defense day doesn't shift a day in timezones behind UTC.
      defenseDate: isDefense ? new Date(`${phaseForm.defenseDate}T00:00`).toISOString() : null,
      gracePeriodEnabled: isDefense ? false : phaseForm.gracePeriodEnabled,
    };
    setIsSavingPhase(true);
    try {
      let notifiedCount: number | null;
      if (editingPhaseId) {
        const result = await request<{ updateResearchPhase: { notifiedCount: number | null } }>(UPDATE_RESEARCH_PHASE, {
          adminInput: { id: editingPhaseId, ...schedule },
        });
        notifiedCount = result.updateResearchPhase.notifiedCount;
      } else {
        const result = await request<{ createResearchPhase: { notifiedCount: number | null } }>(CREATE_RESEARCH_PHASE, {
          adminInput: { phaseType: phaseForm.phaseType, degreeLevel: phaseForm.degreeLevel, ...schedule },
        });
        notifiedCount = result.createResearchPhase.notifiedCount;
      }
      const audience = notifiedCount
        ? `${notifiedCount} ${notifiedCount === 1 ? "person was" : "people were"} notified.`
        : "No students or professors match this degree level yet, so nobody was notified.";
      setMessage(`${editingPhaseId ? "Research phase updated" : "Research phase added to the timeline"}. ${audience}`);
      closePhaseForm();
      await loadData();
    } catch (requestError) {
      setPhaseFormError(requestError instanceof Error ? requestError.message : "Unable to save the research phase.");
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
      setMessage("Proposal assigned.");
      setAssignmentForm({ proposalId: "", supervisorId: "", clusterId: "" });
      setEditingProposalId(null);
      setIsProposalFormOpen(false);
      await loadData();
    } catch (e) {
      setProposalFormError(e instanceof Error ? e.message : "Unable to assign proposal.");
    }
  };

  const adjustProposalMember = async (proposal: Proposal, studentId: string, add: boolean) => {
    setProposalFormError(null);
    try {
      await request(add ? ADD_PROPOSAL_MEMBER_AS_ADMIN : DELETE_PROPOSAL_MEMBER_AS_ADMIN, {
        studentInput: { proposalId: proposal.id, studentId },
      });
      setGroupStudentId("");
      await loadData();
    } catch (requestError) {
      setProposalFormError(requestError instanceof Error ? requestError.message : "Unable to update proposal group.");
    }
  };

  const tabs: [Tab, string][] = role === "super_admin"
    ? [["departments", "Departments"]]
    : [
        ["degrees", "Degree programs"],
        ["clusters", "Clusters"],
        ["lifecycle", "Research timeline & defenses"],
      ];
  return (
    <div className="min-h-full p-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setError(null);
              setMessage(null);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {message && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {tab === "departments" && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-0 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">
                Departments
              </h2>
              <p className="text-sm text-slate-500">
                Manage academic departments
              </p>
            </div>
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
          </div>
          <div className="overflow-x-auto pt-6">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No departments found.
                    </td>
                  </tr>
                ) : (
                  departments.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {item.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.code}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          title={`Edit ${item.name}`}
                          aria-label={`Edit ${item.name}`}
                          onClick={() => {
                            editable("department", item.id);
                            setDepartmentForm({
                              name: item.name,
                              code: item.code,
                            });
                            setIsDepartmentFormOpen(true);
                          }}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${item.name}`}
                          aria-label={`Delete ${item.name}`}
                          onClick={() => {
                            if (window.confirm(`Delete department "${item.name}"?`)) {
                              void deleteItem(DELETE_DEPARTMENT, item.id, "Department");
                            }
                          }}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "degrees" && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-0 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">
                Degree programs
              </h2>
              <p className="text-sm text-slate-500">Manage degree programs</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDegreeForm({
                  name: "",
                  level: "bachelors",
                  departmentId: "",
                });
                setIsDegreeFormOpen(true);
              }}
              className={buttonClass}
            >
              <Plus size={16} aria-hidden="true" />
              Create degree program
            </button>
          </div>
          <div className="overflow-x-auto pt-6">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {degrees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No degree programs found.
                    </td>
                  </tr>
                ) : (
                  degrees.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {item.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">
                        {degreeLevelLabel(item.level)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {departmentName(item.departmentId)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          title={`Edit ${item.name}`}
                          aria-label={`Edit ${item.name}`}
                          onClick={() => {
                            editable("degree", item.id);
                            setDegreeForm({
                              name: item.name,
                              level: item.level,
                              departmentId: item.departmentId,
                            });
                            setIsDegreeFormOpen(true);
                          }}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${item.name}`}
                          aria-label={`Delete ${item.name}`}
                          onClick={() =>
                            void deleteItem(
                              DELETE_DEGREE,
                              item.id,
                              "Degree program",
                            )
                          }
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                      setDegreeForm({ name: "", level: "bachelors", departmentId: "" });
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
                      onChange={(event) => setDegreeForm({ ...degreeForm, name: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Level
                    <select
                      required
                      value={degreeForm.level}
                      onChange={(event) => setDegreeForm({ ...degreeForm, level: event.target.value })}
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
                      onChange={(event) => setDegreeForm({ ...degreeForm, departmentId: event.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select department</option>
                      {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  {degreeFormError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{degreeFormError}</p>}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setDegreeForm({ name: "", level: "bachelors", departmentId: "" });
                        setIsDegreeFormOpen(false);
                        setDegreeFormError(null);
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
                      {editing?.type === "degree" ? "Save changes" : "Create degree program"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}
      {tab === "clusters" && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-0 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">Clusters</h2>
              <p className="text-sm text-slate-500">Manage research clusters</p>
            </div>
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
              Create cluster
            </button>
          </div>
          <div className="overflow-x-auto pt-6">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clusters.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No clusters found.
                    </td>
                  </tr>
                ) : (
                  sortedClusters.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {item.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {departmentName(item.departmentId)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          title={`Edit ${item.name}`}
                          aria-label={`Edit ${item.name}`}
                          onClick={() => {
                            editable("cluster", item.id);
                            setClusterForm({
                              name: item.name,
                              departmentId: item.departmentId,
                            });
                            setIsClusterFormOpen(true);
                          }}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${item.name}`}
                          aria-label={`Delete ${item.name}`}
                          onClick={() =>
                            void deleteItem(DELETE_CLUSTER, item.id, "Cluster")
                          }
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                  {clusterFormError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{clusterFormError}</p>}
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
        </section>
      )}
      {tab === "lifecycle" && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2" role="tablist" aria-label="Degree level">
            <span className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Degree level</span>
            {DEGREE_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                role="tab"
                aria-selected={lifecycleLevel === level.value}
                onClick={() => {
                  setLifecycleLevel(level.value);
                  setError(null);
                  setMessage(null);
                  if (lifecycleSection === "defenses") showDefenses(level.value, defenseKind);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${lifecycleLevel === level.value ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
              >
                {level.label}
                {awaitingAssignment(level.value) > 0 && (
                  <span
                    title={`${awaitingAssignment(level.value)} submitted proposal(s) waiting for a supervisor`}
                    className={`ml-2 rounded-full px-1.5 text-xs ${lifecycleLevel === level.value ? "bg-white/25 text-white" : "bg-amber-100 text-amber-800"}`}
                  >
                    {awaitingAssignment(level.value)}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-4 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Research lifecycle">
            {([
              ["timeline", "Research timeline"],
              ["proposals", "Proposal assignment"],
              ["defenses", "Defenses"],
            ] as [LifecycleSection, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={lifecycleSection === value}
                onClick={() => {
                  setLifecycleSection(value);
                  setError(null);
                  setMessage(null);
                  if (value === "defenses") showDefenses(lifecycleLevel, defenseKind);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${lifecycleSection === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {lifecycleSection === "timeline" && (
            <>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-0 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">{degreeLevelLabel(lifecycleLevel)} research timeline</h2>
              <p className="text-sm text-slate-500">
                Schedule the proposal, progress report and final defense phases. The students and professors involved are notified automatically. Phases can be deleted once they've ended.
              </p>
            </div>
            <button type="button" onClick={() => openNewPhaseForm(lifecycleLevel)} className={buttonClass}>
              <Plus size={16} aria-hidden="true" />
              Add research phase
            </button>
          </div>
          {levelPhases.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center">
              <p className="text-sm font-medium text-slate-700">No {degreeLevelLabel(lifecycleLevel)} research phases scheduled yet</p>
              <p className="mt-1 text-sm text-slate-500">Start with a proposal phase, then add a progress report phase for each review round and a final defense.</p>
            </div>
          ) : (
            <div className="mt-4">
              {[lifecycleLevel].map((levelValue) => (
                <div key={levelValue} className="rounded-xl border border-slate-200 p-4">
                  <ol className="space-y-4 border-l-2 border-slate-200 pl-5">
                    {levelPhases
                      .map((phase) => {
                        const status = phaseStatus(phase);
                        return (
                          <li key={phase.id} className="relative">
                            <span className="absolute -left-[33px] top-0 flex size-6 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[11px] font-semibold text-white">
                              {phase.sequenceNumber}
                            </span>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-slate-800">{phase.label}</p>
                                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{phaseTypeLabel(phase.phaseType)}</span>
                                  <span className={`rounded-full px-2 py-0.5 font-medium ${status.className}`}>{status.label}</span>
                                </p>
                                <p className="mt-1.5 text-xs text-slate-500">
                                  {phase.phaseType === "defense"
                                    ? `Defense day: ${phase.defenseDate ? new Date(phase.defenseDate).toLocaleDateString(undefined, { dateStyle: "medium" }) : "not set"}`
                                    : `${phase.opensAt ? formatPhaseDateTime(phase.opensAt) : "?"} → deadline ${phase.deadlineAt ? formatPhaseDateTime(phase.deadlineAt) : "?"}`}
                                </p>
                              </div>
                              <span className="flex shrink-0">
                                <button
                                  type="button"
                                  title={`Edit ${phase.label}`}
                                  aria-label={`Edit ${phase.label}`}
                                  onClick={() => openEditPhaseForm(phase)}
                                  className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <Pencil size={17} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  disabled={!phase.hasEnded}
                                  title={phase.hasEnded ? `Delete ${phase.label}` : phase.phaseType === "defense" ? "Can be deleted after the defense day" : "Can be deleted after the deadline"}
                                  aria-label={`Delete ${phase.label}`}
                                  onClick={() => void deletePhase(phase)}
                                  className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                                >
                                  <Trash2 size={17} aria-hidden="true" />
                                </button>
                              </span>
                            </div>
                          </li>
                        );
                      })}
                  </ol>
                </div>
              ))}
            </div>
          )}
            </>
          )}
          {lifecycleSection === "proposals" && (
            <>
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-0 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">{degreeLevelLabel(lifecycleLevel)} proposal assignment</h2>
              <p className="text-sm text-slate-500">Assign submitted {degreeLevelLabel(lifecycleLevel)} proposals to a supervising professor and, optionally, a cluster.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAssignmentForm({ proposalId: "", supervisorId: "", clusterId: "" });
                setEditingProposalId(null);
                setIsProposalFormOpen(true);
                setProposalFormError(null);
              }}
              className={buttonClass}
            >
              <Plus size={16} aria-hidden="true" />
              Assign proposal
            </button>
          </div>
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
                    <h2 id="proposal-form-title" className="text-xl font-semibold text-slate-900">
                      {editingProposalId ? "Edit proposal assignment" : "Assign student proposal"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose a professor, optionally place the proposal in a cluster, and manage its group members.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close proposal assignment form"
                    title="Close proposal assignment form"
                    onClick={() => { setIsProposalFormOpen(false); setGroupStudentId(""); setProposalFormError(null); }}
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
                              (student) => student.id === proposal.submittedBy,
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
                        const load = professorLoad(item.id, selectedProposal?.id ?? undefined);
                        const blocked = item.id === assignmentForm.supervisorId ? null : supervisionBlock(item.id, selectedProposal);
                        return (
                          <option key={item.id} value={item.id} disabled={Boolean(blocked)}>
                            {item.name} ({load}{capacity !== null ? `/${capacity}` : ""} students){blocked ? ` — ${blocked}` : ""}
                          </option>
                        );
                      })}
                    </select>
                    {selectedProposalLevel && (
                      <span className="text-xs font-normal text-slate-500">
                        {selectedProposalLevel === "bachelors"
                          ? "A professor can supervise one Bachelor's group at a time."
                          : `A professor can supervise up to ${selectedProposalLevel === "masters" ? SUPERVISION_LIMITS.mastersStudents : SUPERVISION_LIMITS.phdStudents} ${degreeLevelLabel(selectedProposalLevel)} students`}
                        {` and ${SUPERVISION_LIMITS.totalStudents} students overall.`}
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
                  {selectedProposal && selectedProposal.degreeLevel !== "bachelors" && (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      {degreeLevelLabel(selectedProposal.degreeLevel ?? "")} proposals are individual work, so there are no group members to manage.
                    </p>
                  )}
                  {selectedProposal && selectedProposal.degreeLevel === "bachelors" && (
                    <div className="grid gap-1.5 text-sm font-medium text-slate-700">
                      Group members{" "}
                      <span className="font-normal text-slate-500">
                        ({selectedProposal.groupMembers.length + 1}/3 students)
                      </span>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-normal text-slate-700">
                        <p className="font-medium">{selectedProposal.submittedByName ?? "Proposal owner"} (owner)</p>
                        {selectedProposal.groupMembers.map((member) => (
                          <div key={member.id} className="mt-2 flex items-center justify-between">
                            <span>{member.name}</span>
                            <button
                              type="button"
                              onClick={() => void adjustProposalMember(selectedProposal, member.id, false)}
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
                          onChange={(event) => setGroupStudentId(event.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Select department student</option>
                          {students
                            .filter(
                              (student) =>
                                student.id !== selectedProposal.submittedBy &&
                                !selectedProposal.groupMembers.some((member) => member.id === student.id) &&
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
                          disabled={!groupStudentId || selectedProposal.groupMembers.length >= 2}
                          onClick={() => void adjustProposalMember(selectedProposal, groupStudentId, true)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                  {proposalFormError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{proposalFormError}</p>}
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
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Proposal</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3">Assigned professor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {levelProposals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No {degreeLevelLabel(lifecycleLevel)} proposals found.
                    </td>
                  </tr>
                ) : (
                  levelProposals.map((proposal) => (
                    <tr key={proposal.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{proposal.title}</td>
                      <td className="px-4 py-3 text-slate-600">{proposal.submittedByName ?? "Unknown student"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {proposal.degreeLevel === "bachelors" ? (
                          <>
                            {proposal.groupMembers.length + 1}/3
                            {proposal.groupMembers.length > 0 && ` · ${proposal.groupMembers.map((member) => member.name).join(", ")}`}
                          </>
                        ) : (
                          "Individual"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{proposal.supervisorName ?? "Unassigned"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[proposal.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {formatStatus(proposal.status)}
                        </span>
                        {proposal.deletedAt && (
                          <span className="ml-1 inline-block rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">Deleted</span>
                        )}
                        {proposal.reviewComment && (
                          <p className="mt-1 max-w-[16rem] text-xs text-slate-500">
                            {proposal.reviewedByName ? `${proposal.reviewedByName}: ` : ""}"{proposal.reviewComment}"
                          </p>
                        )}
                        {proposal.deletedAt && (
                          <p className="mt-1 max-w-[16rem] text-xs text-slate-400">
                            Deleted by {proposal.deletedByName ?? "an admin"} on {new Date(proposal.deletedAt).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {proposal.originalFilename && (
                          <>
                            <button
                              type="button"
                              title="View proposal document"
                              aria-label={`View document for ${proposal.title}`}
                              onClick={() => void viewProposalFile(proposal.id).catch((viewError: unknown) => setError(viewError instanceof Error ? viewError.message : "Unable to open the document."))}
                              className="mr-1 inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Eye size={17} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              title="Download proposal document"
                              aria-label={`Download document for ${proposal.title}`}
                              onClick={() => void downloadProposalFile(proposal.id, proposal.originalFilename ?? "proposal.pdf").catch((downloadError: unknown) => setError(downloadError instanceof Error ? downloadError.message : "Unable to download the document."))}
                              className="mr-1 inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Download size={17} aria-hidden="true" />
                            </button>
                          </>
                        )}
                        {!proposal.deletedAt && (
                          <button
                            type="button"
                            title={`Edit assignment for ${proposal.title}`}
                            aria-label={`Edit assignment for ${proposal.title}`}
                            onClick={() => {
                              setEditingProposalId(proposal.id);
                              setAssignmentForm({
                                proposalId: proposal.id,
                                supervisorId: proposal.supervisorId ?? "",
                                clusterId: proposal.clusterId ?? "",
                              });
                              setIsProposalFormOpen(true);
                              setProposalFormError(null);
                            }}
                            className="mr-1 inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Pencil size={17} aria-hidden="true" />
                          </button>
                        )}
                        {proposal.status === "rejected" && !proposal.deletedAt && (
                          <button
                            type="button"
                            title={`Delete rejected proposal "${proposal.title}"`}
                            aria-label={`Delete rejected proposal "${proposal.title}"`}
                            onClick={() => {
                              if (window.confirm(`Delete rejected proposal "${proposal.title}"? It will remain visible in history for the student and professor.`)) {
                                void deleteItem(DELETE_PROPOSAL_AS_ADMIN, proposal.id, "Proposal");
                              }
                            }}
                            className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
            </>
          )}
          {lifecycleSection === "defenses" && (
            <>
              <div className="border-b border-slate-200 px-0 py-4">
                <h2 className="text-lg font-medium text-slate-800">{degreeLevelLabel(lifecycleLevel)} defenses</h2>
                <p className="text-sm text-slate-500">
                  Every proposal, progress report and approved final report can be defended. Plan when and where, choose the panel, and the students, supervisor and panel are notified.
                </p>
              </div>
              <div className="mt-4 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Report type">
                {DEFENSE_KINDS.map((kind) => (
                  <button
                    key={kind.value}
                    type="button"
                    role="tab"
                    aria-selected={defenseKind === kind.value}
                    onClick={() => showDefenses(lifecycleLevel, kind.value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${defenseKind === kind.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    {kind.label}
                    <span className="ml-1 text-xs text-slate-400">{levelDefenses.filter((defense) => defense.kind === kind.value && defense.currentStatus !== "rejected").length}</span>
                  </button>
                ))}
              </div>
              {defenseError && !planTarget && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{defenseError}</p>}

              <h3 className="mt-6 text-sm font-semibold text-slate-800">{defenseReportLabel(defenseKind)}s to defend</h3>
              <div className="mt-2 rounded-xl border border-slate-200">
                {isLoadingCandidates ? (
                  <p className="p-4 text-sm text-slate-500">Loading...</p>
                ) : defenseCandidates.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">
                    {defenseKind === "defense"
                      ? `No ${degreeLevelLabel(lifecycleLevel)} paper has an approved final report yet.`
                      : `No ${degreeLevelLabel(lifecycleLevel)} ${defenseReportLabel(defenseKind).toLowerCase()} has been submitted yet.`}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {defenseCandidates.map((candidate) => (
                      <li key={candidate.targetId} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{candidate.title}</p>
                          <p className="text-xs text-slate-500">
                            {defenseReportLabel(candidate.kind)}{candidate.phaseLabel ? ` · ${candidate.phaseLabel}` : ""} · {candidate.studentNames.join(", ") || "No students"} · Supervisor: {candidate.supervisorName ?? "not assigned"} · <span className="capitalize">{formatStatus(candidate.status)}</span>
                          </p>
                          <p className={`mt-1 text-xs font-medium ${candidate.defense ? "text-emerald-700" : "text-slate-400"}`}>
                            {candidate.defense
                              ? `Defense: ${describeDefenseSlot(candidate.defense)} · Panel: ${candidate.defense.panelNames.join(", ") || "none"}`
                              : "No defense planned"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openPlanForm({ kind: candidate.kind, targetId: candidate.targetId, title: candidate.title, phaseId: candidate.phaseId, suggestedDate: candidate.suggestedDate, supervisorName: candidate.supervisorName, existing: candidate.defense })}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          {candidate.defense ? "Reschedule" : "Plan defense"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <h3 className="mt-8 text-sm font-semibold text-slate-800">Planned {degreeLevelLabel(lifecycleLevel)} {defenseKindLabel(defenseKind).toLowerCase()}s</h3>
              <div className="overflow-x-auto pt-2">
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Report</th>
                      <th className="px-4 py-3">Students</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Panel</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kindDefenses.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nothing planned yet.</td>
                      </tr>
                    ) : (
                      kindDefenses.map((defense) => {
                        const targetId = defense.proposalId ?? defense.progressReportId ?? defense.paperId;
                        return (
                          <tr key={defense.id} className="border-b border-slate-100 align-top">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{defense.paperTitle ?? "Untitled research"}</p>
                              <p className="text-xs text-slate-500">{defenseReportLabel(defense.kind)}{defense.phaseLabel ? ` · ${defense.phaseLabel}` : ""}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{defense.studentNames.join(", ") || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-800">{new Date(defense.defenseDate).toLocaleDateString(undefined, { weekday: "short", dateStyle: "medium" })}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-800">{defense.scheduledTime?.slice(0, 5) ?? "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{defense.location ?? "Not set"}</td>
                            <td className="px-4 py-3 text-slate-600">{defense.panelNames.join(", ") || "No panel yet"}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[defense.currentStatus] ?? "bg-slate-100 text-slate-600"}`}>{formatStatus(defense.currentStatus)}</span>
                              {defense.kind === "defense" && <p className="mt-1 text-xs text-slate-500">{defense.submissionConfirmed ? "Thesis submitted" : "Awaiting thesis"}</p>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {targetId && defense.currentStatus === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => openPlanForm({ kind: defense.kind, targetId, title: defense.paperTitle ?? "this report", phaseId: defense.phaseId, suggestedDate: null, supervisorName: defense.supervisorName, existing: defense })}
                                  className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
      {planTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div role="dialog" aria-modal="true" className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{planTarget.existing ? "Reschedule defense" : "Plan defense"}</h2>
                <p className="mt-1 text-sm text-slate-500">{defenseKindLabel(planTarget.kind)} · {planTarget.title}</p>
              </div>
              <button type="button" aria-label="Close defense form" onClick={() => setPlanTarget(null)} className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={savePlan} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Date
                  <input required type="date" value={planForm.date} onChange={(event) => setPlanForm({ ...planForm, date: event.target.value })} className={inputClass} />
                  {planTarget.suggestedDate && !planTarget.existing && (
                    <span className="mt-1 block text-xs font-normal text-slate-500">Pre-filled with the final defense day from the timeline.</span>
                  )}
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Time
                  <input required type="time" value={planForm.time} onChange={(event) => setPlanForm({ ...planForm, time: event.target.value })} className={inputClass} />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Location
                <input required value={planForm.location} onChange={(event) => setPlanForm({ ...planForm, location: event.target.value })} placeholder="e.g. Seminar hall, Block B" className={inputClass} />
              </label>
              <fieldset>
                <legend className="text-sm font-medium text-slate-700">
                  Defense panel <span className="font-normal text-slate-500">({planForm.panelIds.length} selected)</span>
                </legend>
                {panelChoices.length === 0 ? (
                  <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    No professor has a professor profile yet. Create one under Users → Professors → Profiles to add them to panels.
                  </p>
                ) : (
                  <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                    {panelChoices.map((professor) => (
                      <label key={professor.userId} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                        <input type="checkbox" checked={planForm.panelIds.includes(professor.userId)} onChange={() => togglePanelMember(professor.userId)} />
                        <span>
                          {professor.userName}
                          {professor.userName === planTarget.supervisorName && <span className="ml-1 text-xs text-slate-400">(supervisor)</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {professors.length > panelChoices.length && panelChoices.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    {professors.length - panelChoices.length} professor{professors.length - panelChoices.length === 1 ? " isn't" : "s aren't"} listed because they have no professor profile.
                  </p>
                )}
              </fieldset>
              {defenseError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{defenseError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setPlanTarget(null)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={isSavingPlan} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {isSavingPlan ? "Saving..." : planTarget.existing ? "Reschedule and notify" : "Plan and notify"}
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
                <h2 className="text-xl font-semibold text-slate-900">{editingPhaseId ? "Edit research phase" : "Add research phase"}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingPhaseId
                    ? "Students and professors involved will be told that the schedule changed."
                    : "Students at this degree level and the professors involved will be notified."}
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
                <legend className="text-sm font-medium text-slate-700">Research stage</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {PHASE_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium has-disabled:cursor-not-allowed ${phaseForm.phaseType === type.value ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                    >
                      <input
                        type="radio"
                        name="phaseType"
                        value={type.value}
                        checked={phaseForm.phaseType === type.value}
                        onChange={() => changePhaseKind({ phaseType: type.value })}
                        className="sr-only"
                      />
                      {type.label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">{PHASE_TYPES.find((type) => type.value === phaseForm.phaseType)?.hint}</p>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <label className="block text-sm font-medium text-slate-700">
                  Degree level
                  <select
                    value={phaseForm.degreeLevel}
                    disabled={Boolean(editingPhaseId)}
                    onChange={(event) => changePhaseKind({ degreeLevel: event.target.value })}
                    className={`${inputClass} disabled:bg-slate-100`}
                  >
                    {DEGREE_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Step no.
                  <input
                    required
                    type="number"
                    min="1"
                    value={phaseForm.sequenceNumber}
                    onChange={(event) => setPhaseForm({ ...phaseForm, sequenceNumber: event.target.value })}
                    className={inputClass}
                  />
                </label>
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
                    onChange={(event) => setPhaseForm({ ...phaseForm, defenseDate: event.target.value })}
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
                        onChange={(event) => setPhaseForm({ ...phaseForm, opensAt: event.target.value })}
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
                        onChange={(event) => setPhaseForm({ ...phaseForm, deadlineAt: event.target.value })}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={phaseForm.gracePeriodEnabled}
                      onChange={(event) => setPhaseForm({ ...phaseForm, gracePeriodEnabled: event.target.checked })}
                      className="mt-0.5"
                    />
                    <span>
                      Allow late submissions
                      <span className="block text-xs text-slate-500">Students can still submit after the deadline.</span>
                    </span>
                  </label>
                </>
              )}
              {phaseFormError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{phaseFormError}</p>}
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
                  {isSavingPhase ? "Saving..." : editingPhaseId ? "Save and notify" : "Add and notify"}
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
              {departmentFormError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{departmentFormError}</p>}
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
    </div>
  );
}
export default AdminManagement;
