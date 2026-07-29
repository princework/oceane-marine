"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../QhseSidebarContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { saveAs } from "file-saver";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../utils/archive";
import { ViewIconButton, ArchiveIconButton, DeleteIconButton, DownloadIconButton } from "../components/ActionIcons";
import { TemplateDownloadLink } from "../components/TemplateDownloadLink";
import { QhseListPageContainer } from "../components/QhseListPageContainer";
import { useQhseRole } from "@/hooks/useQhseRole";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Generate dynamic years
function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i < currentYear; i++) years.push(i);
  for (let i = currentYear; i <= currentYear + 5; i++) years.push(i);
  return years;
}

export default function NearMissListPage() {
  const searchParams = useSearchParams();
  const reportFromUrl = searchParams.get("report");

  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const currentYear = new Date().getFullYear();
  const initialYears = getYears();
  
  const [nearMisses, setNearMisses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [downloadingDocxId, setDownloadingDocxId] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);
  const [remarksByReviewer, setRemarksByReviewer] = useState("");
  const [availableYears, setAvailableYears] = useState(initialYears);
  const [loadingYears, setLoadingYears] = useState(true);
  const [year, setYear] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch available years
  useEffect(() => {
    const loadYears = async () => {
      setLoadingYears(true);
      try {
        const res = await fetch("/api/near-miss-form/list");
        const data = await res.json();
        if (res.ok && Array.isArray(data.years)) {
          const merged = Array.from(
            new Set([...initialYears, ...data.years])
          ).sort((a, b) => b - a);
          setAvailableYears(merged);
        }
      } finally {
        setLoadingYears(false);
      }
    };
    loadYears();
  }, []);

  const fetchNearMisses = async (selectedReportId = null) => {
    setLoading(true);
    setPageLoading(true);
    setError(null);
    try {
      const url = year !== "" && year != null
        ? `/api/near-miss-form/list?year=${year}`
        : "/api/near-miss-form/list";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load near-miss reports");
      }
      setNearMisses(data.nearMisses || []);
      // If selected report ID is provided, update it with fresh data
      if (selectedReportId) {
        const updated = data.nearMisses.find((r) => r._id === selectedReportId);
        if (updated) {
          setSelectedReport(updated);
          setRemarksByReviewer(updated.remarksByReviewer || "");
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchNearMisses();
  }, [year]);

  useEffect(() => {
    if (!reportFromUrl || loading || nearMisses.length === 0) return;
    const r = nearMisses.find((x) => String(x._id) === String(reportFromUrl));
    if (r) {
      setSelectedReport(r);
      setRemarksByReviewer(r?.remarksByReviewer || "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [reportFromUrl, nearMisses, loading]);

  /** Email links include `?report=id`; if year filter hides that row, load all years once. */
  useEffect(() => {
    if (!reportFromUrl || loading) return;
    const found = nearMisses.some((x) => String(x._id) === String(reportFromUrl));
    if (!found && nearMisses.length > 0 && year !== "") {
      setYear("");
    }
  }, [reportFromUrl, loading, nearMisses, year]);

  const searchFiltered = !searchTerm.trim()
    ? nearMisses
    : nearMisses.filter((r) => {
        const s = searchTerm.toLowerCase();
        return (r.serialNumber || "").toLowerCase().includes(s)
          || (r.formCode || "").toLowerCase().includes(s)
          || (r.JobRefNo || "").toLowerCase().includes(s)
          || (r.VesselName || "").toLowerCase().includes(s)
          || (r.NameOfObserver || "").toLowerCase().includes(s)
          || (r.TypeOfReporting || "").toLowerCase().includes(s);
      });
  const totalPages = Math.ceil(searchFiltered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentReports = searchFiltered.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setRemarksByReviewer(report?.remarksByReviewer || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleArchive = async (report) => {
    if (!canEdit) return;
    if (!confirm("Archive this report? It will be stored in QHSE Archive (Near Miss).")) return;
    setArchivingId(report._id);
    setError(null);
    try {
      const payload = buildArchivePayload(ARCHIVE_MODULES.NEAR_MISS, report, report.description || report.formCode, report.formCode);
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setNearMisses((prev) => prev.filter((r) => r._id !== report._id));
      if (selectedReport?._id === report._id) setSelectedReport(null);
    } catch (err) {
      setError(err.message || "Failed to archive");
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (report) => {
    if (!canDelete) return;
    if (!confirm("Are you sure you want to delete this report? This cannot be undone.")) return;
    setDeleting(report._id);
    setError(null);
    try {
      const res = await fetch(`/api/near-miss-form/${report._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setNearMisses((prev) => prev.filter((r) => r._id !== report._id));
      if (selectedReport?._id === report._id) setSelectedReport(null);
    } catch (err) {
      setError(err.message || "Failed to delete report");
    } finally {
      setDeleting(null);
    }
  };

  const handleDownloadWord = async (report) => {
    setDownloadingDocxId(report._id);
    setError(null);
    try {
      const res = await fetch(`/api/near-miss-form/${report._id}/docx`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Download failed");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition");
      const match = disp && disp.match(/filename="?([^";]+)"?/);
      const fileName = match ? match[1].trim() : `Near-Miss-${report.serialNumber || report._id}.docx`;
      saveAs(blob, fileName);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingDocxId(null);
    }
  };

  const handleDownloadPdf = async (report) => {
    setDownloadingPdfId(report._id);
    setError(null);
    try {
      const res = await fetch(`/api/near-miss-form/${report._id}/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "PDF download failed");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition");
      const match = disp && disp.match(/filename="?([^";]+)"?/);
      const fileName = match
        ? match[1].trim()
        : `Near-Miss-${report.serialNumber || report._id}.pdf`;
      saveAs(blob, fileName);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleStatusClick = async (reportId, currentStatus) => {
    if (!canApprove) return;
    if (currentStatus === "Reviewed") return;
    
    setUpdatingStatus(reportId);
    setError(null);
    try {
      const res = await fetch(`/api/near-miss-form/${reportId}/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ remarksByReviewer: remarksByReviewer || "" }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status");
      }
      
      // Refresh the list to get updated data and preserve selected report
      await fetchNearMisses(reportId);
      
      // Don't clear remarks if this is the selected report - keep them visible
    } catch (err) {
      console.error("Status update error:", err);
      setError(err.message || "Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getTypeBadgeClass = (type) => {
    const typeMap = {
      "Near Miss": "bg-blue-500/15 text-blue-300 border border-blue-400/40",
      Injury: "bg-red-500/15 text-red-300 border border-red-400/40",
      Fatality: "bg-red-600/20 text-red-200 border border-red-500/50",
      Collision: "bg-orange-500/15 text-orange-300 border border-orange-400/40",
      Pollution: "bg-yellow-500/15 text-yellow-300 border border-yellow-400/40",
      "Contact Damage":
        "bg-purple-500/15 text-purple-300 border border-purple-400/40",
      "Best Practice":
        "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40",
    };
    return (
      typeMap[type] ||
      "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"
    );
  };

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
              QHSE / Near-Miss Reporting
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              Near-Miss & Incident Reports
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-015</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-015" />
          </div>
        </header>

        <QhseListPageContainer
          searchPlaceholder="Search by serial, job ref, vessel, observer, type..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          filterChildren={
            <>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
              <select
                className="theme-select rounded-full px-3 py-1 text-xs tracking-widest uppercase"
                value={year === null || year === undefined ? "" : year}
                onChange={(e) => {
                  const v = e.target.value;
                  setYear(v === "" ? "" : Number(v));
                }}
                disabled={loadingYears}
              >
                <option value="">All years</option>
                {loadingYears ? (
                  <option disabled>Loading…</option>
                ) : (
                  availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))
                )}
              </select>
            </>
          }
        >
        <main className="space-y-6">
          {/* Report Details - Only visible when a report is selected */}
          {selectedReport && (
          <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">Report Details</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedReport?.serialNumber
                    ? `Serial ${selectedReport.serialNumber} · ${selectedReport?.formCode || ""}`
                    : selectedReport?.formCode || "Select a report to view details"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {selectedReport &&
                  (selectedReport.status || "Under Review") === "Under Review" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusClick(
                          selectedReport._id,
                          selectedReport.status || "Under Review"
                        )
                      }
                      disabled={!canApprove || updatingStatus === selectedReport._id}
                      className="px-6 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold uppercase tracking-wider transition disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30"
                    >
                      {updatingStatus === selectedReport._id
                        ? "Marking as Reviewed..."
                        : "Mark as Reviewed"}
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition"
                  aria-label="Close details"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5">
              {/* First Row: ID, Date, Name of Observer, Position */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Serial No.
                  </label>
                  <div className="text-sm font-semibold text-white font-mono">
                    {selectedReport?.serialNumber || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Form Code
                  </label>
                  <div className="text-sm font-semibold text-white font-mono">
                    {selectedReport?.formCode || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Date
                  </label>
                  <div className="text-sm font-semibold text-white">
                    {selectedReport?.timeOfIncident
                      ? formatDateTime(selectedReport.timeOfIncident)
                      : "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Name of Observer
                  </label>
                  <div className="text-sm font-semibold text-white">
                    {selectedReport?.NameOfObserver || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Position
                  </label>
                  <div className="text-sm font-semibold text-white">
                    {selectedReport?.PositionOfObserver || "—"}
                  </div>
                </div>
              </div>

              {/* Second Row: Job Ref, Vessel Name, Type of Reporting, Email */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Job Ref #
                  </label>
                  <div className="text-sm font-semibold text-white">
                    {selectedReport?.JobRefNo || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Vessel Name
                  </label>
                  <div className="text-sm font-semibold text-white">
                    {selectedReport?.VesselName || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Type of Reporting
                  </label>
                  {selectedReport?.TypeOfReporting ? (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${getTypeBadgeClass(
                        selectedReport.TypeOfReporting
                      )}`}
                    >
                      {selectedReport.TypeOfReporting}
                    </span>
                  ) : (
                    <div className="text-sm text-slate-500">—</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Email
                  </label>
                  <div className="text-sm font-semibold text-white">
                    {selectedReport?.email || "—"}
                  </div>
                </div>
              </div>

              {/* Rest of the fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Area of Near Miss
                  </label>
                  <div className="text-sm font-semibold text-white">
                    {selectedReport?.AreaOfNearMiss || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Created At
                  </label>
                  <div className="text-sm font-semibold text-white">
                    {selectedReport?.createdAt
                      ? formatDateTime(selectedReport.createdAt)
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Description
                  </label>
                  <div className="text-sm text-slate-200 leading-relaxed bg-white/5 rounded-lg p-3 min-h-[60px]">
                    {selectedReport?.Description || "—"}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      Immediate Cause
                    </label>
                    <div className="text-sm text-slate-200 leading-relaxed bg-white/5 rounded-lg p-3 min-h-[60px]">
                      {selectedReport?.ImmediateCause || "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      Root Cause
                    </label>
                    <div className="text-sm text-slate-200 leading-relaxed bg-white/5 rounded-lg p-3 min-h-[60px]">
                      {selectedReport?.RootCause || "—"}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Corrective Action
                  </label>
                  <div className="text-sm text-slate-200 leading-relaxed bg-white/5 rounded-lg p-3 min-h-[60px]">
                    {selectedReport?.CorrectiveAction || "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Remarks by Reviewer
                  </label>
                  {selectedReport?.status === "Reviewed" ? (
                    <div className="text-sm text-slate-200 leading-relaxed bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 min-h-[60px]">
                      {selectedReport?.remarksByReviewer || "—"}
                    </div>
                  ) : (
                    <textarea
                      value={remarksByReviewer}
                      onChange={(e) => setRemarksByReviewer(e.target.value)}
                      placeholder="Enter remarks..."
                      className="w-full text-sm text-slate-200 bg-white/5 border border-white/10 rounded-lg p-3 min-h-[60px] focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
                      rows={3}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Table Section - Hidden when details are shown */}
          {!selectedReport && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-4">
            {error && (
              <p className="text-xs text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-sm text-slate-100">Loading reports…</div>
              </div>
            ) : searchFiltered.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-slate-100">
                  {searchTerm.trim() ? "No reports match your search." : (year !== "" && year != null ? `No near-miss reports found for ${year}.` : "No near-miss reports found.")}
                </p>
              </div>
            ) : (
              <>
                <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-200 border-b border-white/10">
                        <th className="py-3 pr-4 font-semibold">Serial</th>
                        <th className="py-3 pr-4 font-semibold">Form Code</th>
                        <th className="py-3 pr-4 font-semibold">Job Ref #</th>
                        <th className="py-3 pr-4 font-semibold">Vessel Name</th>
                        <th className="py-3 pr-4 font-semibold">Date</th>
                        <th className="py-3 pr-4 font-semibold">Observer</th>
                        <th className="py-3 pr-4 font-semibold">Type</th>
                        <th className="py-3 pr-4 font-semibold">Status</th>
                        <th className="py-3 pr-4 font-semibold text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentReports.map((report) => (
                        <tr
                          key={report._id}
                          className={`border-b border-white/5 hover:bg-white/5 transition ${
                            selectedReport?._id === report._id
                              ? "bg-orange-500/10"
                              : ""
                          }`}
                        >
                          <td className="py-3 pr-4">
                            <span className="font-mono text-emerald-300">
                              {report.serialNumber || "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="font-mono text-sky-300">
                              {report.formCode || "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            {report.JobRefNo || "—"}
                          </td>
                          <td className="py-3 pr-4">
                            {report.VesselName || "—"}
                          </td>
                          <td className="py-3 pr-4">
                            {formatDateTime(report.timeOfIncident)}
                          </td>
                          <td className="py-3 pr-4">
                            <div>
                              <div className="font-medium">
                                {report.NameOfObserver || "—"}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {report.PositionOfObserver || "—"}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${getTypeBadgeClass(
                                report.TypeOfReporting
                              )}`}
                            >
                              {report.TypeOfReporting || "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex items-center rounded-lg px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                                (report.status || "Under Review") ===
                                "Under Review"
                                  ? "bg-red-500/20 text-red-300 border border-red-400/50"
                                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/50"
                              }`}
                            >
                              {report.status || "Under Review"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3 text-right sm:py-3 sm:pr-4">
                            <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                              <DownloadIconButton
                                onClick={() => handleDownloadWord(report)}
                                disabled={
                                  archivingId === report._id ||
                                  deleting === report._id ||
                                  downloadingPdfId === report._id
                                }
                                loading={downloadingDocxId === report._id}
                                title="Download as Word"
                              />
                              <DownloadIconButton
                                onClick={() => handleDownloadPdf(report)}
                                disabled={
                                  archivingId === report._id ||
                                  deleting === report._id ||
                                  downloadingDocxId === report._id
                                }
                                loading={downloadingPdfId === report._id}
                                title="Download as PDF"
                                className="!text-rose-400 hover:!text-rose-300"
                              />
                              <ArchiveIconButton
                                onClick={() => handleArchive(report)}
                                disabled={!canEdit || archivingId === report._id || deleting === report._id}
                                loading={archivingId === report._id}
                              />
                              <DeleteIconButton
                                onClick={() => handleDelete(report)}
                                disabled={!canDelete || archivingId === report._id || deleting === report._id}
                                loading={deleting === report._id}
                              />
                              <ViewIconButton
                                onClick={() => handleViewDetails(report)}
                                title="View Details"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="text-xs text-slate-300">
                      Showing {startIndex + 1} to{" "}
                      {Math.min(endIndex, searchFiltered.length)} of{" "}
                      {searchFiltered.length} reports
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-white/90 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((page) => {
                            return (
                              page === 1 ||
                              page === totalPages ||
                              (page >= currentPage - 1 && page <= currentPage + 1)
                            );
                          })
                          .map((page, index, array) => {
                            const showEllipsisBefore =
                              index > 0 && array[index - 1] !== page - 1;
                            return (
                              <div key={page} className="flex items-center gap-1">
                                {showEllipsisBefore && (
                                  <span className="text-slate-400 px-1">…</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handlePageChange(page)}
                                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                                    currentPage === page
                                      ? "bg-orange-500 text-white border-orange-500"
                                      : "border-white/10 bg-white/5 text-white/90 hover:bg-white/10"
                                  }`}
                                >
                                  {page}
                                </button>
                              </div>
                            );
                          })}
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-white/90 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          )}
        </main>
        </QhseListPageContainer>
      </div>
    </div>
  );
}


