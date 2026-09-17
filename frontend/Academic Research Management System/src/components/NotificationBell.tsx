import { useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, X } from "lucide-react";
import { print } from "graphql";
import { API_ORIGIN } from "../utils/uploadAvatar";
import { MY_NOTIFICATIONS_QUERY } from "../queries/queries";
import { MARK_NOTIFICATIONS_READ } from "../mutations/mutations";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  phaseLabel: string | null;
  phaseType: string | null;
  opensAt: string | null;
  deadlineAt: string | null;
  defenseDate: string | null;
}

const REFRESH_INTERVAL_MS = 60_000;

async function request<T>(document: typeof MY_NOTIFICATIONS_QUERY, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_ORIGIN}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}` },
    body: JSON.stringify({ query: print(document), variables }),
  });
  const result = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (!response.ok || result.errors?.length) throw new Error(result.errors?.[0]?.message ?? "Request failed.");
  if (!result.data) throw new Error("The server returned no data.");
  return result.data;
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function scheduleLine(notification: Notification): string | null {
  if (notification.defenseDate) {
    return `Defense day: ${new Date(notification.defenseDate).toLocaleDateString(undefined, { dateStyle: "medium" })}`;
  }
  if (notification.opensAt && notification.deadlineAt) {
    return `${formatDateTime(notification.opensAt)} – deadline ${formatDateTime(notification.deadlineAt)}`;
  }
  return null;
}

// Bell with an unread badge; opening the panel marks everything shown as read.
function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ids that were unread when the panel opened, so they stay highlighted while it's open.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const result = await request<{ myNotifications: Notification[] }>(MY_NOTIFICATIONS_QUERY);
      setNotifications(result.myNotifications);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load notifications.");
    }
  };

  useEffect(() => {
    const initializeNotifications = async () => {
      await load();
    };
    void initializeNotifications();
    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const togglePanel = async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const unreadIds = notifications.filter((notification) => !notification.isRead).map((notification) => notification.id);
    setFreshIds(new Set(unreadIds));
    setIsOpen(true);
    if (unreadIds.length === 0) return;
    try {
      await request(MARK_NOTIFICATIONS_READ, { userInput: { ids: unreadIds } });
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update notifications.");
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => void togglePanel()}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={isOpen}
        className="relative flex size-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 z-40 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            <button type="button" aria-label="Close notifications" onClick={() => setIsOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {error && <p className="bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
          <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-auto">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet.</li>
            ) : (
              notifications.map((notification) => {
                const schedule = scheduleLine(notification);
                return (
                  <li key={notification.id} className={`px-4 py-3 ${freshIds.has(notification.id) ? "bg-blue-50/60" : ""}`}>
                    <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{notification.message}</p>
                    {schedule && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-blue-700">
                        <CalendarClock size={13} aria-hidden="true" />
                        {schedule}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(notification.createdAt)}</p>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
