"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useQhseSidebar } from "../../../QhseSidebarContext";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";
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

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

// Normalize to yyyy-mm-dd without timezone shifting
function toDateInput(year, monthIndex, day = 1) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

// Get quarter start date based on year and quarter index
function getQuarterStartDate(year, quarterIndex) {
  const month = quarterIndex * 3; // Q1=0, Q2=3, Q3=6, Q4=9
  return toDateInput(year, month, 1);
}

// Normalize a stored plannedDate (ISO string/Date) to yyyy-mm-dd, no timezone shifting
function toDateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

const STATUS_BADGE_STYLES = {
  Draft: { dot: "bg-slate-400", pill: "border-slate-400/40 bg-slate-500/10 text-slate-200" },
  "Pending Approval": { dot: "bg-amber-400", pill: "border-amber-400/40 bg-amber-500/10 text-amber-200" },
  Approved: { dot: "bg-emerald-400", pill: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" },
  Rejected: { dot: "bg-red-400", pill: "border-red-400/40 bg-red-500/10 text-red-200" },
};

function StatusPill({ status }) {
  const label = status || "Draft";
  const style = STATUS_BADGE_STYLES[label] || STATUS_BADGE_STYLES.Draft;
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1 ${style.pill}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`}></span>
      <span className="text-xs font-semibold uppercase tracking-wide">Status: {label}</span>
    </div>
  );
}

export default function DrillsPlanPage({ hideSidebar = false }) {
  const currentYear = new Date().getFullYear();
  const initialYear = currentYear;

  const [year, setYear] = useState(initialYear);
  const [selectedQuarter, setSelectedQuarter] = useState(0); // 0-3 index
  const [quarterData, setQuarterData] = useState(() => {
    // Initialize all 4 quarters with empty data
    return QUARTERS.map((_, index) => ({
      plannedDate: getQuarterStartDate(initialYear, index),
      topic: "",
      instructor: "",
      description: "",
    }));
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [savedPlan, setSavedPlan] = useState(null);
  const [existingPlanId, setExistingPlanId] = useState(null);
  const [existingPlanStatus, setExistingPlanStatus] = useState(null);
  const [existingPlanRejectionReason, setExistingPlanRejectionReason] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [quarterFiles, setQuarterFiles] = useState({
    Q1: null,
    Q2: null,
    Q3: null,
    Q4: null,
  });

  useEffect(() => {
    let active = true;
    const loadPlanForYear = async () => {
      setLoadingPlan(true);
      setError(null);
      try {
        const res = await fetch(`/api/qhse/drill/plan?year=${year}&mine=1`);
        const data = await readJsonFromResponse(res);
        if (!active) return;

        if (res.ok && data.success && data.data) {
          const plan = data.data;
          setSavedPlan(plan);
          setExistingPlanId(plan._id);
          setExistingPlanStatus(plan.status || null);
          setExistingPlanRejectionReason(plan.rejectionReason || "");
          const next = QUARTERS.map((_, index) => ({
            plannedDate: getQuarterStartDate(year, index),
            topic: "",
            instructor: "",
            description: "",
          }));
          for (const item of plan.planItems || []) {
            const idx = QUARTERS.indexOf(item.quarter);
            if (idx >= 0) {
              next[idx] = {
                plannedDate: toDateInputValue(item.plannedDate) || getQuarterStartDate(year, idx),
                topic: item.topic || "",
                instructor: item.instructor || "",
                description: item.description || "",
              };
            }
          }
          setQuarterData(next);
        } else {
          setSavedPlan(null);
          setExistingPlanId(null);
          setExistingPlanStatus(null);
          setExistingPlanRejectionReason("");
          setQuarterData(
            QUARTERS.map((_, index) => ({
              plannedDate: getQuarterStartDate(year, index),
              topic: "",
              instructor: "",
              description: "",
            }))
          );
        }
      } catch {
        if (active) {
          setSavedPlan(null);
          setExistingPlanId(null);
          setExistingPlanStatus(null);
          setExistingPlanRejectionReason("");
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
    setMessage(null);
    setError(null);
  };

  const handleFieldChange = (field, value) => {
    setQuarterData((prev) => {
      const next = [...prev];
      next[selectedQuarter] = { ...next[selectedQuarter], [field]: value };
      return next;
    });
  };

  const handleNextQuarter = () => {
    if (selectedQuarter < QUARTERS.length - 1) {
      setSelectedQuarter(selectedQuarter + 1);
    }
  };

  const handlePrevQuarter = () => {
    if (selectedQuarter > 0) {
      setSelectedQuarter(selectedQuarter - 1);
    }
  };

  const handleQuarterFileChange = (quarter, file) => {
    setQuarterFiles((prev) => ({
      ...prev,
      [quarter]: file,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      // Map first to preserve the original quarter index, then filter out empty quarters.
      // This prevents a Q3/Q4 entry from being mis-labelled as Q1/Q2 when earlier
      // quarters are blank (since the API would otherwise infer the quarter from the
      // plannedDate, which the user may have edited).
      const planItems = quarterData
        .map((item, quarterIndex) => ({
          plannedDate: item.plannedDate,
          quarter: QUARTERS[quarterIndex],
          topic: (item.topic || "").trim(),
          instructor: (item.instructor || "").trim(),
          description: (item.description || "").trim() || undefined,
        }))
        .filter((item) => item.topic && item.instructor);

      if (!planItems.length) {
        setError("Please fill at least one quarter with Topic and Instructor.");
        setSaving(false);
        return;
      }

      // Create FormData for file uploads
      const formData = new FormData();
      formData.append("planItems", JSON.stringify(planItems));
      formData.append("year", year.toString());

      // Append quarter files if they exist
      Object.keys(quarterFiles).forEach((quarter) => {
        const file = quarterFiles[quarter];
        if (file) {
          formData.append(`quarterFile_${quarter}`, file);
        }
      });

      const isUpdate = Boolean(existingPlanId);
      const res = await fetch(
        isUpdate ? `/api/qhse/drill/plan/${existingPlanId}` : "/api/qhse/drill/plan",
        {
          method: isUpdate ? "PUT" : "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || (isUpdate ? "Failed to update drill plan" : "Failed to create drill plan")
        );
      }

      const plan = data.data;
      setSavedPlan(plan);
      setExistingPlanId(plan?._id || null);
      setExistingPlanStatus(plan?.status || null);
      setExistingPlanRejectionReason(plan?.rejectionReason || "");
      setMessage(
        isUpdate
          ? `Drill plan for ${year} resubmitted for approval`
          : `Drill plan for ${year} submitted for approval`
      );
      setError(null);
      setQuarterFiles({ Q1: null, Q2: null, Q3: null, Q4: null });

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
      setMessage(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!savedPlan?._id) return;
    setDownloadingDocx(true);
    try {
      const res = await fetch(`/api/qhse/drill/plan/${savedPlan._id}/download`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Drill-Plan-${savedPlan.year ?? "plan"}-${savedPlan.serialNumber ?? savedPlan._id}.docx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download Word");
    } finally {
      setDownloadingDocx(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!savedPlan?._id) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/qhse/drill/plan/${savedPlan._id}/download/pdf`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Drill-Plan-${savedPlan.year ?? "plan"}-${savedPlan.serialNumber ?? savedPlan._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const currentQuarterData = quarterData[selectedQuarter];
  const hasData =
    currentQuarterData.topic.trim() ||
    currentQuarterData.instructor.trim() ||
    currentQuarterData.description.trim();

  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = existingPlanId ? canEdit : canCreate;

  const content = (
    <div className="w-full max-w-[95%] mx-auto pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
      <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
        <Link
          href="/dashboard"
          className="hidden md:inline-flex flex-shrink-0 items-center gap-1.5 self-start px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
        >
          ← Dashboard
        </Link>
        <div className="flex w-full flex-1 flex-col items-center text-center sm:w-auto">
          <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
            QHSE / Drills
          </p>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Drill Plan</h1>
          <p className="text-xs sm:text-sm text-slate-200 mt-1">
            Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-040</span>
          </p>
        </div>
        <div className="flex w-full max-w-full flex-col items-center justify-center gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end sm:self-auto">
          <TemplateDownloadLink formCode="QAF-OFD-040" />
          <div className="inline-flex max-w-full flex-wrap justify-center rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
            <Link
              href="/qhse/drills/create/plan"
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
            >
              Drill Matrix
            </Link>
            <Link
              href="/qhse/drills/create/report"
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
            >
              Drill Report
            </Link>
            <Link
              href="/qhse/drills/list"
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
            >
              View List
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
              You do not have permission to {existingPlanId ? "update" : "create"} this drill plan. Form is view-only.
            </div>
          )}
          {existingPlanStatus === "Rejected" && existingPlanRejectionReason && (
            <div className="w-full rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-red-300/90 mb-1">
                Rejected — reason
              </p>
              <p className="whitespace-pre-wrap">{existingPlanRejectionReason}</p>
              <p className="mt-2 text-xs text-red-300/80">
                Update the plan below and resubmit for approval.
              </p>
            </div>
          )}
          {existingPlanStatus === "Pending Approval" && (
            <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
              This plan is pending approval. You can still edit and resubmit it.
            </div>
          )}
          <fieldset disabled={!canSubmit} className="border-0 p-0 m-0 min-w-0 space-y-6 disabled:opacity-[0.88]">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
              <select
                className="rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[5rem]"
                value={year}
                onChange={(e) => handleYearChange(Number(e.target.value))}
              >
                {getYears().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Quarter selector — centered on small screens (matches Training Matrix month pairs) */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300 text-center">
              Select Quarter
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-white/5 p-2 sm:p-1 sm:gap-1">
              {QUARTERS.map((quarter, index) => {
                const isSelected = selectedQuarter === index;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedQuarter(index)}
                    className={`min-w-[4.25rem] flex-1 px-3 py-3 sm:min-w-[80px] sm:flex-1 sm:px-4 rounded-lg text-sm font-semibold transition-all duration-150 ${
                      isSelected
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40"
                        : "text-sky-200 hover:bg-white/10 border border-transparent"
                    } ${
                      hasData && isSelected ? "ring-2 ring-emerald-400/50" : ""
                    }`}
                  >
                    {quarter}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Fields */}
          <div className="rounded-2xl border border-white/10 bg-[#0b2740]/80 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  {QUARTERS[selectedQuarter]} {year}
                </h2>
                <StatusPill status={existingPlanStatus} />
              </div>
              <div className="flex gap-2">
                {selectedQuarter > 0 && (
                  <button
                    type="button"
                    onClick={handlePrevQuarter}
                    className="px-3 py-1 rounded-lg border border-white/20 bg-white/5 text-xs font-semibold hover:bg-white/10 transition"
                  >
                    ← Prev
                  </button>
                )}
                {selectedQuarter < QUARTERS.length - 1 && (
                  <button
                    type="button"
                    onClick={handleNextQuarter}
                    className="px-3 py-1 rounded-lg border border-white/20 bg-white/5 text-xs font-semibold hover:bg-white/10 transition"
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label
                  htmlFor="planned-date"
                  className="block text-sm font-semibold text-white/90"
                >
                  Drill Planned on :
                </label>
                <div className="relative">
                  <input
                    id="planned-date"
                    type="date"
                    value={currentQuarterData.plannedDate}
                    onChange={(e) =>
                      handleFieldChange("plannedDate", e.target.value)
                    }
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                 
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="instructor"
                  className="block text-sm font-semibold text-white/90"
                >
                  Instructor :
                </label>
                <input
                  id="instructor"
                  type="text"
                  value={currentQuarterData.instructor}
                  onChange={(e) =>
                    handleFieldChange("instructor", e.target.value)
                  }
                  placeholder="Enter instructor name"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="topic"
                  className="block text-sm font-semibold text-white/90"
                >
                  Topic :
                </label>
                <input
                  id="topic"
                  type="text"
                  value={currentQuarterData.topic}
                  onChange={(e) => handleFieldChange("topic", e.target.value)}
                  placeholder="Enter drill topic"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                />
              </div>

              <div className="space-y-2 md:col-span-3">
                <label
                  htmlFor="description"
                  className="block text-sm font-semibold text-white/90"
                >
                  Description :
                </label>
                <textarea
                  id="description"
                  rows={4}
                  value={currentQuarterData.description}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                  placeholder="Enter drill description"
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

          {/* Quarter File Upload - keyed by quarter so input shows correct file per Q */}
          <div className="rounded-2xl border border-white/10 bg-[#0b2740]/80 p-6 space-y-4">
            <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
              Drill Matrix File Attachment
            </h3>
            {QUARTERS.map((q, idx) => {
              const isActive = idx === selectedQuarter;
              const fileForQuarter = quarterFiles[q];
              return (
                <div
                  key={q}
                  className={`space-y-2 ${!isActive ? "hidden" : ""}`}
                  aria-hidden={!isActive}
                >
                  <label
                    htmlFor={`quarter-file-${q}`}
                    className="block text-xs font-semibold text-white/90"
                  >
                    {q}:
                  </label>
                  <input
                    id={`quarter-file-${q}`}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      handleQuarterFileChange(q, file);
                    }}
                    className="w-full text-xs text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500 file:text-white hover:file:bg-sky-600 file:cursor-pointer cursor-pointer rounded-xl border border-white/15 bg-white/5 px-4 py-2 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                  />
                  {fileForQuarter ? (
                    <p className="text-xs text-emerald-300 truncate">
                      ✓ {fileForQuarter.name}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">No file chosen for {q}</p>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-slate-400">
              Upload drill matrix file for the selected quarter. Supported formats: PDF, Word, Excel, Images (max 25MB).
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            {savedPlan && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadDocx}
                  disabled={downloadingDocx || downloadingPdf}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-200 text-sm font-semibold hover:bg-sky-500/20 transition disabled:opacity-50"
                >
                  {downloadingDocx ? "…" : "Word"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloadingDocx || downloadingPdf}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-200 text-sm font-semibold hover:bg-rose-500/20 transition disabled:opacity-50"
                >
                  {downloadingPdf ? "…" : "PDF"}
                </button>
              </>
            )}
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 text-sm font-semibold uppercase tracking-[0.2em] shadow-lg shadow-orange-500/40 hover:bg-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span>✉️✓→</span>
              <span>
                {saving
                  ? "Saving..."
                  : existingPlanId
                    ? "Resubmit for Approval"
                    : "Send for Approval"}
              </span>
            </button>
          </div>
          </fieldset>
        </form>
    </div>
  );

  const { contentClassName } = useQhseSidebar();
  if (hideSidebar) {
    return content;
  }

  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>{content}</div>
  );
}
