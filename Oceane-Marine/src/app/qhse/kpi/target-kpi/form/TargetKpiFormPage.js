"use client";

import { useState, useCallback, useEffect } from "react";
import { useQhseSidebar } from "../../../QhseSidebarContext";
import Link from "next/link";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";
import { useQhseRole } from "@/hooks/useQhseRole";

const DEFAULT_KPI_TITLES = [
  "Mooring Master Feedback",
  "Spills to water",
  "Critical Incidents",
  "Non-Critical Incidents",
  "Near Miss reporting",
  "Stop Work Authority",
  "Injuries to personnel - Minor",
  "Injuries to personnel - Severe",
  "QHSE Meetings",
  "Emergency Drills",
  "Safety Bulletins",
  "Health Bulletin",
  "Best Practices",
];

/* Title of the row that can be auto-populated from OPS-OFD-020 */
const FEEDBACK_ROW_TITLE = "Mooring Master Feedback";

const emptyRow = (title = "") => ({
  title,
  targetForYear: 0,
  quarter1: 0,
  quarter2: 0,
  quarter3: 0,
  quarter4: 0,
  targetsAchieved: 0,
});

// Allow only digits and optional one decimal (prevents scroll-from-changing value when using type="text" + inputMode="decimal")
const NUMERIC_DECIMAL_PATTERN = /^\d*\.?\d*$/;
function handleNumericChange(value, setter) {
  if (value === "" || NUMERIC_DECIMAL_PATTERN.test(value)) setter(value);
}

function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i <= currentYear + 5; i++) years.push(i);
  return years;
}

export default function TargetKpiFormPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState(() =>
    DEFAULT_KPI_TITLES.map((t) => emptyRow(t))
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [formCode, setFormCode] = useState("HSE-001A");
  const [serialNumber, setSerialNumber] = useState(null);

  /* ─── Tracker auto-load state ───
   * The Target KPI form is a single live "tracker" per year. On mount and on
   * every year change we fetch the year's existing record and pre-populate
   * the rows so the user can append to it instead of creating a new sheet. */
  const [loadingTracker, setLoadingTracker] = useState(false);
  /** True once we've successfully loaded a tracker (existing record) for the
   * current year — drives the banner copy and the save button label. */
  const [trackerExists, setTrackerExists] = useState(false);
  /** How many non-empty rows were already in the tracker when we loaded it.
   * Counted as rows that have at least a title or any non-zero quarter
   * value — purely cosmetic for the banner. */
  const [trackerRowCount, setTrackerRowCount] = useState(0);

  /* ─── Feedback rating auto-populate state ─── */
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackDetails, setFeedbackDetails] = useState(null);

  /* ─── Fetch All Data state ─── */
  const [fetchAllLoading, setFetchAllLoading] = useState(false);

  const years = getYears();

  // Fetch form code on mount (may override if API returns different value); after save we update with actual from response
  useEffect(() => {
    let cancelled = false;
    fetch("/api/qhse/kpi/target/code")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && data.formCode) {
          setFormCode(data.formCode);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Helper used by the tracker loader and the post-save refresh. Counts rows
  // that look "non-empty" so the banner can show e.g. "7 saved entries".
  const countMeaningfulRows = (rs) =>
    rs.filter(
      (r) =>
        (r.title && String(r.title).trim() !== "") ||
        Number(r.targetForYear) ||
        Number(r.quarter1) ||
        Number(r.quarter2) ||
        Number(r.quarter3) ||
        Number(r.quarter4) ||
        Number(r.targetsAchieved)
    ).length;

  // Tracker auto-load: whenever the selected year changes we look up that
  // year's live KPI record. If it exists, hydrate the table with its rows so
  // every previously-saved entry shows up alongside any new ones the user
  // adds. If no tracker exists yet, fall back to the 13 default KPI titles.
  useEffect(() => {
    let cancelled = false;
    const loadTracker = async () => {
      setLoadingTracker(true);
      setError(null);
      try {
        const res = await fetch(`/api/qhse/kpi/target/by-year/${year}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || data.success === false) {
          throw new Error(data?.error || "Failed to load KPI tracker");
        }

        if (data.data && Array.isArray(data.data.rows) && data.data.rows.length > 0) {
          const loadedRows = data.data.rows.map((r) => ({
            title: r.title || "",
            targetForYear: Number(r.targetForYear) || 0,
            quarter1: Number(r.quarter1) || 0,
            quarter2: Number(r.quarter2) || 0,
            quarter3: Number(r.quarter3) || 0,
            quarter4: Number(r.quarter4) || 0,
            targetsAchieved: Number(r.targetsAchieved) || 0,
          }));
          setRows(loadedRows);
          setTrackerExists(true);
          setTrackerRowCount(countMeaningfulRows(loadedRows));
          if (data.data.formCode) setFormCode(data.data.formCode);
          if (data.data.serialNumber) setSerialNumber(data.data.serialNumber);
        } else {
          // No tracker for this year yet — start with the default KPI titles
          // so the user has a sensible starting point.
          setRows(DEFAULT_KPI_TITLES.map((t) => emptyRow(t)));
          setTrackerExists(false);
          setTrackerRowCount(0);
          setSerialNumber(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load KPI tracker");
      } finally {
        if (!cancelled) setLoadingTracker(false);
      }
    };
    loadTracker();
    return () => {
      cancelled = true;
    };
  }, [year]);

  /**
   * Auto-fetch OPS-OFD-020 quarterly ratings for the selected year
   * and populate the "Mooring Master Feedback" row.
   */
  const fetchFeedbackRating = useCallback(async () => {
    setFeedbackLoading(true);
    setFeedbackDetails(null);
    try {
      const res = await fetch(`/api/qhse/kpi/feedback-rating?year=${year}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to fetch ratings");

      const { quarter1, quarter2, quarter3, quarter4, yearAvg, details } = json.data;

      // Find the "Mooring Master Feedback" row and update its quarter values
      setRows((prev) => {
        return prev.map((r) => {
          if (r.title === FEEDBACK_ROW_TITLE) {
            const q1 = quarter1 || 0;
            const q2 = quarter2 || 0;
            const q3 = quarter3 || 0;
            const q4 = quarter4 || 0;
            return {
              ...r,
              quarter1: q1,
              quarter2: q2,
              quarter3: q3,
              quarter4: q4,
              targetsAchieved: Math.round((q1 + q2 + q3 + q4) * 100) / 100,
            };
          }
          return r;
        });
      });

      setFeedbackDetails({ ...json.data, details });
      setMessage(`✅ Mooring Master Feedback ratings auto-populated for ${year} (Combined CHS + MS avg: ${yearAvg}/5)`);
    } catch (err) {
      setError(err.message || "Failed to fetch feedback ratings");
    } finally {
      setFeedbackLoading(false);
    }
  }, [year]);

  /**
   * Fetch all KPI data for the selected year and auto-populate all rows
   */
  const fetchAllKpiData = useCallback(async () => {
    setFetchAllLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/qhse/kpi/target/auto-fetch?year=${year}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to fetch KPI data");

      const kpiData = json.data;

      // Update all rows with fetched data
      setRows((prev) => {
        return prev.map((row) => {
          const title = row.title;
          const data = kpiData[title];

          if (data) {
            // Convert Q1, Q2, Q3, Q4 to quarter1, quarter2, quarter3, quarter4
            const q1 = data.Q1 || 0;
            const q2 = data.Q2 || 0;
            const q3 = data.Q3 || 0;
            const q4 = data.Q4 || 0;
            const total = q1 + q2 + q3 + q4;

            return {
              ...row,
              quarter1: q1,
              quarter2: q2,
              quarter3: q3,
              quarter4: q4,
              targetsAchieved: Math.round(total * 100) / 100,
            };
          }
          return row;
        });
      });

      // Also fetch feedback details for the Mooring Master Feedback section
      try {
        const feedbackRes = await fetch(`/api/qhse/kpi/feedback-rating?year=${year}`);
        const feedbackJson = await feedbackRes.json();
        if (feedbackRes.ok && feedbackJson.success) {
          setFeedbackDetails(feedbackJson.data);
        }
      } catch (err) {
        // Ignore feedback details error, main data is already populated
      }

      setMessage(`✅ All KPI data auto-populated for ${year}. Review and save when ready.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Failed to fetch all KPI data");
    } finally {
      setFetchAllLoading(false);
    }
  }, [year]);

  const updateRow = useCallback((index, field, value) => {
    setRows((prev) => {
      const next = prev.map((r, i) =>
        i === index ? { ...r, [field]: value } : r
      );
      if (field === "quarter1" || field === "quarter2" || field === "quarter3" || field === "quarter4") {
        const r = next[index];
        const sum =
          (Number(r.quarter1) || 0) +
          (Number(r.quarter2) || 0) +
          (Number(r.quarter3) || 0) +
          (Number(r.quarter4) || 0);
        next[index] = { ...r, targetsAchieved: sum };
      }
      return next;
    });
  }, []);

  const updateRowTargetsAchieved = useCallback((index, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, targetsAchieved: Number(value) || 0 } : r))
    );
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, emptyRow("")]);
  }, []);

  const removeRow = useCallback((index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    const payload = {
      year,
      rows: rows.map((r) => ({
        title: r.title,
        targetForYear: Number(r.targetForYear) || 0,
        quarter1: Number(r.quarter1) || 0,
        quarter2: Number(r.quarter2) || 0,
        quarter3: Number(r.quarter3) || 0,
        quarter4: Number(r.quarter4) || 0,
        targetsAchieved: Number(r.targetsAchieved) || 0,
      })),
    };

    try {
      const res = await fetch("/api/qhse/kpi/target/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to save");
      const savedCode = data.data?.formCode || null;
      const savedSerial = data.data?.serialNumber || null;
      const mode = data.mode; // "created" | "updated"
      if (savedCode) setFormCode(savedCode);
      if (savedSerial) setSerialNumber(savedSerial);
      const displayCode = savedCode || formCode || "HSE-001A";

      // Refresh the local snapshot so the banner and counters reflect the
      // freshly-persisted state.
      if (Array.isArray(data.data?.rows)) {
        setTrackerRowCount(countMeaningfulRows(data.data.rows));
      }
      setTrackerExists(true);

      if (mode === "updated") {
        setMessage(
          `Target KPI tracker for ${year} updated. New entries are now part of the main tracker (Serial: ${savedSerial || "—"}).`
        );
      } else {
        setMessage(
          `Target KPI tracker for ${year} created. Form code: ${displayCode}${savedSerial ? ` • Serial: ${savedSerial}` : ""}.`
        );
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = canCreate;

  const { contentClassName } = useQhseSidebar();
  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/dashboard"
            className="flex-shrink-0 shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / KPI / Target KPI
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Target KPI</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">HSE-001A</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="HSE-001A" />
            <div className="flex rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/kpi/target-kpi/form"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Target KPI
              </Link>
              <Link
                href="/qhse/kpi/create"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                KPI
              </Link>
            </div>
            <div className="flex rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/kpi/target-kpi/form"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Form
              </Link>
              <Link
                href="/qhse/kpi/target-kpi/list"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                List
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
            {error}
          </div>
        )}
        {message && (
          <div className="text-base text-emerald-300 bg-emerald-950/40 border border-emerald-500/60 rounded-lg px-6 py-4">
            {message}
          </div>
        )}

        {/* ──── Fetch All Data Button ──── */}
        <div className="rounded-2xl border border-orange-500/30 bg-orange-950/20 p-5 backdrop-blur space-y-4">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
              <select
                className="rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[5rem]"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-orange-300 uppercase tracking-wider">
                Auto-Fetch All KPI Data
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Fetch and auto-populate all KPI fields for <span className="font-semibold text-white">{year}</span> from existing data sources
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAllKpiData}
              disabled={fetchAllLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {fetchAllLoading ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  Fetching All Data…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Fetch All Data
                </>
              )}
            </button>
          </div>
        </div>

        {!canSubmit && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm">
            You do not have permission to create records. Form is view-only.
          </div>
        )}

        {/* Tracker mode banner — explains that this form is the live master
            sheet for the chosen year and that any new entries are appended to
            the existing ones rather than spawning a separate record. */}
        <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          {loadingTracker ? (
            <span className="text-sky-200">Loading {year} KPI tracker…</span>
          ) : trackerExists ? (
            <>
              <span className="font-semibold">Tracker for {year}.</span>{" "}
              Showing <span className="font-semibold">{trackerRowCount}</span>{" "}
              previously saved {trackerRowCount === 1 ? "entry" : "entries"}.
              Add new rows below — saving will append them to the same Target
              KPI tracker, not create a new record.
            </>
          ) : (
            <>
              <span className="font-semibold">Tracker for {year}.</span>{" "}
              No KPI tracker exists for {year} yet. The 13 default KPI titles
              are pre-loaded so you can fill them in — saving will create the
              tracker and every future entry for {year} will be appended to it.
            </>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={!canSubmit} className="border-0 p-0 m-0 min-w-0 space-y-4 disabled:opacity-[0.88]">
            <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] rounded-xl border border-slate-500/30 overflow-hidden">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#366092]">
                    <th className="border border-slate-400/50 px-3 py-2.5 text-left text-white font-semibold uppercase tracking-wide">
                      Title
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 text-left text-white font-semibold uppercase tracking-wide whitespace-nowrap">
                      Targets for {year}
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 text-left text-white font-semibold uppercase tracking-wide">
                      Quarter 1
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 text-left text-white font-semibold uppercase tracking-wide">
                      Quarter 2
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 text-left text-white font-semibold uppercase tracking-wide">
                      Quarter 3
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 text-left text-white font-semibold uppercase tracking-wide">
                      Quarter 4
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 text-left text-white font-semibold uppercase tracking-wide">
                      Targets Achieved
                    </th>
                    <th className="border border-slate-400/50 px-2 py-2 w-12 bg-[#366092] text-white font-semibold uppercase tracking-wide text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className="hover:bg-white/5">
                      <td className="border border-slate-400/40 px-3 py-2 bg-[#5a8bc4]/80 text-white">
                        <input
                          type="text"
                          value={row.title}
                          onChange={(e) => updateRow(index, "title", e.target.value)}
                          className="w-full bg-transparent border-none text-white placeholder-white/60 focus:ring-0 p-0 min-w-[180px]"
                          placeholder="KPI title"
                        />
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2 bg-slate-800/50">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.targetForYear === 0 ? "" : row.targetForYear}
                          onChange={(e) =>
                            handleNumericChange(e.target.value, (v) => updateRow(index, "targetForYear", v))
                          }
                          onWheel={(e) => e.target.blur()}
                          className="w-20 bg-slate-900/50 border border-white/10 rounded px-2 py-1 text-white text-center tabular-nums"
                        />
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2 bg-slate-800/50">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.quarter1 === 0 ? "" : row.quarter1}
                          onChange={(e) =>
                            handleNumericChange(e.target.value, (v) => updateRow(index, "quarter1", v))
                          }
                          onWheel={(e) => e.target.blur()}
                          className="w-20 bg-slate-900/50 border border-white/10 rounded px-2 py-1 text-white text-center tabular-nums"
                        />
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2 bg-slate-800/50">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.quarter2 === 0 ? "" : row.quarter2}
                          onChange={(e) =>
                            handleNumericChange(e.target.value, (v) => updateRow(index, "quarter2", v))
                          }
                          onWheel={(e) => e.target.blur()}
                          className="w-20 bg-slate-900/50 border border-white/10 rounded px-2 py-1 text-white text-center tabular-nums"
                        />
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2 bg-slate-800/50">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.quarter3 === 0 ? "" : row.quarter3}
                          onChange={(e) =>
                            handleNumericChange(e.target.value, (v) => updateRow(index, "quarter3", v))
                          }
                          onWheel={(e) => e.target.blur()}
                          className="w-20 bg-slate-900/50 border border-white/10 rounded px-2 py-1 text-white text-center tabular-nums"
                        />
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2 bg-slate-800/50">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.quarter4 === 0 ? "" : row.quarter4}
                          onChange={(e) =>
                            handleNumericChange(e.target.value, (v) => updateRow(index, "quarter4", v))
                          }
                          onWheel={(e) => e.target.blur()}
                          className="w-20 bg-slate-900/50 border border-white/10 rounded px-2 py-1 text-white text-center tabular-nums"
                        />
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2 bg-slate-800/50">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.targetsAchieved === 0 ? "" : row.targetsAchieved}
                          onChange={(e) =>
                            handleNumericChange(e.target.value, (v) => updateRowTargetsAchieved(index, v))
                          }
                          onWheel={(e) => e.target.blur()}
                          className="w-20 bg-slate-900/50 border border-white/10 rounded px-2 py-1 text-white text-center tabular-nums"
                        />
                      </td>
                      <td className="border border-slate-400/40 px-2 py-2 bg-slate-800/50 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="text-red-400 hover:text-red-300 text-base font-bold inline-flex items-center justify-center w-6 h-6 rounded border border-red-400/40 hover:border-red-400/60 hover:bg-red-500/10 transition"
                          title="Delete row"
                          aria-label="Delete row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={addRow}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10 transition"
              >
                + Add row
              </button>
              <button
                type="submit"
                disabled={!canSubmit || submitting || loadingTracker}
                className="inline-flex items-center rounded-full bg-orange-500 hover:bg-orange-400 px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] shadow disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting
                  ? "Saving…"
                  : trackerExists
                    ? "Save to Tracker"
                    : "Start Tracker"}
              </button>
            </div>
            </fieldset>
          </form>
        </div>
      </div>
    </div>
  );
}
