import { CalendarClock } from "lucide-react";
import { DEFENSE_TONE_LABELS, DEFENSE_TONE_STYLES, defenseTone, formatDefenseDate } from "../utils/defenses";

export interface PlannedDefense {
  id: string;
  kind: string;
  defenseDate: string;
  scheduledTime: string | null;
  location: string | null;
  currentStatus: string;
  // Which round this defends — "Progress report 1", "Progress report 2", ...
  phaseLabel: string | null;
  panelNames: string[];
  outcomeComments: string | null;
  requiresRedefense: boolean;
  hasEnded: boolean;
}

const KIND_LABELS: Record<string, string> = {
  proposal: "Proposal defense",
  progress_report: "Progress defense",
  defense: "Final defense",
};

// The defense the department planned for one submission: date, slot, panel and outcome.
// Green once it is marked defended, red once it is marked not defended.
function DefenseNotice({ defense }: { defense: PlannedDefense }) {
  const tone = defenseTone(defense);
  const decided = tone === "defended" || tone === "not_defended";
  return (
    <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${DEFENSE_TONE_STYLES[tone].notice}`}>
      <p className="flex items-start gap-2">
        <CalendarClock size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          <span className="font-semibold">{KIND_LABELS[defense.kind] ?? "Defense"}{defense.phaseLabel ? ` · ${defense.phaseLabel}` : ""}:</span>{" "}
          {formatDefenseDate(defense.defenseDate)}
          {defense.scheduledTime ? ` at ${defense.scheduledTime.slice(0, 5)}` : ""}
          {defense.location ? ` · ${defense.location}` : ""}
          {defense.panelNames.length > 0 ? ` · Panel: ${defense.panelNames.join(", ")}` : ""}
          {decided ? <span className="font-semibold"> · {DEFENSE_TONE_LABELS[tone]}</span> : ""}
          {defense.requiresRedefense ? " · has to be defended again" : ""}
        </span>
      </p>
      {defense.outcomeComments && <p className="mt-1 whitespace-pre-line pl-6 opacity-90"><span className="font-semibold">Feedback:</span> {defense.outcomeComments}</p>}
    </div>
  );
}

export default DefenseNotice;
