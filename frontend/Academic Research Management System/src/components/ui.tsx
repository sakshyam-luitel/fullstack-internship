import { useEffect } from "react";
import { Download, Eye, FileText, Info, X, type LucideIcon } from "lucide-react";
import { downloadDocumentFile, viewDocumentFile, type DocumentKind } from "../utils/proposalFile";
import { STATUS_STYLES, errorMessage, formatStatus } from "../utils/format";

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {label ?? formatStatus(status)}
    </span>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-full w-full ${wide ? "max-w-2xl" : "max-w-lg"} overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label={`Close ${title.toLowerCase()}`}
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
      {message}
    </p>
  );
}

// A page's title row: what this section is for, plus its main action.
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 max-w-3xl text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

// Why an action isn't available right now, written out instead of hidden in a tooltip.
export function BlockedReason({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// View and download buttons for an uploaded PDF. Both fetch with the auth header.
export function DocumentActions({
  kind,
  entityId,
  filename,
  fallbackName,
  onError,
  showName = true,
  viewLabel = "View",
}: {
  kind: DocumentKind;
  entityId: string;
  filename: string | null;
  fallbackName: string;
  onError: (message: string) => void;
  showName?: boolean;
  viewLabel?: string;
}) {
  if (!filename) return null;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-3 text-xs">
      {showName && (
        <span className="flex min-w-0 items-center gap-1 text-slate-600">
          <FileText size={14} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{filename}</span>
        </span>
      )}
      <button
        type="button"
        onClick={() =>
          void viewDocumentFile(kind, entityId).catch((error: unknown) =>
            onError(errorMessage(error, "Unable to open the document.")),
          )
        }
        className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
      >
        <Eye size={14} aria-hidden="true" /> {viewLabel}
      </button>
      <button
        type="button"
        onClick={() =>
          void downloadDocumentFile(kind, entityId, filename ?? fallbackName).catch((error: unknown) =>
            onError(errorMessage(error, "Unable to download the document.")),
          )
        }
        className="inline-flex items-center gap-1 text-blue-700 hover:underline"
      >
        <Download size={14} aria-hidden="true" /> Download
      </button>
    </span>
  );
}

// A row of pill buttons for picking one option, e.g. a degree level.
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${value === option.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
        >
          {option.label}
          {option.count !== undefined && (
            <span className={`ml-1.5 text-xs ${value === option.value ? "text-blue-600" : "text-slate-400"}`}>{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// A number worth acting on, e.g. "3 proposals need a supervisor". Clicking goes there.
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  onClick,
  highlight = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const content = (
    <>
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${highlight ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600"}`}
      >
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold text-slate-900">{value}</span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </span>
    </>
  );
  const className = `flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition ${highlight ? "border-amber-300" : "border-slate-200"}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} hover:border-blue-400 hover:shadow-md`}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

// The signed-in user's own details, read-only.
export function ProfileCard({
  name,
  avatarUrl,
  fields,
}: {
  name: string;
  avatarUrl: string | null;
  fields: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-200 text-xl font-semibold uppercase text-slate-600">
          {avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : (name.trim()[0] ?? "?")}
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{name}</h2>
          <p className="text-sm text-slate-500">Use the menu at the top right to change your photo.</p>
        </div>
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs uppercase tracking-wide text-slate-400">{field.label}</dt>
            <dd className="mt-1 text-sm text-slate-700">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
