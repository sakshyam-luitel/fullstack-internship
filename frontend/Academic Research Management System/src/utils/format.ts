// Formatting shared by every dashboard, so a status or a date reads the same everywhere.

export const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  accepted: "bg-emerald-50 text-emerald-700",
  open: "bg-emerald-50 text-emerald-700",
  submitted: "bg-blue-50 text-blue-700",
  assigned: "bg-indigo-50 text-indigo-700",
  rejected: "bg-red-50 text-red-700",
  changes_requested: "bg-amber-50 text-amber-700",
  awaiting_thesis: "bg-amber-50 text-amber-700",
  draft: "bg-slate-100 text-slate-700",
  deleted: "bg-slate-200 text-slate-600",
};

export const formatStatus = (status: string) => status.replace(/_/g, " ");

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export const smallPrimaryButtonClass =
  "inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

export const smallSecondaryButtonClass =
  "inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export const DEGREE_LEVEL_LABELS: Record<string, string> = {
  bachelors: "Bachelor's",
  masters: "Master's",
  phd: "PhD",
};

export const degreeLevelLabel = (level: string | null | undefined) =>
  (level && DEGREE_LEVEL_LABELS[level]) ?? "Level not set";
