"use client";

import Link from "next/link";

/**
 * Shared QHSE list/form page header: centered title block on small screens;
 * desktop keeps Dashboard link left and optional actions right.
 */
export function QhseStandardPageHeader({
  breadcrumb,
  title,
  formCode,
  formCodeLabel = "Form code",
  dashboardHref = "/dashboard",
  children,
}) {
  return (
    <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
      <Link
        href={dashboardHref}
        className="hidden md:inline-flex flex-shrink-0 items-center gap-1.5 self-start px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
      >
        ← Dashboard
      </Link>
      <div className="flex w-full flex-1 flex-col items-center text-center sm:w-auto sm:min-w-0">
        <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
          {breadcrumb}
        </p>
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">{title}</h1>
        {formCode ? (
          <p className="text-xs sm:text-sm text-slate-200 mt-1">
            {formCodeLabel}:{" "}
            <span className="font-mono font-semibold text-sky-300">{formCode}</span>
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
          {children}
        </div>
      ) : null}
    </header>
  );
}
