export interface Department {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}

export interface DegreeProgram {
  id: string;
  name: string;
  level: string;
  departmentId: string;
}

export interface Cluster {
  id: string;
  name: string;
  departmentId: string;
}

export interface User {
  id: string;
  name: string;
  role: string;
  degreeProgramId: string | null;
}

export interface Proposal {
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

export interface Profile {
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

export interface ScheduledDefense {
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

export type DefenseKind = "proposal" | "progress_report" | "defense";

export interface DefenseCandidate {
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

export interface PlanTarget {
  kind: string;
  targetId: string;
  title: string;
  phaseId: string | null;
  suggestedDate: string | null;
  supervisorName: string | null;
  existing: ScheduledDefense | null;
}

export interface ResearchPhase {
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
  status: string;
  closedAt: string | null;
}

export interface PhaseOption {
  phaseType: string;
  allowed: boolean;
  reason: string | null;
  sequenceNumber: number;
}

export interface Batch {
  id: string;
  label: string;
  status: string;
  startedAt: string;
}

export interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

export type AdminRole = "admin" | "super_admin";
export type DegreeLevel = "bachelors" | "masters" | "phd";

export type AdminView =
  | "overview"
  | "timeline"
  | "proposals"
  | "defenses"
  | "setup"
  | "departments";

export interface AdminBadges {
  proposals: number;
  defenses: number;
  proposalsByLevel: Record<DegreeLevel, number>;
  defensesByLevel: Record<DegreeLevel, number>;
}

export interface AdminManagementProps {
  role: AdminRole;
  view: AdminView;
  level: DegreeLevel;
  onNavigate: (section: AdminView | "people", level?: DegreeLevel) => void;
  onBadgesChange?: (badges: AdminBadges) => void;
  refreshKey?: number;
  departmentLabel?: string | null;
}
