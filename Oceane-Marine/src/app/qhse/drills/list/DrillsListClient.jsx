"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQhseSidebar } from "../../QhseSidebarContext";
import { useQhseRole } from "@/hooks/useQhseRole";
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i < currentYear; i++) years.push(i);
  for (let i = currentYear; i <= currentYear + 5; i++) years.push(i);
  return years.sort((a, b) => b - a);
}

export default function DrillsListPage() {
  const { setPageLoading } = useQhseLoading();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [year, setYear] = useState("all"); // "all" or number
  const [availableYears, setAvailableYears] = useState(getYears());
  const [deletingId, setDeletingId] = useState(null);
  const [deletingReportId, setDeletingReportId] = useState(null);
  const [downloadingPlanDocx, setDownloadingPlanDocx] = useState(null);
  const [downloadingPlanPdf, setDownloadingPlanPdf] = useState(null);
  const [downloadingReportDocxId, setDownloadingReportDocxId] = useState(null);
  const [downloadingReportPdfId, setDownloadingReportPdfId] = useState(null);
  const [downloadingQuarterFile, setDownloadingQuarterFile] = useState(null);
  const { canDelete, canDownload } = useQhseRole();

  const handleDownloadQuarterFile = async (planId, quarter, fileName) => {
    if (!planId || !quarter) return;
    const key = `${planId}_${quarter}`;
    setDownloadingQuarterFile(key);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/drill/download/quarter-file?planId=${planId}&quarter=${quarter}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download matrix file");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `${quarter}-drill-matrix`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download matrix file");
    } finally {
      setDownloadingQuarterFile(null);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageLoading(true);
    setError("");
    try {
      const url =
        year === "all" || year == null
          ? "/api/qhse/drill/list"
          : `/api/qhse/drill/list?year=${year}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load drill data");
      }
      const list = data.data || [];
      setRows(list);
      if (year === "all" && list.length > 0) {
        const yearsFromData = [...new Set(list.map((r) => r.year))].filter(
          (y) => typeof y === "number" && !Number.isNaN(y)
        ).sort((a, b) => b - a);
        if (yearsFromData.length > 0) {
          setAvailableYears((prev) =>
            [...new Set([...prev, ...yearsFromData])].sort((a, b) => b - a)
          );
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load drill data");
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeletePlan = async (planId, year) => {
    if (!canDelete) return;
    if (!planId) return;
    if (!window.confirm(`Delete drill plan for ${year}? This cannot be undone.`)) return;
    setDeletingId(planId);
    setError("");
    try {
      const res = await fetch(`/api/qhse/drill/plan/${planId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete plan");
      setRows((prev) => prev.filter((r) => r.planId !== planId));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteReport = async (reportId, year, quarter) => {
    if (!canDelete) return;
    const id = reportId != null ? String(reportId) : null;
    if (!id) return;
    if (!window.confirm(`Delete drill report for ${year} ${quarter}? This cannot be undone.`)) return;
    setDeletingReportId(id);
    setError("");
    try {
      const res = await fetch(`/api/qhse/drill/report/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete report");
      setRows((prev) =>
        prev.map((row) => {
          if (row.year !== year) return row;
          return {
            ...row,
            quarters: (row.quarters || []).map((entry) => {
              if (entry.quarter !== quarter) return entry;
              if (String(entry.report?.id || entry.report?._id) !== id) return entry;
              return { ...entry, report: null };
            }),
          };
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingReportId(null);
    }
  };

  const handleDownloadPlanDocx = async (planId, year, serialNumber) => {
    if (!canDownload) return;
    if (!planId) return;
    setDownloadingPlanDocx(planId);
    try {
      const res = await fetch(`/api/qhse/drill/plan/${planId}/download`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Drill-Plan-${year ?? "plan"}-${serialNumber ?? planId}.docx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download Word");
    } finally {
      setDownloadingPlanDocx(null);
    }
  };

  const handleDownloadPlanPdf = async (planId, year, serialNumber) => {
    if (!canDownload) return;
    if (!planId) return;
    setDownloadingPlanPdf(planId);
    try {
      const res = await fetch(`/api/qhse/drill/plan/${planId}/download/pdf`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Drill-Plan-${year ?? "plan"}-${serialNumber ?? planId}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPlanPdf(null);
    }
  };

  const handleDownloadReportDocx = async (reportId, serialNumber) => {
    if (!canDownload) return;
    if (!reportId) return;
    setDownloadingReportDocxId(reportId);
    try {
      const res = await fetch(`/api/qhse/drill/report/${reportId}/download/docx`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Drill-Report-${serialNumber ?? reportId}.docx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download Word");
    } finally {
      setDownloadingReportDocxId(null);
    }
  };

  const handleDownloadReportPdf = async (reportId, serialNumber) => {
    if (!canDownload) return;
    if (!reportId) return;
    setDownloadingReportPdfId(reportId);
    try {
      const res = await fetch(`/api/qhse/drill/report/${reportId}/download/pdf`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Drill-Report-${serialNumber ?? reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download PDF");
    } finally {
      setDownloadingReportPdfId(null);
    }
  };

  const { contentClassName } = useQhseSidebar();
  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-10 space-y-4 sm:space-y-6">
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/dashboard"
            className="flex-shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / Drills
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Drill Plans & Reports</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Year-wise drill plans with quarter-wise reports
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/drills/create/plan"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
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
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                View List
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
            <select
              className="rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[5rem]"
              value={year === "all" ? "all" : year}
              onChange={(e) => {
                const v = e.target.value;
                setYear(v === "all" ? "all" : Number(v));
              }}
            >
              <option value="all">All years</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-sm text-slate-300">Loading...</div>
          ) : (() => {
            const quarterOrder = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
            const filteredRows = rows
              .map((yearRow) => {
                const quartersWithData = (yearRow.quarters || [])
                  .filter((entry) => {
                    const plan = entry.planItem;
                    const report = entry.report;
                    const hasPlanData =
                      plan &&
                      (plan.plannedDate ||
                        (plan.topic && plan.topic.trim()) ||
                        (plan.instructor && plan.instructor.trim()));
                    const hasReport = report && (report.drillNo || report.drillDate || report.status);
                    const hasQuarterFile = entry.quarterFile?.hasFile;
                    return hasPlanData || hasReport || hasQuarterFile;
                  })
                  .sort((a, b) => (quarterOrder[a.quarter] || 0) - (quarterOrder[b.quarter] || 0));
                return { ...yearRow, quartersWithData };
              })
              .filter((yearRow) => yearRow.quartersWithData.length > 0);
            if (filteredRows.length === 0) {
              return (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 md:p-8 text-center">
                  <p className="text-slate-300 mb-1">No drill plans or reports yet.</p>
                  <p className="text-sm text-slate-400">
                    Use &quot;Drill Matrix&quot; or &quot;Drill Report&quot; above to add entries; they will appear here.
                  </p>
                </div>
              );
            }
            return filteredRows.map((yearRow) => (
                <div
                  key={yearRow.year}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {yearRow.year}
                        {yearRow.formCode ? ` • ${yearRow.formCode}` : ""}
                        {yearRow.serialNumber ? ` • ${yearRow.serialNumber}` : ""}
                      </h2>
                      <p className="text-xs text-slate-300">
                        Plan & reports grouped by quarter
                      </p>
                    </div>
                    {yearRow.planId && (
                      <div className="flex items-center gap-2">
                        {canDownload && (
                        <button
                          type="button"
                          onClick={() => handleDownloadPlanDocx(yearRow.planId, yearRow.year, yearRow.serialNumber)}
                          disabled={downloadingPlanDocx === yearRow.planId || downloadingPlanPdf === yearRow.planId}
                          className="text-xs px-3 py-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 disabled:opacity-50 transition"
                        >
                          {downloadingPlanDocx === yearRow.planId ? "…" : "Word"}
                        </button>
                        )}
                        {canDownload && (
                        <button
                          type="button"
                          onClick={() => handleDownloadPlanPdf(yearRow.planId, yearRow.year, yearRow.serialNumber)}
                          disabled={downloadingPlanDocx === yearRow.planId || downloadingPlanPdf === yearRow.planId}
                          className="text-xs px-3 py-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 transition"
                        >
                          {downloadingPlanPdf === yearRow.planId ? "…" : "PDF"}
                        </button>
                        )}
                        {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeletePlan(yearRow.planId, yearRow.year)}
                          disabled={deletingId === yearRow.planId}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-400/50 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50 transition"
                        >
                          {deletingId === yearRow.planId ? "Deleting…" : "Delete plan"}
                        </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {yearRow.quartersWithData.map((entry) => {
                      const q = entry.quarter;
                      const plan = entry.planItem;
                      const report = entry.report;
                      return (
                        <div
                          key={q}
                          className="rounded-xl border border-white/10 bg-slate-900/40 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-white">
                              {q}
                            </div>
                            {plan?.status && (
                              <span className="text-[11px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200">
                                {plan.status}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 text-xs text-slate-300">
                            <div>
                              <span className="text-slate-400">Planned:</span>{" "}
                              {plan?.plannedDate
                                ? new Date(plan.plannedDate).toLocaleDateString()
                                : "—"}
                            </div>
                            <div>
                              <span className="text-slate-400">Topic:</span>{" "}
                              {plan?.topic || "—"}
                            </div>
                            <div>
                              <span className="text-slate-400">Instructor:</span>{" "}
                              {plan?.instructor || "—"}
                            </div>
                            {entry.quarterFile?.hasFile && canDownload && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDownloadQuarterFile(
                                      yearRow.planId,
                                      q,
                                      entry.quarterFile.fileName
                                    )
                                  }
                                  disabled={
                                    downloadingQuarterFile === `${yearRow.planId}_${q}`
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200 font-medium px-2 py-1 rounded border border-emerald-400/30 hover:bg-emerald-400/10 disabled:opacity-50 transition"
                                  title={
                                    entry.quarterFile.fileName || "Drill matrix"
                                  }
                                >
                                  {downloadingQuarterFile === `${yearRow.planId}_${q}`
                                    ? "…"
                                    : (
                                      <>
                                        <span>📎</span>
                                        <span className="max-w-[160px] truncate">
                                          {entry.quarterFile.fileName || "Drill matrix"}
                                        </span>
                                      </>
                                    )}
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="border-t border-white/10 pt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-400">
                                Report
                              </span>
                              {canDelete && (report?.id || report?._id) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteReport(
                                      report.id || report._id,
                                      yearRow.year,
                                      q
                                    )
                                  }
                                  disabled={
                                    deletingReportId === String(report.id || report._id)
                                  }
                                  className="text-[11px] px-2 py-1 rounded border border-red-400/50 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50 transition"
                                >
                                  {deletingReportId === String(report.id || report._id)
                                    ? "Deleting…"
                                    : "Delete report"}
                                </button>
                              )}
                            </div>
                            {report ? (
                              <div className="space-y-2">
                                <div className="space-y-1 text-xs text-slate-200">
                                  <div>
                                    <span className="text-slate-400">
                                      Drill No:
                                    </span>{" "}
                                    {report.drillNo}
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Date:</span>{" "}
                                    {report.drillDate
                                      ? new Date(
                                          report.drillDate
                                        ).toLocaleDateString()
                                      : "—"}
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Status:</span>{" "}
                                    {report.status || "—"}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {canDownload && (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadReportDocx(report.id || report._id, report.serialNumber)}
                                    disabled={downloadingReportDocxId === (report.id || report._id) || downloadingReportPdfId === (report.id || report._id)}
                                    className="text-xs text-sky-300 hover:text-sky-200 font-medium px-2 py-1 rounded border border-sky-400/30 hover:bg-sky-400/10 disabled:opacity-50 transition"
                                  >
                                    {downloadingReportDocxId === (report.id || report._id) ? "…" : "Word"}
                                  </button>
                                  )}
                                  {canDownload && (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadReportPdf(report.id || report._id, report.serialNumber)}
                                    disabled={downloadingReportDocxId === (report.id || report._id) || downloadingReportPdfId === (report.id || report._id)}
                                    className="text-xs text-rose-300 hover:text-rose-200 font-medium px-2 py-1 rounded border border-rose-400/30 hover:bg-rose-500/10 disabled:opacity-50 transition"
                                  >
                                    {downloadingReportPdfId === (report.id || report._id) ? "…" : "PDF"}
                                  </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400">
                                No report yet.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
          })()}
        </div>
      </div>
    </div>
  );
}
