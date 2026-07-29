"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useQhseRole } from "@/hooks/useQhseRole";
import { readJsonFromResponse } from "@/lib/utils/readJsonFromResponse";

// Generate dynamic years: 2 years back, current year, and 5 years forward
function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  // 2 years in the past
  for (let i = currentYear - 2; i < currentYear; i++) {
    years.push(i);
  }
  // Current year and 5 years forward
  for (let i = currentYear; i <= currentYear + 5; i++) {
    years.push(i);
  }
  return years;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "April",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_PAIRS = [
  { label: "Jan–Feb", months: [0, 1] },
  { label: "Mar–Apr", months: [2, 3] },
  { label: "May–Jun", months: [4, 5] },
  { label: "Jul–Aug", months: [6, 7] },
  { label: "Sep–Oct", months: [8, 9] },
  { label: "Nov–Dec", months: [10, 11] },
];

const formatDateInput = (year, monthIndex, day = 1) => {
  // Avoid timezone shifts by building the date string manually (YYYY-MM-DD)
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
};

/** Pull the day-of-month out of a YYYY-MM-DD input value WITHOUT building a Date
 *  (avoids the UTC parsing shift that converts e.g. 2026-11-01 → 2026-10-31 in IST). */
const dayFromDateInput = (value, fallback = 1) => {
  if (!value || typeof value !== "string") return fallback;
  const parts = value.split("-");
  const day = Number.parseInt(parts[2], 10);
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : fallback;
};

const yearFromDateInput = (value) => {
  if (!value || typeof value !== "string") return null;
  const y = Number.parseInt(value.split("-")[0], 10);
  return Number.isFinite(y) ? y : null;
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
};

function monthPairIndexForPlannedDate(plannedDate) {
  if (!plannedDate) return -1;
  const month = new Date(plannedDate).getMonth();
  return MONTH_PAIRS.findIndex((pair) => pair.months.includes(month));
}

function buildEmptyMonthDataForYear(y) {
  return MONTH_PAIRS.map((pair) => ({
    plannedDate: formatDateInput(y, pair.months[0], 1),
    topic: "",
    instructor: "",
    description: "",
  }));
}

export default function TrainingPlanPage({ hideSidebar = false }) {
  const currentYear = new Date().getFullYear();
  const initialYear = currentYear;

  const [year, setYear] = useState(initialYear);
  const [selectedPair, setSelectedPair] = useState(0); // 0-5 index
  const [monthData, setMonthData] = useState(() => {
    // Initialize all 6 pairs with empty data (use first month of the pair for the date)
    return MONTH_PAIRS.map((pair) => ({
      plannedDate: formatDateInput(initialYear, pair.months[0], 1),
      topic: "",
      instructor: "",
      description: "",
    }));
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [monthPairFiles, setMonthPairFiles] = useState({
    "Jan-Feb": null,
    "Mar-Apr": null,
    "May-Jun": null,
    "Jul-Aug": null,
    "Sep-Oct": null,
    "Nov-Dec": null,
  });
  const [existingPlanId, setExistingPlanId] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  useEffect(() => {
    let active = true;
    const loadPlanForYear = async () => {
      setLoadingPlan(true);
      setError(null);
      try {
        const res = await fetch(`/api/qhse/training/plan?year=${year}`);
        const data = await readJsonFromResponse(res);
        if (!active) return;

        if (res.ok && data.success && data.data) {
          const plan = data.data;
          setExistingPlanId(plan._id);
          const next = buildEmptyMonthDataForYear(year);
          for (const item of plan.planItems || []) {
            const idx = monthPairIndexForPlannedDate(item.plannedDate);
            if (idx >= 0) {
              const day = dayFromDateInput(toDateInputValue(item.plannedDate), 1);
              next[idx] = {
                plannedDate: formatDateInput(year, MONTH_PAIRS[idx].months[0], day),
                topic: item.topic || "",
                instructor: item.instructor || "",
                description: item.description || "",
              };
            }
          }
          setMonthData(next);
        } else {
          setExistingPlanId(null);
          setMonthData(buildEmptyMonthDataForYear(year));
        }
      } catch {
        if (active) {
          setExistingPlanId(null);
          setMonthData(buildEmptyMonthDataForYear(year));
        }
      } finally {
        if (active) setLoadingPlan(false);
      }
    };
    loadPlanForYear();
    return () => {
      active = false;
    };
  }, [year]);

  const handleYearChange = (newYear) => {
    setYear(newYear);
    setMonthData((prev) =>
      prev.map((data, index) => {
        const pair = MONTH_PAIRS[index];
        // Preserve the day, shift the year, keep month anchored to the pair's first month.
        // Read the day from the YYYY-MM-DD string directly to dodge timezone shifts.
        const day = dayFromDateInput(data.plannedDate, 1);
        return {
          ...data,
          plannedDate: formatDateInput(newYear, pair.months[0], day),
        };
      })
    );
    setMessage(null);
    setError(null);
  };

  const handleFieldChange = (field, value) => {
    setMonthData((prev) => {
      const next = [...prev];
      next[selectedPair] = { ...next[selectedPair], [field]: value };

      // If plannedDate is changed, sync the year (string-parsed to avoid TZ shifts)
      if (field === "plannedDate" && value) {
        const newYear = yearFromDateInput(value);
        if (newYear && newYear !== year) {
          setYear(newYear);
        }
      }

      return next;
    });
  };

  const handleNextPair = () => {
    if (selectedPair < MONTH_PAIRS.length - 1) {
      setSelectedPair(selectedPair + 1);
    }
  };

  const handlePrevPair = () => {
    if (selectedPair > 0) {
      setSelectedPair(selectedPair - 1);
    }
  };

  const handleMonthPairFileChange = (monthPair, file) => {
    setMonthPairFiles((prev) => ({
      ...prev,
      [monthPair]: file,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      // IMPORTANT: map FIRST (so the original month-pair index survives), THEN filter.
      // Earlier `.filter().map()` re-indexed survivors from 0, which silently re-parented
      // entries to the wrong MONTH_PAIRS slot — e.g. a Nov-Dec submission landed in Jan-Feb.
      const planItems = monthData
        .map((item, pairIdx) => {
          const pair = MONTH_PAIRS[pairIdx];
          const day = dayFromDateInput(item.plannedDate, 1);
          return {
            pairIdx,
            plannedDate: formatDateInput(year, pair.months[0], day),
            topic: item.topic.trim(),
            instructor: item.instructor.trim(),
            description: item.description.trim() || undefined,
            status: "Approved", // carry approval intent
          };
        })
        .filter((item) => item.topic && item.instructor)
        .map(({ pairIdx, ...rest }) => rest);

      if (!planItems.length) {
        setError("Please fill at least one month with Topic and Instructor.");
        setSaving(false);
        return;
      }

      // Create FormData for file uploads
      const formData = new FormData();
      formData.append("planItems", JSON.stringify(planItems));

      // Append month pair files if they exist
      Object.keys(monthPairFiles).forEach((monthPair) => {
        const file = monthPairFiles[monthPair];
        if (file) {
          formData.append(`monthPairFile_${monthPair}`, file);
        }
      });

      const isUpdate = Boolean(existingPlanId);
      const res = await fetch(
        isUpdate
          ? `/api/qhse/training/plan/${existingPlanId}`
          : "/api/qhse/training/plan",
        {
          method: isUpdate ? "PUT" : "POST",
          body: formData,
        }
      );

      const data = await readJsonFromResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(
          data.error ||
            (isUpdate ? "Failed to update training plan" : "Failed to create training plan")
        );
      }

      if (data.data?._id) {
        setExistingPlanId(data.data._id);
      }

      setMessage(
        isUpdate
          ? `Training plan for ${year} updated successfully`
          : `Training plan for ${year} saved successfully`
      );
      setError(null);

      setMonthPairFiles({
        "Jan-Feb": null,
        "Mar-Apr": null,
        "May-Jun": null,
        "Jul-Aug": null,
        "Sep-Oct": null,
        "Nov-Dec": null,
      });

      if (isUpdate) {
        const refreshRes = await fetch(`/api/qhse/training/plan?year=${year}`);
        const refreshData = await readJsonFromResponse(refreshRes);
        if (refreshRes.ok && refreshData.success && refreshData.data) {
          const plan = refreshData.data;
          setExistingPlanId(plan._id);
          const next = buildEmptyMonthDataForYear(year);
          for (const item of plan.planItems || []) {
            const idx = monthPairIndexForPlannedDate(item.plannedDate);
            if (idx >= 0) {
              const day = dayFromDateInput(toDateInputValue(item.plannedDate), 1);
              next[idx] = {
                plannedDate: formatDateInput(year, MONTH_PAIRS[idx].months[0], day),
                topic: item.topic || "",
                instructor: item.instructor || "",
                description: item.description || "",
              };
            }
          }
          setMonthData(next);
        }
      } else {
        setMonthData(buildEmptyMonthDataForYear(year));
        setSelectedPair(0);
      }
      
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
      setMessage(null);
    } finally {
      setSaving(false);
    }
  };

  const currentPairData = monthData[selectedPair];
  const hasData =
    currentPairData.topic.trim() ||
    currentPairData.instructor.trim() ||
    currentPairData.description.trim();

  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = existingPlanId ? canEdit : canCreate;

  const { contentClassName } = useQhseSidebar();
  const content = (
    <div className={hideSidebar ? "flex-1 w-full min-w-0" : `${contentClassName} w-full min-w-0 pr-4`}>
        <div className="w-full max-w-[95%] mx-auto pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
          <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
            {/* Left: Dashboard */}
            <Link
              href="/dashboard"
              className="hidden md:inline-flex items-center gap-1.5 self-start px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition flex-shrink-0"
            >
              ← Dashboard
            </Link>

            {/* Center: Title */}
            <div className="flex w-full flex-1 flex-col items-center text-center sm:w-auto">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
                QHSE / Training
              </p>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Annual Training Matrix</h1>
              <p className="text-xs sm:text-sm text-slate-200 mt-1">
                Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-038</span>
              </p>
            </div>

            {/* Right: Matrix / Record tabs only (Template is next to Year inside the form) */}
            <div className="flex w-full max-w-full flex-col items-center justify-center gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end sm:self-auto">
              <div className="inline-flex max-w-full flex-wrap justify-center rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                <Link
                  href="/qhse/training/create/plan"
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
                >
                  Training Matrix
                </Link>
                <Link
                  href="/qhse/training/create/record"
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
                >
                  Training Record
                </Link>
              </div>
            </div>
          </header>

          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-6"
          >
            {!canSubmit && (
              <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
                You do not have permission to {existingPlanId ? "update" : "create"} this training plan. Form is view-only.
              </div>
            )}
            <fieldset disabled={!canSubmit} className="border-0 p-0 m-0 min-w-0 space-y-6 disabled:opacity-[0.88]">
            <div className="flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2 sm:gap-4">
              <a
                href="/templates/controlled-register/QAF-OFD-038.docx"
                download
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/20 sm:px-4 sm:py-2 sm:text-sm"
                title="Download form template (QAF-OFD-038)"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
                </svg>
                Template
              </a>
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-200 sm:text-xs sm:tracking-[0.2em]">
                  Year
                </span>
                <select
                  className="min-w-[4.5rem] rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs leading-tight text-white focus:outline-none focus:ring-2 focus:ring-sky-500 sm:min-w-[5rem] sm:px-3 sm:py-2 sm:text-sm"
                  value={year}
                  onChange={(e) => handleYearChange(Number(e.target.value))}
                >
                  {getYears().map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Month Selector Bar */}
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300 text-center">
                Select Month Pair
              </p>
              <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                {MONTH_PAIRS.map((pair, index) => (
                  <button
                    key={pair.label}
                    type="button"
                    onClick={() => setSelectedPair(index)}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                      selectedPair === index
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40"
                        : "text-sky-200 hover:bg-white/10 border border-transparent"
                    } ${hasData && selectedPair === index ? "ring-2 ring-emerald-400/50" : ""}`}
                  >
                    {pair.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <div className="rounded-2xl border border-white/10 bg-[#0b2740]/80 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">
                    {MONTH_PAIRS[selectedPair].label} {year}
                  </h2>
                  <div className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                    <span className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
                      Status: Draft
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedPair > 0 && (
                    <button
                      type="button"
                      onClick={handlePrevPair}
                      className="px-3 py-1 rounded-lg border border-white/20 bg-white/5 text-xs font-semibold hover:bg-white/10 transition"
                    >
                      ← Prev
                    </button>
                  )}
                  {selectedPair < MONTH_PAIRS.length - 1 && (
                    <button
                      type="button"
                      onClick={handleNextPair}
                      className="px-3 py-1 rounded-lg border border-white/20 bg-white/5 text-xs font-semibold hover:bg-white/10 transition"
                    >
                      Next →
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor="planned-date" className="block text-sm font-semibold text-white/90">
                    Training Planned on :
                  </label>
                  <div className="relative">
                    <input
                      id="planned-date"
                      type="date"
                      value={currentPairData.plannedDate}
                      onChange={(e) => handleFieldChange("plannedDate", e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                    />
                    
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="instructor" className="block text-sm font-semibold text-white/90">
                    Instructor :
                  </label>
                  <input
                    id="instructor"
                    type="text"
                    value={currentPairData.instructor}
                    onChange={(e) => handleFieldChange("instructor", e.target.value)}
                    placeholder="Enter instructor name"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="topic" className="block text-sm font-semibold text-white/90">
                    Topic :
                  </label>
                  <input
                    id="topic"
                    type="text"
                    value={currentPairData.topic}
                    onChange={(e) => handleFieldChange("topic", e.target.value)}
                    placeholder="Enter training topic"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                  />
                </div>

                <div className="space-y-2 md:col-span-3">
                  <label htmlFor="description" className="block text-sm font-semibold text-white/90">
                    Description :
                  </label>
                  <textarea
                    id="description"
                    rows={2}
                    value={currentPairData.description}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    placeholder="Short description, target group, location, etc."
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Messages */}
            {error && (
              <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            {message && (
              <div className="text-base text-emerald-300 bg-emerald-950/40 border-2 border-emerald-500/60 rounded-lg px-6 py-4 shadow-lg shadow-emerald-500/20">
                <span className="font-semibold">{message}</span>
              </div>
            )}

            {/* Month Pair File Upload - only for selected month pair */}
            <div className="rounded-2xl border border-white/10 bg-[#0b2740]/80 p-6 space-y-4">
              <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                Training Matrix File Attachment
              </h3>
              {(() => {
                const pair = MONTH_PAIRS[selectedPair];
                const monthPairKey = pair.label.replace("–", "-");
                return (
                  <div className="space-y-2">
                    <label
                      htmlFor={`monthPair-${monthPairKey}`}
                      className="block text-xs font-semibold text-white/90"
                    >
                      {pair.label}:
                    </label>
                    <input
                      id={`monthPair-${monthPairKey}`}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleMonthPairFileChange(monthPairKey, file);
                      }}
                      className="w-full text-xs text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500 file:text-white hover:file:bg-sky-600 file:cursor-pointer cursor-pointer rounded-xl border border-white/15 bg-white/5 px-4 py-2 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                    />
                    {monthPairFiles[monthPairKey] && (
                      <p className="text-xs text-emerald-300 truncate">
                        ✓ {monthPairFiles[monthPairKey].name}
                      </p>
                    )}
                  </div>
                );
              })()}
              <p className="text-xs text-slate-400">
                Upload training matrix file for the selected month pair. Supported formats: PDF, Word, Excel, Images (max 25MB).
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="submit"
                disabled={!canSubmit || saving}
                className="px-6 py-3 rounded-xl bg-orange-500 text-sm font-semibold uppercase tracking-[0.2em] shadow-lg shadow-orange-500/40 hover:bg-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving
                  ? "Saving..."
                  : existingPlanId
                    ? `Update Plan for ${year}`
                    : `Submit Plan for ${year}`}
              </button>
            </div>
            </fieldset>
          </form>
        </div>
      </div>
  );

  if (hideSidebar) {
    return content;
  }

  return content;
}


