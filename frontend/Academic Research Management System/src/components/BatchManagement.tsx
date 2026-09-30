import { useEffect, useState } from "react";
import { Archive, Plus } from "lucide-react";
import { print } from "graphql";
import { BATCHES_QUERY } from "../queries/queries";
import { RESET_TO_NEW_BATCH } from "../mutations/mutations";
import { useToast } from "../hooks/useToast";
import {
  errorMessage,
  formatDate,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../utils/format";
import {
  Card,
  EmptyState,
  FormError,
  Modal,
  SectionHeader,
  StatusBadge,
} from "./ui";

interface Batch {
  id: string;
  label: string;
  status: string;
  startedAt: string;
  archivedAt: string | null;
  archivedByName: string | null;
  studentCount: number;
  phaseCount: number;
}

async function request<T>(
  document: typeof BATCHES_QUERY,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(import.meta.env.VITE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}`,
    },
    body: JSON.stringify({ query: print(document), variables }),
  });
  const result = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (!response.ok || result.errors?.length)
    throw new Error(result.errors?.[0]?.message ?? "Request failed.");
  if (!result.data) throw new Error("The server returned no data.");
  return result.data;
}

// The cohorts going through the pipeline. One is active for the whole system; starting
// the next one archives it (nothing is deleted) for every department at once.
function BatchManagement() {
  const toast = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [force, setForce] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    try {
      const result = await request<{ batches: Batch[] }>(BATCHES_QUERY);
      setBatches(result.batches);
      setLoadError(null);
    } catch (requestError) {
      setLoadError(errorMessage(requestError, "Unable to load batches."));
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await load();
    };
    void initialize();
  }, []);

  const active = batches.find((batch) => batch.status === "active") ?? null;
  const archived = batches.filter((batch) => batch.status !== "active");

  const openForm = () => {
    setLabel("");
    setForce(false);
    setConfirmed(false);
    setFormError(null);
    setIsFormOpen(true);
  };

  const startBatch = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      const result = await request<{ resetToNewBatch: { label: string } }>(
        RESET_TO_NEW_BATCH,
        {
          adminInput: { newBatchLabel: label.trim(), force },
        },
      );
      setIsFormOpen(false);
      toast.success(
        active
          ? `${active.label} was archived and ${result.resetToNewBatch.label} is now the active batch.`
          : `${result.resetToNewBatch.label} is now the active batch.`,
      );
      await load();
    } catch (requestError) {
      // The backend names the phases still open, which is exactly what the admin needs to see.
      setFormError(errorMessage(requestError, "Unable to start a new batch."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Batches"
        description="A batch is one cohort's run through the research pipeline. Exactly one batch is active for the whole system; new students and research phases join it automatically."
        action={
          <button
            type="button"
            onClick={openForm}
            className={primaryButtonClass}
          >
            <Plus size={16} aria-hidden="true" />{" "}
            {active ? "Start new batch" : "Start first batch"}
          </button>
        }
      />
      {loadError && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {!isLoaded ? (
        <p className="text-sm text-slate-500">Loading batches...</p>
      ) : active ? (
        <Card className="border-blue-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Active batch
              </p>
              <h3 className="mt-0.5 text-lg font-semibold text-slate-900">
                {active.label}
              </h3>
              <p className="text-sm text-slate-500">
                Started {formatDate(active.startedAt)}
              </p>
            </div>
            <StatusBadge status="open" label="Active" />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Students</dt>
              <dd className="text-xl font-semibold text-slate-900">
                {active.studentCount}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Research phases</dt>
              <dd className="text-xl font-semibold text-slate-900">
                {active.phaseCount}
              </dd>
            </div>
          </dl>
        </Card>
      ) : (
        <EmptyState title="No batch has been started yet">
          Start the first batch so new students and research phases have a
          cohort to belong to.
        </EmptyState>
      )}

      {archived.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-900">
            Archived batches
          </h3>
          <p className="text-sm text-slate-500">
            Kept in full: their students, phases, submissions and defenses are
            still on record.
          </p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
            {archived.map((batch) => (
              <li
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="flex min-w-0 items-start gap-3">
                  <Archive
                    size={18}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-slate-400"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-800">
                      {batch.label}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {formatDate(batch.startedAt)} →{" "}
                      {batch.archivedAt ? formatDate(batch.archivedAt) : "—"}
                      {batch.archivedByName
                        ? ` · archived by ${batch.archivedByName}`
                        : ""}
                    </span>
                  </span>
                </span>
                <span className="text-xs text-slate-500">
                  {batch.studentCount} student
                  {batch.studentCount === 1 ? "" : "s"} · {batch.phaseCount}{" "}
                  phase
                  {batch.phaseCount === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isFormOpen && (
        <Modal
          title={active ? "Start a new batch" : "Start the first batch"}
          subtitle={
            active
              ? `This archives ${active.label} for every department.`
              : undefined
          }
          onClose={() => setIsFormOpen(false)}
        >
          <form onSubmit={startBatch} className="mt-4 space-y-4">
            {active && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">What happens</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>
                    {active.label} is archived for all departments, not just
                    one.
                  </li>
                  <li>
                    Nothing is deleted. Its students, phases, submissions and
                    defenses stay on record.
                  </li>
                  <li>
                    New students and research phases join the new batch, whose
                    timeline starts again at step 1.
                  </li>
                </ul>
              </div>
            )}
            <label className="block text-sm font-medium text-slate-700">
              Name of the new batch
              <input
                required
                autoFocus
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Batch 2027"
                className={inputClass}
              />
            </label>
            {active && (
              <>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(event) => setForce(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Start it even if some phases are still open
                    <span className="block text-xs text-slate-500">
                      Normally every phase of {active.label} has to be closed
                      first. Forcing it stops students who are still mid-phase.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    required
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5"
                  />
                  I understand this archives {active.label} for every
                  department.
                </label>
              </>
            )}
            <FormError message={formError} />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSaving || !label.trim() || (Boolean(active) && !confirmed)
                }
                className={primaryButtonClass}
              >
                {isSaving
                  ? "Starting..."
                  : active
                    ? "Archive and start new batch"
                    : "Start batch"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default BatchManagement;
