import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, ChevronDown, LogOut, Menu, UserRound, X, type LucideIcon } from "lucide-react";
import BrandMark from "./BrandMark";
import NotificationBell from "./NotificationBell";
import { clearSession } from "../utils/session";

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  // Items waiting on the signed-in user; shown as a count next to the label.
  badge?: number;
}

interface ShellUser {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface AppShellProps {
  // e.g. "Student workspace", shown above the page title.
  roleLabel: string;
  nav: NavItem[];
  active: string;
  title: string;
  subtitle?: string;
  // Page-level controls such as the degree-level filter.
  headerActions?: React.ReactNode;
  user: ShellUser;
  onUploadAvatar?: (file: File) => void;
  isUploadingAvatar?: boolean;
  children: React.ReactNode;
}

function Avatar({ user, size }: { user: ShellUser; size: string }) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold uppercase text-slate-600`}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        (user.name?.trim()?.[0] ?? "?")
      )}
    </span>
  );
}

// Avatar button in the header: who is signed in, their profile, a new photo, and sign-out.
function AccountMenu({
  user,
  onUploadAvatar,
  isUploadingAvatar,
}: Pick<AppShellProps, "user" | "onUploadAvatar" | "isUploadingAvatar">) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const itemClass =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Account menu"
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-lg border border-slate-300 py-1 pl-1 pr-2 text-slate-600 transition hover:border-blue-400 hover:bg-blue-50"
      >
        <Avatar user={user} size="size-8" />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-slate-700 sm:block">
          {user.name ?? "My account"}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-100 px-2 pb-3 pt-1">
            <Avatar user={user} size="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{user.name ?? "My account"}</p>
              {user.email && <p className="truncate text-xs text-slate-500">{user.email}</p>}
            </div>
          </div>
          <div className="mt-2 space-y-0.5">
            <Link to="/dashboard/profile" onClick={() => setIsOpen(false)} className={itemClass}>
              <UserRound size={16} aria-hidden="true" /> My profile
            </Link>
            {onUploadAvatar && (
              <>
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className={itemClass}
                >
                  <Camera size={16} aria-hidden="true" />
                  {isUploadingAvatar ? "Uploading photo..." : "Change photo"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUploadAvatar(file);
                    event.target.value = "";
                  }}
                  className="hidden"
                />
              </>
            )}
            <button
              type="button"
              onClick={() => {
                clearSession();
                navigate("/login");
              }}
              className={`${itemClass} hover:!bg-red-50 hover:text-red-700`}
            >
              <LogOut size={16} aria-hidden="true" /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// The frame every role's dashboard sits in: section links on the left, the page
// title, notifications and account menu on top, and the page itself below.
function AppShell({
  roleLabel,
  nav,
  active,
  title,
  subtitle,
  headerActions,
  user,
  onUploadAvatar,
  isUploadingAvatar,
  children,
}: AppShellProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  useEffect(() => {
    document.title = `${title} · ARMS`;
  }, [title]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-100 font-sans">
      {isNavigationOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsNavigationOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/50 md:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col bg-slate-800 px-4 py-6 text-white shadow-2xl transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:shadow-none ${isNavigationOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-2">
          <BrandMark />
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsNavigationOpen(false)}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-700 md:hidden"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-4 px-2 text-xs uppercase tracking-[0.2em] text-slate-400">{roleLabel}</p>
        <nav className="mt-6 space-y-1" aria-label="Main navigation">
          {nav.map((item) => {
            const isActive = item.key === active;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={`/dashboard/${item.key}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setIsNavigationOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/25"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <Icon size={18} aria-hidden="true" className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isActive ? "bg-white/25 text-white" : "bg-amber-400 text-slate-900"}`}
                    title={`${item.badge} waiting for you`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-2 text-xs leading-5 text-slate-500">Academic Research Management System</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={isNavigationOpen}
              onClick={() => setIsNavigationOpen(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 md:hidden"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-serif text-xl text-slate-900 sm:text-2xl">{title}</h1>
              {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
            </div>
            {headerActions && <div className="hidden lg:block">{headerActions}</div>}
            <NotificationBell />
            <AccountMenu user={user} onUploadAvatar={onUploadAvatar} isUploadingAvatar={isUploadingAvatar} />
          </div>
          {headerActions && <div className="border-t border-slate-100 px-4 py-2 sm:px-6 lg:hidden">{headerActions}</div>}
        </header>
        <main className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
