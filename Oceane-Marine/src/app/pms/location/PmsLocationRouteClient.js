"use client";

import Link from "next/link";
import PmsLocationMaster from "./PmsLocationMaster";

export default function PmsLocationRouteClient() {
  return (
    <div className="flex min-h-screen flex-1 min-w-0 flex-col text-white">
      <div
        className={`mx-auto w-full max-w-[95%] space-y-4 px-3 py-4 sm:space-y-6 sm:pl-4 sm:pr-4 sm:py-6 md:py-8`}
      >
        <header className="mb-2 mt-12 flex flex-col items-start gap-3 sm:mt-0 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/dashboard"
            className="hidden flex-shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-black/25 backdrop-blur-[2px] transition hover:bg-white/15 md:inline-flex"
          >
            ← Dashboard
          </Link>
          <div className="flex w-full flex-1 flex-col items-center text-center sm:w-auto">
            <p className="text-xs uppercase tracking-[0.15em] text-sky-300 sm:text-sm sm:tracking-[0.25em]">
              PMS
            </p>
            <h1 className="text-lg font-bold text-white sm:text-xl md:text-2xl">
              Planned maintenance system
            </h1>
          </div>
          <div className="hidden w-[140px] flex-shrink-0 sm:block" aria-hidden />
        </header>

        <div className="rounded-xl border border-white/10 bg-[#0b2740]/45 p-3 shadow-2xl backdrop-blur-[2px] sm:rounded-2xl sm:p-4 md:rounded-3xl md:p-6">
          <PmsLocationMaster />
        </div>
      </div>
    </div>
  );
}
