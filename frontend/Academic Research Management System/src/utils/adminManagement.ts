import type { ResearchPhase } from "../types/adminManagement";

export const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
export const buttonClass =
  "inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50";

export const PHASE_TYPES = [
  { value: "proposal", label: "Proposal", hint: "Students submit their research proposals between the opening time and the deadline." },
  { value: "progress_report", label: "Progress report", hint: "Add one progress report phase per review round. Each round has its own deadline." },
  { value: "defense", label: "Final defense", hint: "One shared defense day. Individual time slots are scheduled per paper below." },
] as const;

export const DEGREE_LEVELS = [
  { value: "bachelors", label: "Bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
] as const;

export const phaseTypeLabel = (phaseType: string) =>
  PHASE_TYPES.find((item) => item.value === phaseType)?.label ?? phaseType;

export const degreeLevelLabel = (level: string) =>
  DEGREE_LEVELS.find((item) => item.value === level)?.label ?? level;

export const emptyPhaseForm = {
  phaseType: "proposal",
  degreeLevel: "bachelors",
  label: "",
  opensAt: "",
  deadlineAt: "",
  defenseDate: "",
  gracePeriodEnabled: false,
};

const padTwo = (value: number) => String(value).padStart(2, "0");

export const toDateTimeInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}T${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
};

export const DEFENSE_KINDS = [
  { value: "proposal", label: "Proposal defenses" },
  { value: "progress_report", label: "Progress report defenses" },
  { value: "defense", label: "Final defenses" },
] as const;

export const defenseReportLabel = (kind: string) =>
  kind === "proposal" ? "Proposal" : kind === "progress_report" ? "Progress report" : "Final report";

export const defenseKindLabel = (kind: string) =>
  kind === "proposal" ? "Proposal defense" : kind === "progress_report" ? "Progress defense" : "Final defense";

export const describeDefenseSlot = (defense: {
  defenseDate: string;
  scheduledTime: string | null;
  location: string | null;
}) =>
  `${new Date(defense.defenseDate).toLocaleDateString(undefined, { dateStyle: "medium" })}${defense.scheduledTime ? ` at ${defense.scheduledTime.slice(0, 5)}` : ""}${defense.location ? ` · ${defense.location}` : ""}`;

export const formatPhaseDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function phaseStatus(phase: ResearchPhase): { label: string; className: string } {
  if (phase.status === "pending") return { label: "Not started", className: "bg-slate-100 text-slate-600" };
  if (phase.status === "closed") return { label: "Closed", className: "bg-slate-200 text-slate-700" };
  const now = Date.now();
  if (phase.phaseType === "defense") {
    if (!phase.defenseDate) return { label: "No date", className: "bg-slate-100 text-slate-600" };
    const endOfDefenseDay = new Date(phase.defenseDate);
    endOfDefenseDay.setHours(23, 59, 59, 999);
    return endOfDefenseDay.getTime() < now
      ? { label: "Open · day held", className: "bg-amber-50 text-amber-700" }
      : { label: "Open · scheduled", className: "bg-emerald-50 text-emerald-700" };
  }
  if (phase.opensAt && new Date(phase.opensAt).getTime() > now)
    return { label: "Open · not yet due", className: "bg-blue-50 text-blue-700" };
  if (phase.deadlineAt && new Date(phase.deadlineAt).getTime() < now)
    return phase.gracePeriodEnabled
      ? { label: "Past deadline · late allowed", className: "bg-amber-50 text-amber-700" }
      : { label: "Past deadline · no submissions", className: "bg-amber-50 text-amber-700" };
  return { label: "Open", className: "bg-emerald-50 text-emerald-700" };
}
