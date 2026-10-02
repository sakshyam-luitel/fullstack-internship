import { useCallback, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { ToastContext, type ToastApi } from "../hooks/useToast";

type ToastTone = "success" | "error";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

// Errors stay up longer than confirmations, since they usually need reading.
const DURATION_MS: Record<ToastTone, number> = { success: 4000, error: 8000 };

// Short-lived messages pinned to the corner of the screen, so the result of an
// action is visible wherever the page happens to be scrolled.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      // The same message twice in a row (e.g. a retried request) replaces the first.
      setToasts((current) => [...current.filter((toast) => toast.message !== message), { id, tone, message }].slice(-4));
      window.setTimeout(() => dismiss(id), DURATION_MS[tone]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => show("success", message),
      error: (message) => show("error", message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
              toast.tone === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {toast.tone === "error" ? (
              <AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            )}
            <p className="min-w-0 flex-1">{toast.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
