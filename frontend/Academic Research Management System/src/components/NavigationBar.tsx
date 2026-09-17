import { useRef } from "react";
import Button from "./Button";
import BrandMark from "./BrandMark";
import { Building2, Camera, FlaskConical, LogOut, Users } from "lucide-react";

interface NavigationBarProps {
  open: boolean;
  onClose: () => void;
  role: "admin" | "super_admin" | "student" | "professor";
  onProfile: () => void;
  onLogout: () => void;
  onUsers?: () => void;
  onDepartments?: () => void;
  onResearchSpace?: () => void;
  activeView: string;
  avatarUrl?: string | null;
  userName?: string;
  onUploadAvatar?: (file: File) => void;
  isUploadingAvatar?: boolean;
  avatarError?: string | null;
}

// Provide persistent dashboard branding and navigation actions from the left rail.
function NavigationBar({
  open,
  onClose,
  role,
  onProfile,
  onLogout,
  onUsers,
  onDepartments,
  onResearchSpace,
  activeView,
  avatarUrl,
  userName,
  onUploadAvatar,
  isUploadingAvatar,
  avatarError,
}: NavigationBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onUploadAvatar) onUploadAvatar(file);
    event.target.value = "";
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/50 md:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col bg-slate-800 p-6 text-white shadow-2xl transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
      <BrandMark />
      {onUploadAvatar && (
        <div className="mt-6 flex items-center gap-3">
          <div className="relative">
            <div className="flex size-14 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-700 text-lg font-semibold uppercase text-slate-200">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="size-full object-cover" />
              ) : (
                (userName?.trim()?.[0] ?? "?")
              )}
            </div>
            <button
              type="button"
              aria-label="Upload profile picture"
              title="Upload profile picture"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border border-slate-500 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
            >
              <Camera size={13} aria-hidden="true" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{userName ?? "My account"}</p>
            <p className="text-xs text-slate-400">{isUploadingAvatar ? "Uploading..." : "Update photo"}</p>
          </div>
        </div>
      )}
      {avatarError && <p className="mt-2 text-xs text-red-300">{avatarError}</p>}
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400">
        Research workspace
      </p>
      <nav className="mt-10 space-y-2" aria-label="Main navigation">
        <Button
          label="My profile"
          icon={Users}
          color="slate"
          onClick={() => { onProfile(); onClose(); }}
          className={`w-full justify-start font-medium ${activeView === "profile" ? "border-blue-400 bg-blue-600 text-white" : "!border-slate-600 !bg-slate-700/60 !text-slate-200 hover:!border-slate-400 hover:!bg-slate-700 hover:!text-white"}`}
        />
        {onUsers && (
          <Button
            label="Users"
            icon={Users}
            color="blue"
            onClick={() => { onUsers(); onClose(); }}
            className={`w-full justify-start font-medium ${activeView === "users" ? "border-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-950/25 hover:border-blue-300 hover:bg-blue-500" : "!border-slate-600 !bg-slate-700/60 !text-slate-200 hover:!border-slate-400 hover:!bg-slate-700 hover:!text-white"}`}
          />
        )}
        {onResearchSpace && (
          <Button
            label="Research space"
            icon={FlaskConical}
            color="blue"
            onClick={() => { onResearchSpace(); onClose(); }}
            className={`w-full justify-start font-medium ${activeView === "proposals" ? "border-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-950/25 hover:border-blue-300 hover:bg-blue-500" : "!border-slate-600 !bg-slate-700/60 !text-slate-200 hover:!border-slate-400 hover:!bg-slate-700 hover:!text-white"}`}
          />
        )}
        {onDepartments && (
          <Button
            label={role === "super_admin" ? "Departments" : "Research tools"}
            icon={Building2}
            color="slate"
            onClick={() => { onDepartments(); onClose(); }}
            className={`w-full justify-start font-medium ${activeView === "management" ? "border-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-950/25 hover:border-blue-300 hover:bg-blue-500" : "!border-slate-600 !bg-slate-700/60 !text-slate-200 hover:!border-slate-400 hover:!bg-slate-700 hover:!text-white"}`}
          />
        )}
      </nav>
      <Button
        label="Log out"
        icon={LogOut}
        color="slate"
        onClick={() => { onLogout(); onClose(); }}
        className="mt-4 w-full justify-start font-medium !border-slate-600 !bg-slate-700/60 !text-slate-200 hover:!border-red-400 hover:!bg-red-950/30 hover:!text-red-200"
      />
      <p className="mt-auto text-xs leading-5 text-slate-500">
        Academic Research Management System
      </p>
      </aside>
    </>
  );
}

export default NavigationBar;
