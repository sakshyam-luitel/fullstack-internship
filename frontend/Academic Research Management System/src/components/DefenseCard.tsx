import { CalendarDays, Clock, Download, Eye, MapPin, MessageSquareText, RotateCcw } from "lucide-react";
import { downloadDocumentFile, viewDocumentFile, type DocumentKind } from "../utils/proposalFile";
import { DEFENSE_TONE_LABELS, DEFENSE_TONE_STYLES, defenseTone, formatDefenseDate, reportLabel } from "../utils/defenses";

export interface DefenseDetails {
  id: string;
  kind: string;
  paperTitle: string | null;
  phaseLabel: string | null;
  defenseDate: string;
  scheduledTime: string | null;
  location: string | null;
  currentStatus: string;
  submissionConfirmed: boolean;
  degreeLevel: string | null;
  studentNames: string[];
  supervisorName: string | null;
  panelNames: string[];
  reportDocumentKind: string | null;
  reportDocumentId: string | null;
  reportFilename: string | null;
  originalFilename: string | null;
  outcomeComments: string | null;
  outcomeRecordedAt: string | null;
  outcomeRecordedByName: string | null;
  requiresRedefense: boolean;
  hasEnded: boolean;
}

interface DefenseCardProps {
  defense: DefenseDetails;
  // Professors see who they are assessing; students already know.
  showPeople?: boolean;
  onError: (message: string) => void;
}

// When and where a defense happens, which report it defends, and who is on the panel.
function DefenseCard({ defense, showPeople = false, onError }: DefenseCardProps) {
  const tone = defenseTone(defense);
  const style = DEFENSE_TONE_STYLES[tone];
  const open = (kind: DocumentKind, id: string) =>
    void viewDocumentFile(kind, id).catch((error: unknown) => onError(error instanceof Error ? error.message : "Unable to open the document."));
  const download = (kind: DocumentKind, id: string, name: string) =>
    void downloadDocumentFile(kind, id, name).catch((error: unknown) => onError(error instanceof Error ? error.message : "Unable to download the document."));

  return (
    <article className={`rounded-xl border p-4 ${style.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            {reportLabel(defense.kind)} defense{defense.phaseLabel ? ` · ${defense.phaseLabel}` : ""}
          </p>
          <h3 className="mt-0.5 font-medium text-slate-900">{defense.paperTitle ?? "Untitled research"}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}>{DEFENSE_TONE_LABELS[tone]}</span>
      </div>
      <dl className="mt-3 grid gap-3 rounded-lg bg-slate-50/80 p-3 text-sm sm:grid-cols-3">
        <div className="flex items-start gap-2">
          <CalendarDays size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">Date</dt>
            <dd className="font-medium text-slate-800">{formatDefenseDate(defense.defenseDate)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">Time</dt>
            <dd className="font-medium text-slate-800">{defense.scheduledTime?.slice(0, 5) ?? "To be announced"}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">Location</dt>
            <dd className="font-medium text-slate-800">{defense.location ?? "To be announced"}</dd>
          </div>
        </div>
      </dl>
      <div className="mt-3 space-y-1 text-xs text-slate-600">
        {showPeople && <p><span className="text-slate-400">Students:</span> {defense.studentNames.join(", ") || "—"} · <span className="text-slate-400">Supervisor:</span> {defense.supervisorName ?? "not assigned"}</p>}
        <p><span className="text-slate-400">Panel:</span> {defense.panelNames.join(", ") || "Not announced yet"}</p>
      </div>
      {defense.requiresRedefense && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          <RotateCcw size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>This {reportLabel(defense.kind).toLowerCase()} has to be defended again. The department will announce the new date.</span>
        </p>
      )}
      {defense.outcomeComments && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${style.notice}`}>
          <p className="flex items-center gap-1.5 font-semibold">
            <MessageSquareText size={14} aria-hidden="true" /> Panel feedback
          </p>
          <p className="mt-1 whitespace-pre-line">{defense.outcomeComments}</p>
          {defense.outcomeRecordedByName && (
            <p className="mt-1 opacity-70">
              Recorded by {defense.outcomeRecordedByName}
              {defense.outcomeRecordedAt ? ` on ${formatDefenseDate(defense.outcomeRecordedAt)}` : ""}
            </p>
          )}
        </div>
      )}
      {(defense.reportFilename || (defense.kind === "defense" && defense.originalFilename)) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          {defense.reportFilename && defense.reportDocumentKind && defense.reportDocumentId && (
            <>
              <button type="button" onClick={() => open(defense.reportDocumentKind as DocumentKind, defense.reportDocumentId!)} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
                <Eye size={14} aria-hidden="true" /> View {reportLabel(defense.kind).toLowerCase()}
              </button>
              <button type="button" onClick={() => download(defense.reportDocumentKind as DocumentKind, defense.reportDocumentId!, defense.reportFilename!)} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                <Download size={14} aria-hidden="true" /> Download
              </button>
            </>
          )}
          {defense.kind === "defense" && defense.originalFilename && (
            <button type="button" onClick={() => open("defenses", defense.id)} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
              <Eye size={14} aria-hidden="true" /> View final thesis
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default DefenseCard;
