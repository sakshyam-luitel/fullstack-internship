import { CalendarClock } from "lucide-react";

export interface PlannedDefense {
  id: string;
  kind: string;
  defenseDate: string;
  scheduledTime: string | null;
  location: string | null;
  currentStatus: string;
  panelNames: string[];
}

const KIND_LABELS: Record<string, string> = {
  proposal: "Proposal defense",
  progress_report: "Progress defense",
  defense: "Final defense",
};

// The defense the department planned for one submission: date, slot, panel and outcome.
function DefenseNotice({ defense }: { defense: PlannedDefense }) {
  const outcome = defense.currentStatus === "accepted" ? "Passed" : defense.currentStatus === "rejected" ? "Not passed" : null;
  return (
    <p className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${outcome === "Not passed" ? "bg-red-50 text-red-800" : "bg-indigo-50 text-indigo-900"}`}>
      <CalendarClock size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>
        <span className="font-semibold">{KIND_LABELS[defense.kind] ?? "Defense"}:</span>{" "}
        {new Date(defense.defenseDate).toLocaleDateString(undefined, { weekday: "short", dateStyle: "medium" })}
        {defense.scheduledTime ? ` at ${defense.scheduledTime.slice(0, 5)}` : ""}
        {defense.location ? ` · ${defense.location}` : ""}
        {defense.panelNames.length > 0 ? ` · Panel: ${defense.panelNames.join(", ")}` : ""}
        {outcome ? ` · ${outcome}` : ""}
      </span>
    </p>
  );
}

export default DefenseNotice;
