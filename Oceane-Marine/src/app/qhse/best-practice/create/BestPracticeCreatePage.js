"use client";

import { useState } from "react";
import { useQhseSidebar } from "../../QhseSidebarContext";
import { useQhseRole } from "@/hooks/useQhseRole";
import Link from "next/link";

export default function BestPracticeCreatePage() {
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = canCreate;
  const [form, setForm] = useState({
    description: "",
    eventDate: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/qhse/best-practice/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create best practice");
      }

      setMessage("Best practice created successfully!");
      setForm({ description: "", eventDate: "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const { contentClassName } = useQhseSidebar();
  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/dashboard"
            className="flex-shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / Best Practices
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Create Best Practice</h1>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/best-practice/create"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Create Best Practice
              </Link>
              <Link
                href="/qhse/best-practice/list"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Best Practice List
              </Link>
            </div>
          </div>
        </header>

        <main>
          {!canSubmit && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm">
              You do not have permission to create records. Form is view-only.
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="eventDate"
                  className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5"
                >
                  Event Date <span className="text-red-400">*</span>
                </label>
                <input
                  id="eventDate"
                  type="date"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  value={form.eventDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, eventDate: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5"
                >
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="description"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  rows={6}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Enter best practice description..."
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              {message && (
                <div className="text-base text-emerald-300 bg-emerald-950/40 border-2 border-emerald-500/60 rounded-lg px-6 py-4">
                  <span className="font-semibold">{message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setForm({ description: "", eventDate: "" })}
                  className="rounded-full border border-white/20 bg-transparent px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
                  disabled={submitting}
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center rounded-full bg-orange-500 hover:bg-orange-400 px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] shadow disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

