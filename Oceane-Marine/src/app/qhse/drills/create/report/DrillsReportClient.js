"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useQhseRole } from "@/hooks/useQhseRole";

/* ---------------- helpers ---------------- */

// Generate dynamic years
function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i < currentYear; i++) years.push(i);
  for (let i = currentYear; i <= currentYear + 5; i++) years.push(i);
  return years;
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

// Normalize date to yyyy-mm-dd
const toDateInputValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
};

const getInitialFormData = (overrides = {}) => ({
  drillNo: "",
  drillDate: new Date().toISOString().slice(0, 10),
  location: "",
  drillScenario: "",
  participants: [{ name: "", role: "" }],
  incidentProgression: "",
  ...overrides,
});

/* ---------------- component ---------------- */

export default function DrillsReportClient() {
  const currentYear = new Date().getFullYear();
  const initialYears = getYears();

  const [availableYears, setAvailableYears] = useState(initialYears);
  const [loadingYears, setLoadingYears] = useState(true);
  const [year, setYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState(0);

  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [creatingFor, setCreatingFor] = useState(null);
  const [planApproving, setPlanApproving] = useState(false);
  const [planRejecting, setPlanRejecting] = useState(false);
  const [showPlanRejectModal, setShowPlanRejectModal] = useState(false);
  const [planRejectionReason, setPlanRejectionReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState(() => getInitialFormData());
  const [downloadingPlanDocx, setDownloadingPlanDocx] = useState(false);
  const [downloadingPlanPdf, setDownloadingPlanPdf] = useState(false);

  // Reports for the currently selected year, indexed by quarter (Q1..Q4).
  // Each entry holds the latest report for that quarter (used for download / status).
  const [reportsByQuarter, setReportsByQuarter] = useState({});
  const [reportsLoading, setReportsLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(null); // `${quarter}-docx` | `${quarter}-pdf`

  /* ---------------- effects ---------------- */

  useEffect(() => {
    const loadYears = async () => {
      setLoadingYears(true);
      try {
        const res = await fetch("/api/qhse/drill/plan");
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          const merged = Array.from(
            new Set([...initialYears, ...data.data])
          ).sort((a, b) => b - a);
          setAvailableYears(merged);
          if (!merged.includes(year)) setYear(merged[0]);
        }
      } finally {
        setLoadingYears(false);
      }
    };
    loadYears();
  }, []);

  useEffect(() => {
    let active = true;
    const fetchPlan = async () => {
      setPlanLoading(true);
      setPlanError(null);
      setCreatingFor(null);
      try {
        const res = await fetch(`/api/qhse/drill/plan?year=${year}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load drill plan");
        }
        if (active) setPlan(data.data);
      } catch (err) {
        if (active) {
          setPlan(null);
          setPlanError(err.message);
        }
      } finally {
        if (active) setPlanLoading(false);
      }
    };
    fetchPlan();
    return () => {
      active = false;
    };
  }, [year]);

  const handleApprovePlan = async () => {
    if (!canApprove || !plan?._id) return;
    if (!window.confirm(`Approve the Drill Plan for ${plan.year}?`)) return;
    setPlanApproving(true);
    setPlanError(null);
    try {
      const res = await fetch(`/api/qhse/drill/plan/${plan._id}/approve`, {
        method: "PUT",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to approve plan");
      setPlan(data.data);
      setMessage("Drill plan approved.");
    } catch (err) {
      setPlanError(err.message);
    } finally {
      setPlanApproving(false);
    }
  };

  const submitRejectPlan = async () => {
    if (!canApprove || !plan?._id) return;
    if (!planRejectionReason.trim()) return;
    setPlanRejecting(true);
    setPlanError(null);
    try {
      const res = await fetch(`/api/qhse/drill/plan/${plan._id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: planRejectionReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to reject plan");
      setPlan(data.data);
      setMessage("Drill plan rejected.");
      setShowPlanRejectModal(false);
      setPlanRejectionReason("");
    } catch (err) {
      setPlanError(err.message);
    } finally {
      setPlanRejecting(false);
    }
  };

  // Load existing reports for the selected year (latest per quarter).
  const loadReportsForYear = async (targetYear) => {
    if (!targetYear) {
      setReportsByQuarter({});
      return;
    }
    setReportsLoading(true);
    try {
      const res = await fetch(`/api/qhse/drill/list?year=${targetYear}`);
      const data = await res.json();
      const next = {};
      if (res.ok && data.success && Array.isArray(data.data)) {
        const yearRow = data.data.find((row) => row.year === targetYear);
        if (yearRow && Array.isArray(yearRow.quarters)) {
          yearRow.quarters.forEach((entry) => {
            if (entry?.report && entry.quarter) {
              next[entry.quarter] = entry.report;
            }
          });
        }
      }
      setReportsByQuarter(next);
    } catch {
      setReportsByQuarter({});
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    loadReportsForYear(year);
  }, [year]);

  /* ---------------- handlers ---------------- */

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleParticipantChange = (index, field, value) => {
    setFormData((prev) => {
      const participants = [...prev.participants];
      participants[index] = { ...participants[index], [field]: value };
      return { ...prev, participants };
    });
  };

  const addParticipant = () => {
    setFormData((prev) => ({
      ...prev,
      participants: [...prev.participants, { name: "", role: "" }],
    }));
  };

  const removeParticipant = (index) => {
    setFormData((prev) => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== index),
    }));
  };

  const applyPlanItem = (item) => {
    if (!item) return;
    const qIndex = QUARTERS.indexOf(item.quarter);
    if (qIndex >= 0) setSelectedQuarter(qIndex);
    // Reset form to empty for the new quarter, then apply only plan-derived fields
    setFormData(
      getInitialFormData({
        drillDate: toDateInputValue(item.plannedDate),
        drillScenario: item.topic || "",
      })
    );
    setCreatingFor(item);
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const validParticipants = (formData.participants || [])
        .map((p) => ({
          name: (p?.name || "").trim(),
          role: (p?.role || "").trim(),
        }))
        .filter((p) => p.name && p.role);

      if (
        !(formData.drillNo || "").trim() ||
        !(formData.drillScenario || "").trim() ||
        !formData.drillDate ||
        validParticipants.length === 0
      ) {
        throw new Error(
          "Please fill all required fields (Drill No, Date, Scenario, and at least one Participant with name & role)."
        );
      }

      const res = await fetch("/api/qhse/drill/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drillNo: (formData.drillNo || "").trim(),
          drillDate: formData.drillDate,
          location: (formData.location || "").trim(),
          drillScenario: (formData.drillScenario || "").trim(),
          incidentProgression: (formData.incidentProgression || "").trim(),
          participants: validParticipants,
          year,
          quarter: QUARTERS[selectedQuarter],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create drill report");
      }

      setMessage(
        `Drill report for ${year} ${QUARTERS[selectedQuarter]} saved successfully!`
      );
      // Reset the form, close it, and refresh the per-quarter report list
      setFormData(getInitialFormData());
      setCreatingFor(null);
      await loadReportsForYear(year);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadReport = async (quarter, format) => {
    const report = reportsByQuarter[quarter];
    const reportId = report?.id || report?._id;
    if (!reportId) return;
    const key = `${quarter}-${format}`;
    setDownloadingReport(key);
    try {
      const res = await fetch(
        `/api/qhse/drill/report/${reportId}/download/${format}`
      );
      if (!res.ok) throw new Error("Failed to download report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "pdf" ? "pdf" : "docx";
      a.download = `Drill-Report-${report?.serialNumber || reportId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download report");
    } finally {
      setDownloadingReport(null);
    }
  };

  /* ---------------- UI ---------------- */

  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = canCreate;

  const { contentClassName } = useQhseSidebar();
  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="w-full max-w-[95%] mx-auto pl-3 sm:pl-4 pr-0 sm:pr-0 py-6 sm:py-10 space-y-3 sm:space-y-4 md:space-y-6">
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
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Drill Report</h1>
            </div>
            <div className="flex w-full max-w-full flex-col items-center justify-center gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end sm:self-auto">
              <div className="inline-flex max-w-full flex-wrap justify-center rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                <Link
                  href="/qhse/drills/create/plan"
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
                >
                  Drill Matrix
                </Link>
                <Link
                  href="/qhse/drills/create/report"
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
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

          {/* Plan list and create-report trigger */}
          <div className="rounded-2xl border border-white/10 bg-[#0b2740]/70 p-4 space-y-3">
            <div className="flex items-center justify-end mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
                <select
                  className="rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[5rem]"
                  value={year || ""}
                  onChange={(e) => setYear(Number(e.target.value))}
                  disabled={loadingYears || availableYears.length === 0}
                >
                  {loadingYears ? (
                    <option>Loading...</option>
                  ) : availableYears.length === 0 ? (
                    <option>No data</option>
                  ) : (
                    availableYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))
                  )}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2 gap-3 flex-wrap">
              <h2 className="text-lg font-semibold">Quarterly Drill Plan</h2>
              <div className="flex items-center gap-3 flex-wrap">
                {plan && (
                  <>
                    <span className="text-xs px-2 py-1 rounded-lg border border-white/15 bg-white/5 text-slate-200">
                      Plan year: {plan.year}
                    </span>
                    {(plan.formCode || plan.serialNumber) && (
                      <span className="text-xs px-2 py-1 rounded-lg border border-white/15 bg-white/5 text-slate-200">
                        {[plan.formCode, plan.serialNumber].filter(Boolean).join(" • ")}
                      </span>
                    )}
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300 ml-1">
                      Drill Matrix:
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!plan._id) return;
                        setDownloadingPlanDocx(true);
                        try {
                          const res = await fetch(`/api/qhse/drill/plan/${plan._id}/download`);
                          if (!res.ok) throw new Error("Failed to download");
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `Drill-Matrix-${plan.year ?? "plan"}-${plan.serialNumber ?? plan._id}.docx`;
                          document.body.appendChild(a);
                          a.click();
                          URL.revokeObjectURL(url);
                          a.remove();
                        } catch (err) {
                          alert(err.message || "Failed to download Word");
                        } finally {
                          setDownloadingPlanDocx(false);
                        }
                      }}
                      disabled={downloadingPlanDocx || downloadingPlanPdf}
                      className="text-xs px-3 py-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 disabled:opacity-50 transition"
                      title="Download Drill Matrix as Word"
                    >
                      {downloadingPlanDocx ? "…" : "Word"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!plan._id) return;
                        setDownloadingPlanPdf(true);
                        try {
                          const res = await fetch(`/api/qhse/drill/plan/${plan._id}/download/pdf`);
                          if (!res.ok) throw new Error("Failed to download");
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `Drill-Matrix-${plan.year ?? "plan"}-${plan.serialNumber ?? plan._id}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          URL.revokeObjectURL(url);
                          a.remove();
                        } catch (err) {
                          alert(err.message || "Failed to download PDF");
                        } finally {
                          setDownloadingPlanPdf(false);
                        }
                      }}
                      disabled={downloadingPlanDocx || downloadingPlanPdf}
                      className="text-xs px-3 py-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 transition"
                      title="Download Drill Matrix as PDF"
                    >
                      {downloadingPlanPdf ? "…" : "PDF"}
                    </button>
                  </>
                )}
                {plan?.status === "Approved" && (
                  <span className="text-xs text-slate-300">
                    Select a quarter to create report
                  </span>
                )}
              </div>
            </div>

            {plan && plan.status && plan.status !== "Approved" && (
              <div
                className={`rounded-xl border px-4 py-3 text-left space-y-2 ${
                  plan.status === "Pending Approval"
                    ? "border-amber-400/40 bg-amber-500/10"
                    : "border-red-400/40 bg-red-500/10"
                }`}
              >
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    plan.status === "Pending Approval" ? "text-amber-200" : "text-red-200"
                  }`}
                >
                  {plan.status === "Pending Approval" ? "Pending your approval" : "Rejected"}
                </span>
                {plan.status === "Rejected" && plan.rejectionReason && (
                  <p className="text-xs text-red-100">Reason: {plan.rejectionReason}</p>
                )}
                {plan.status === "Pending Approval" && canApprove && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleApprovePlan}
                      disabled={planApproving || planRejecting}
                      className="text-xs px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50 transition"
                    >
                      {planApproving ? "Approving…" : "Approve plan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPlanRejectModal(true)}
                      disabled={planApproving || planRejecting}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50 transition"
                    >
                      Reject plan
                    </button>
                  </div>
                )}
                {plan.status === "Pending Approval" && !canApprove && (
                  <p className="text-xs text-amber-100">
                    Waiting for a QHSE approver to review this plan.
                  </p>
                )}
              </div>
            )}

            {showPlanRejectModal && (
              <div className="rounded-xl border border-red-400/40 bg-red-950/30 px-4 py-3 text-left space-y-2">
                <label className="block text-xs font-semibold text-red-200">
                  Rejection reason
                </label>
                <textarea
                  value={planRejectionReason}
                  onChange={(e) => setPlanRejectionReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/40"
                  placeholder="Explain why this plan is being rejected…"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlanRejectModal(false);
                      setPlanRejectionReason("");
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitRejectPlan}
                    disabled={planRejecting || !planRejectionReason.trim()}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-400/50 bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition"
                  >
                    {planRejecting ? "Rejecting…" : "Confirm reject"}
                  </button>
                </div>
              </div>
            )}

            {planLoading && (
              <p className="text-sm text-slate-200">Loading plan…</p>
            )}
            {planError && (
              <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                {planError}
              </div>
            )}
            {plan && plan.year !== year && (
              <div className="text-sm text-amber-200 bg-amber-950/40 border border-amber-500/40 rounded-lg px-4 py-2">
                Plan year ({plan.year}) differs from selected year ({year}).
                Switch the selector to match.
              </div>
            )}
            {plan && plan.status === "Approved" && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {QUARTERS.map((q) => {
                  const item = plan.planItems.find((p) => p.quarter === q);
                  const savedReport = reportsByQuarter[q];
                  const reportId = savedReport?.id || savedReport?._id;
                  const docxKey = `${q}-docx`;
                  const pdfKey = `${q}-pdf`;
                  return (
                    <div
                      key={q}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{q}</span>
                        <span className="text-xs text-slate-300">
                          {item ? toDateInputValue(item.plannedDate) : "—"}
                        </span>
                      </div>
                      <p className="text-sm text-white/90">
                        {item?.topic || "No plan"}
                      </p>
                      <p className="text-xs text-slate-300">
                        {item?.instructor || ""}
                      </p>

                      {/* Saved drill report (if any) for this quarter */}
                      {savedReport && (
                        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-2 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] uppercase tracking-[0.18em] text-emerald-200">
                              Drill Report
                            </span>
                            {savedReport.serialNumber && (
                              <span className="text-[11px] text-emerald-100/90 truncate">
                                {savedReport.serialNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300 truncate">
                            {savedReport.drillNo
                              ? `No: ${savedReport.drillNo}`
                              : ""}
                            {savedReport.drillDate
                              ? ` • ${toDateInputValue(savedReport.drillDate)}`
                              : ""}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDownloadReport(q, "docx")}
                              disabled={!reportId || !!downloadingReport}
                              className="flex-1 text-[11px] px-2 py-1 rounded border border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 disabled:opacity-50 transition"
                              title="Download Drill Report as Word"
                            >
                              {downloadingReport === docxKey ? "…" : "Word"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadReport(q, "pdf")}
                              disabled={!reportId || !!downloadingReport}
                              className="flex-1 text-[11px] px-2 py-1 rounded border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 transition"
                              title="Download Drill Report as PDF"
                            >
                              {downloadingReport === pdfKey ? "…" : "PDF"}
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!item}
                        onClick={() => item && applyPlanItem(item)}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-orange-400/60 text-orange-200 hover:bg-orange-500/10 disabled:opacity-50"
                      >
                        {item
                          ? savedReport
                            ? "Add another report"
                            : "Create report"
                          : "Not planned"}
                      </button>
                    </div>
                  );
                })}
                {reportsLoading && (
                  <p className="text-[11px] text-slate-400 col-span-full text-right">
                    Loading reports…
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Quarter File Downloads Section */}
          {plan && plan.quarterFiles && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 space-y-4">
              <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                Drill Matrix Files (Quarter-wise)
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {QUARTERS.map((quarter) => {
                  const quarterFile = plan.quarterFiles?.[quarter];
                  if (!quarterFile || !quarterFile.filePath) return null;

                  return (
                    <div
                      key={quarter}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">
                          {quarter}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {quarterFile.fileName || "Drill Matrix"}
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              `/api/qhse/drill/download/quarter-file?planId=${plan._id}&quarter=${quarter}`
                            );
                            if (!res.ok) {
                              let msg = "Failed to download file";
                              try {
                                const data = await res.json();
                                msg = data.error || msg;
                              } catch {
                                /* ignore */
                              }
                              throw new Error(msg);
                            }
                            const blob = await res.blob();
                            const url = globalThis.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download =
                              quarterFile.fileName ||
                              `drill-matrix-${quarter}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            globalThis.URL.revokeObjectURL(url);
                            a.remove();
                          } catch (err) {
                            alert(err.message || "Failed to download file");
                          }
                        }}
                        className="w-full text-xs text-sky-300 hover:text-sky-200 font-medium px-3 py-2 rounded border border-sky-400/30 hover:bg-sky-400/10 transition"
                      >
                        📥 Download {quarter} File
                      </button>
                    </div>
                  );
                })}
              </div>
              {!QUARTERS.some(
                (q) => plan.quarterFiles?.[q]?.filePath
              ) && (
                <p className="text-xs text-slate-400 text-center py-4">
                  No drill matrix files uploaded for this plan.
                </p>
              )}
            </div>
          )}

          {/* Top-level save messages — shown above the form so they remain visible after the form closes */}
          {(message || error) && (
            <div className="space-y-3">
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
            </div>
          )}

          {creatingFor && (
            <>
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-6"
            >
              {!canSubmit && (
                <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
                  You do not have permission to create records. Form is view-only.
                </div>
              )}
              <fieldset disabled={!canSubmit} className="border-0 p-0 m-0 min-w-0 space-y-6 disabled:opacity-[0.88]">
              {/* Form Fields */}
              <div className="rounded-2xl border border-white/10 bg-[#0b2740]/80 p-6 space-y-6">
                {/* General Details Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">➕</span>
                      <h2 className="text-lg font-semibold">
                        Drill report details
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreatingFor(null)}
                      className="text-xs text-slate-200 hover:text-white"
                    >
                      ✕ Close
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        htmlFor="drill-no"
                        className="block text-sm font-semibold text-white/90"
                      >
                        Drill No. :
                      </label>
                      <input
                        id="drill-no"
                        type="text"
                        value={formData.drillNo}
                        onChange={(e) =>
                          handleFieldChange("drillNo", e.target.value)
                        }
                        placeholder="e.g., 006-2025"
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="drill-date"
                        className="block text-sm font-semibold text-white/90"
                      >
                        Drill Date :
                      </label>
                      <input
                        id="drill-date"
                        type="date"
                        value={formData.drillDate}
                        onChange={(e) =>
                          handleFieldChange("drillDate", e.target.value)
                        }
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="location"
                        className="block text-sm font-semibold text-white/90"
                      >
                        Location :
                      </label>
                      <input
                        id="location"
                        type="text"
                        value={formData.location}
                        onChange={(e) =>
                          handleFieldChange("location", e.target.value)
                        }
                        placeholder="Location (e.g., Dubai D anchorage)"
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label
                        htmlFor="drill-scenario"
                        className="block text-sm font-semibold text-white/90"
                      >
                        Drill Scenario :
                      </label>
                      <input
                        id="drill-scenario"
                        type="text"
                        value={formData.drillScenario}
                        onChange={(e) =>
                          handleFieldChange("drillScenario", e.target.value)
                        }
                        placeholder="e.g., Fender Failure while approach"
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Participants Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h2 className="text-lg font-semibold">Participants</h2>
                    <button
                      type="button"
                      onClick={addParticipant}
                      className="px-3 py-1 rounded-lg border border-white/20 bg-white/5 text-xs font-semibold hover:bg-white/10 transition"
                    >
                      + Add Participant
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.participants.map((participant, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <div className="flex-1 grid gap-3 md:grid-cols-2">
                          <input
                            type="text"
                            value={participant.name}
                            onChange={(e) =>
                              handleParticipantChange(
                                index,
                                "name",
                                e.target.value
                              )
                            }
                            placeholder="Participant Name"
                            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                          />
                          <input
                            type="text"
                            value={participant.role}
                            onChange={(e) =>
                              handleParticipantChange(
                                index,
                                "role",
                                e.target.value
                              )
                            }
                            placeholder="Role (e.g., Designated Crisis Manager)"
                            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                          />
                        </div>
                        {formData.participants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeParticipant(index)}
                            className="px-3 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Incident Progression Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <h2 className="text-lg font-semibold">
                      Incident Progression :
                    </h2>
                  </div>

                  <textarea
                    rows={8}
                    value={formData.incidentProgression}
                    onChange={(e) =>
                      handleFieldChange("incidentProgression", e.target.value)
                    }
                    placeholder="Describe the incident progression in detail..."
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none resize-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="submit"
                  disabled={!canSubmit || saving}
                  className="px-6 py-3 rounded-xl bg-orange-500 text-sm font-semibold uppercase tracking-[0.2em] shadow-lg shadow-orange-500/40 hover:bg-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save Drill Report"}
                </button>
              </div>
              </fieldset>
            </form>
            </>
          )}
      </div>
    </div>
  );
}
