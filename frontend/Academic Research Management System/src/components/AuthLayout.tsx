import type { ReactNode } from "react";
import BrandMark from "./BrandMark";

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

// Share the branded two-column shell used by the client-only authentication screens.
function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-100 px-4 py-8 font-sans sm:px-6">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between bg-slate-800 p-8 text-white sm:p-10 lg:p-12">
          <div>
            <BrandMark />
            <p className="mt-16 max-w-xs text-sm leading-6 text-slate-300">
              A focused workspace for organizing academic research, people, and progress.
            </p>
          </div>
          <p className="mt-16 text-xs uppercase tracking-[0.24em] text-slate-400">
            Academic Research Management System
          </p>
        </div>

        <div className="p-8 sm:p-10 lg:p-12">
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-blue-600">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-serif text-3xl text-slate-900 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
              {description}
            </p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

export default AuthLayout;
