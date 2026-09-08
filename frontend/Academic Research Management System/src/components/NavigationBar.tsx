import Button from "./Button";
import BrandMark from "./BrandMark";
import { Building2, Users } from "lucide-react";

interface NavigationBarProps {
  open: boolean;
  onClose: () => void;
}

// Provide persistent dashboard branding and navigation actions from the left rail.
function NavigationBar({ open, onClose }: NavigationBarProps) {
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
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400">
        Research workspace
      </p>
      <nav className="mt-10 space-y-2" aria-label="Main navigation">
        <Button
          label="Users"
          icon={Users}
          color="blue"
          onClick={onClose}
          className="w-full justify-start border-blue-400 bg-blue-600 font-medium text-white shadow-lg shadow-blue-950/25 hover:border-blue-300 hover:bg-blue-500"
        />
        <Button
          label="Departments"
          icon={Building2}
          color="slate"
          onClick={onClose}
          className="w-full justify-start !border-slate-600 !bg-slate-700/60 font-medium !text-slate-200 hover:!border-slate-400 hover:!bg-slate-700 hover:!text-white"
        />
      </nav>
      <p className="mt-auto text-xs leading-5 text-slate-500">
        Academic Research Management System
      </p>
      </aside>
    </>
  );
}

export default NavigationBar;
