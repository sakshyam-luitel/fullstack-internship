const REPORT_LABELS: Record<string, string> = { proposal: "Proposal", progress_report: "Progress report", defense: "Final report" };
const DAY_MS = 24 * 60 * 60 * 1000;

// Which report a defense is for: "proposal" | "progress_report" | "defense" (the final report).
export const reportLabel = (kind: string) => REPORT_LABELS[kind] ?? "Report";

// The defense day counts as past only once it has fully ended.
export const isPastDefense = (defense: { defenseDate: string }) => new Date(defense.defenseDate).getTime() + DAY_MS < Date.now();
