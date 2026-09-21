const REPORT_LABELS: Record<string, string> = {
  proposal: "Proposal",
  progress_report: "Progress report",
  defense: "Final report",
};
const DAY_MS = 24 * 60 * 60 * 1000;

// Which report a defense is for: "proposal" | "progress_report" | "defense" (the final report).
export const reportLabel = (kind: string) => REPORT_LABELS[kind] ?? "Report";

// e.g. "Thu, Sep 17, 2026". Built from individual fields: Intl rejects `dateStyle`
// combined with `weekday` ("Invalid option"), so the two can't be mixed.
export const formatDefenseDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// The defense day counts as past only once it has fully ended.
export const isPastDefense = (defense: { defenseDate: string }) =>
  new Date(defense.defenseDate).getTime() + DAY_MS < Date.now();

// The outcome an admin recorded after the defense day, or why there isn't one yet.
// Every role reads the same four states, so a defended report looks green and a
// failed one red in every dashboard.
export type DefenseTone = "defended" | "not_defended" | "awaiting" | "upcoming";

export interface DefenseOutcomeFields {
  currentStatus: string;
  defenseDate: string;
  // Sent by the backend; falls back to the same rule as isPastDefense for older payloads.
  hasEnded?: boolean;
}

export const defenseTone = (defense: DefenseOutcomeFields): DefenseTone => {
  if (defense.currentStatus === "accepted") return "defended";
  if (defense.currentStatus === "rejected") return "not_defended";
  return (defense.hasEnded ?? isPastDefense(defense)) ? "awaiting" : "upcoming";
};

export const DEFENSE_TONE_LABELS: Record<DefenseTone, string> = {
  defended: "Defended",
  not_defended: "Not defended",
  awaiting: "Awaiting outcome",
  upcoming: "Upcoming",
};

// Badge, card frame and inline-notice styles per outcome, so the row itself carries the verdict.
export const DEFENSE_TONE_STYLES: Record<
  DefenseTone,
  { badge: string; card: string; notice: string; row: string }
> = {
  defended: {
    badge: "bg-emerald-100 text-emerald-800",
    card: "border-emerald-300 bg-emerald-50",
    notice: "bg-emerald-50 text-emerald-900",
    row: "bg-emerald-50/70",
  },
  not_defended: {
    badge: "bg-red-100 text-red-800",
    card: "border-red-300 bg-red-50",
    notice: "bg-red-50 text-red-900",
    row: "bg-red-50/70",
  },
  awaiting: {
    badge: "bg-amber-100 text-amber-800",
    card: "border-slate-200 bg-white",
    notice: "bg-amber-50 text-amber-900",
    row: "bg-amber-50/40",
  },
  upcoming: {
    badge: "bg-blue-50 text-blue-700",
    card: "border-slate-200 bg-white",
    notice: "bg-indigo-50 text-indigo-900",
    row: "",
  },
};
