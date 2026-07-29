"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import Link from "next/link";
import { saveAs } from "file-saver";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../../utils/archive";
import {
  ArchiveIconButton,
  DeleteIconButton,
  DownloadIconButton,
  EditIconButton,
  ViewIconButton,
} from "../../../components/ActionIcons";
import { QhseListPageContainer } from "../../../components/QhseListPageContainer";
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

// Generate dynamic years
function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i < currentYear; i++) years.push(i);
  for (let i = currentYear; i <= currentYear + 5; i++) years.push(i);
  return years;
}

export default function DefectListPage() {
  const searchParams = useSearchParams();
  const defectFromUrl = searchParams.get("defect");

  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canCreate, canEdit, canDelete, canApprove, canDownload } = useQhseRole();
  const currentYear = new Date().getFullYear();
  const initialYears = getYears();
  
  const [defects, setDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const [exportingPdfId, setExportingPdfId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [availableYears, setAvailableYears] = useState(initialYears);
  const [loadingYears, setLoadingYears] = useState(true);
  const [year, setYear] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [viewDefect, setViewDefect] = useState(null);

  // Fetch available years
  useEffect(() => {
    const loadYears = async () => {
      setLoadingYears(true);
      try {
        const res = await fetch("/api/qhse/defects-list/list");
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

  const fetchDefects = async () => {
    setLoading(true);
    setPageLoading(true);
    setError(null);
    try {
      const url = year !== "" && year != null
        ? `/api/qhse/defects-list/list?year=${year}`
        : "/api/qhse/defects-list/list";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load defects list");
      }
      setDefects(data.equipmentDefects || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchDefects();
  }, [year]);

  /** Email deep link: if year filter hides the row, reload all years once. */
  useEffect(() => {
    if (!defectFromUrl || loading) return;
    const found = defects.some((d) => String(d._id) === String(defectFromUrl));
    if (!found && defects.length > 0 && year !== "") {
      setYear("");
    }
  }, [defectFromUrl, loading, defects, year]);

  const handleDownloadWord = async (defect) => {
    if (!canDownload) return;
    setExportingId(defect._id);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/defects-list/${defect._id}/docx`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Download failed");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition");
      const match = disp && disp.match(/filename="?([^";]+)"?/);
      const fileName = match ? match[1].trim() : `Defect-${defect.serialNumber || defect._id}.docx`;
      saveAs(blob, fileName);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportingId(null);
    }
  };

  const handleDownloadPdf = async (defect) => {
    if (!canDownload) return;
    setExportingPdfId(defect._id);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/defects-list/${defect._id}/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "PDF download failed");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition");
      const match = disp && disp.match(/filename="?([^";]+)"?/);
      const fileName = match
        ? match[1].trim()
        : `Defect-${defect.serialNumber || defect._id}.pdf`;
      saveAs(blob, fileName);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportingPdfId(null);
    }
  };

  const handleStatusChange = async (id, newStatus, { closeDetailModal = false } = {}) => {
    if (!canApprove) return;
    setActionLoadingId(id);
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/defects-list/${id}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status");
      }
      setActionMessage("Defect closed successfully.");
      await fetchDefects();
      if (closeDetailModal) setViewDefect(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  function statusBadgeClass(status) {
    const s = status || "Open";
    if (s === "Closed") return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30";
    if (s === "In Progress") return "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/30";
    return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30";
  }

  const handleDelete = async (id) => {
    if (!canDelete) return;
    if (!confirm("Are you sure you want to delete this defect? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/qhse/defects-list/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setDefects((prev) => prev.filter((d) => d._id !== id));
      setActionMessage("Defect deleted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleArchive = async (defect) => {
    if (!confirm("Archive this defect? It will be stored in QHSE Archive (Equipment Defects).")) return;
    setArchivingId(defect._id);
    setError(null);
    setActionMessage(null);
    try {
      const payload = buildArchivePayload(ARCHIVE_MODULES.EQUIPMENT_DEFECTS, defect, defect.equipmentDefect || defect.formCode, defect.formCode);
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setDefects((prev) => prev.filter((d) => d._id !== defect._id));
      setActionMessage("Defect archived successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDownload = async (defectId, index, filename) => {
    setDownloading(defectId);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/defects-list/${defectId}/download?index=${index}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `attachment-${index}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const handleBulkDownloadPdf = async () => {
    setBulkDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ module: "defects-list" });
      if (year !== "" && year != null) params.append("year", String(year));
      const res = await fetch(`/api/qhse/bulk-download-pdf?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate PDF");
      }
      const blob = await res.blob();
      saveAs(blob, `Defects-List${year ? `-${year}` : "-All"}.pdf`);
    } catch (err) {
      setError(err.message || "Failed to download PDF");
    } finally {
      setBulkDownloading(false);
    }
  };

  const searchFilteredDefects = useMemo(() => {
    if (!searchTerm.trim()) return defects;
    const s = searchTerm.toLowerCase();
    return defects.filter(
      (d) =>
        (d.serialNumber || "").toLowerCase().includes(s) ||
        (d.formCode || "").toLowerCase().includes(s) ||
        (d.equipmentDefect || "").toLowerCase().includes(s) ||
        (d.base || "").toLowerCase().includes(s)
    );
  }, [defects, searchTerm]);

  const defectListPagination = useOperationsClientPagination(
    searchFilteredDefects,
    `${searchTerm}|${year}|${defects.length}`
  );
  const {
    paginatedItems: paginatedDefectRows,
    setPage: setDefectListPage,
    pageSize: defectListPageSize,
    ...defectListPaginationFooterProps
  } = defectListPagination;

  useEffect(() => {
    if (!defectFromUrl || loading) return;
    const idx = searchFilteredDefects.findIndex(
      (d) => String(d._id) === String(defectFromUrl)
    );
    if (idx < 0) return;
    const targetPage = Math.floor(idx / defectListPageSize) + 1;
    setDefectListPage(targetPage);
  }, [
    defectFromUrl,
    loading,
    searchFilteredDefects,
    defectListPageSize,
    setDefectListPage,
  ]);

  useEffect(() => {
    if (!defectFromUrl || loading || searchFilteredDefects.length === 0) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`defect-row-${defectFromUrl}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [defectFromUrl, loading, paginatedDefectRows, searchFilteredDefects.length]);

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
              QHSE / Defects List
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Equipment Defects List</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-025</span>
              {" – "}
              Equipment Defect list
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <a
              href="/templates/controlled-register/QAF-OFD-025.xlsx"
              download
              className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
              title="Download form template (QAF-OFD-025)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
              </svg>
              Template
            </a>
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/defects-list/create/plan"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Create Defect
              </Link>
              <Link
                href="/qhse/defects-list/create/list"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Defect List
              </Link>
            </div>
          </div>
        </header>

        <QhseListPageContainer
          searchPlaceholder="Search by serial, form code, defect, base..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          filterChildren={
            <>
              <div className="flex w-full min-w-0 flex-nowrap items-center justify-center gap-2 sm:inline-flex sm:w-auto sm:max-w-none">
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
                  <select
                    className="theme-select max-w-[9rem] rounded-full px-3 py-1 text-xs tracking-widest uppercase sm:max-w-none"
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
                </div>
                <button
                  type="button"
                  onClick={handleBulkDownloadPdf}
                  disabled={bulkDownloading}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50 sm:px-3 sm:text-xs"
                  title="Download overall defects as a single PDF"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
                  </svg>
                  {bulkDownloading ? "Generating..." : "Download overall defects"}
                </button>
              </div>
            </>
          }
        >
          {error && (
            <p className="text-xs text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {actionMessage && (
            <p className="text-xs text-emerald-200 bg-emerald-950/40 border border-emerald-500/40 rounded-lg px-3 py-2">
              {actionMessage}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-slate-100">Loading defects…</p>
          ) : searchFilteredDefects.length === 0 ? (
              <p className="text-sm text-slate-100">
                {searchTerm.trim() ? "No defects match your search." : (year !== "" && year != null ? `No equipment defects found for ${year}.` : "No equipment defects found.")}
              </p>
            ) : (
              <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-200 border-b border-white/10">
                      <th className="py-2 pr-4">Form Code</th>
                      <th className="hidden py-2 pr-4 md:table-cell">Serial</th>
                      <th className="py-2 pr-4">Equipment Defect</th>
                      <th className="py-2 pr-4">Base</th>
                      <th className="py-2 pr-4">Target Date</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Completion Date</th>
                      <th className="py-2 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDefectRows.map((defect) => (
                      <tr
                        key={defect._id}
                        id={`defect-row-${defect._id}`}
                        className="border-b border-white/5 hover:bg-white/5"
                      >
                        <td className="py-2 pr-4 font-mono text-sky-300">
                          {defect.formCode || "QAF-OFD-025"}
                        </td>
                        <td className="hidden py-2 pr-4 font-mono text-slate-200 md:table-cell">
                          {defect.serialNumber || "—"}
                        </td>
                        <td className="py-2 pr-4 max-w-xs">
                          <p className="line-clamp-2">
                            {defect.equipmentDefect}
                          </p>
                        </td>
                        <td className="py-2 pr-4">{defect.base}</td>
                        <td className="py-2 pr-4">
                          {formatDate(defect.targetDate)}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(defect.status)}`}
                          >
                            {defect.status || "Open"}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          {formatDate(defect.completionDate)}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-right sm:pr-4">
                          <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                            <ViewIconButton
                              title="View defect"
                              onClick={() => setViewDefect(defect)}
                            />
                            {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadWord(defect)}
                                disabled={
                                  archivingId === defect._id ||
                                  deletingId === defect._id ||
                                  exportingPdfId === defect._id
                                }
                                loading={exportingId === defect._id}
                                title="Download as Word"
                              />
                            )}
                            {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadPdf(defect)}
                                disabled={
                                  archivingId === defect._id ||
                                  deletingId === defect._id ||
                                  exportingId === defect._id
                                }
                                loading={exportingPdfId === defect._id}
                                title="Download as PDF"
                                className="!text-rose-400 hover:!text-rose-300"
                              />
                            )}
                            {canEdit && (
                              <EditIconButton href={`/qhse/defects-list/create?edit=${defect._id}`} />
                            )}
                            <ArchiveIconButton
                              onClick={() => handleArchive(defect)}
                              disabled={archivingId === defect._id || deletingId === defect._id}
                              loading={archivingId === defect._id}
                            />
                            {canDelete && (
                              <DeleteIconButton
                                onClick={() => handleDelete(defect._id)}
                                disabled={archivingId === defect._id || deletingId === defect._id}
                                loading={deletingId === defect._id}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <OperationsListPaginationFooter {...defectListPaginationFooterProps} />
              </div>
            )}
        </QhseListPageContainer>
      </div>

      {viewDefect && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="defect-detail-title"
        >
          <div className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#0f172a] shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0f172a]/95 px-5 py-4 backdrop-blur-sm">
              <div>
                <h2 id="defect-detail-title" className="text-base font-bold text-white">
                  Defect details
                </h2>
                <p className="mt-0.5 font-mono text-xs text-sky-300">
                  {viewDefect.serialNumber || "—"} · {viewDefect.formCode || "QAF-OFD-025"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewDefect(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm text-slate-200">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</p>
                <span
                  className={`mt-1 inline-flex rounded-lg px-2 py-1 text-xs font-semibold uppercase ${statusBadgeClass(viewDefect.status)}`}
                >
                  {viewDefect.status || "Open"}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Equipment defect</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-100">{viewDefect.equipmentDefect || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Base</p>
                <p className="mt-1">{viewDefect.base || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Action required</p>
                <p className="mt-1 whitespace-pre-wrap">{viewDefect.actionRequired || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Target date</p>
                  <p className="mt-1">{formatDate(viewDefect.targetDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Completion date</p>
                  <p className="mt-1">{formatDate(viewDefect.completionDate)}</p>
                </div>
              </div>
              {viewDefect.attachments?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Attachments ({viewDefect.attachments.length})
                  </p>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {viewDefect.attachments.map((att, idx) => {
                      const name = att.originalName || `attachment-${idx}`;
                      const ext = (name.split(".").pop() || "").toLowerCase();
                      const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
                      const inlineUrl = `/api/qhse/defects-list/${viewDefect._id}/download?index=${idx}&inline=1`;
                      return (
                        <div
                          key={idx}
                          className="flex flex-col gap-1 rounded-lg border border-white/10 bg-slate-900/40 p-2"
                        >
                          {isImage ? (
                            <a
                              href={inlineUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-md border border-white/10 bg-white/5 hover:border-sky-500/60"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={inlineUrl}
                                alt={name}
                                className="h-24 w-full object-cover"
                                loading="lazy"
                              />
                            </a>
                          ) : (
                            <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
                              {ext || "file"}
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[11px] text-slate-300" title={name}>
                              {name}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                handleDownload(viewDefect._id, idx, name)
                              }
                              disabled={downloading === viewDefect._id}
                              className="shrink-0 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-sky-300 hover:bg-white/10 disabled:opacity-50"
                              title="Download"
                            >
                              {downloading === viewDefect._id ? "…" : "Download"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-white/10 px-5 py-4">
              {canApprove && viewDefect.status !== "Closed" ? (
                <button
                  type="button"
                  disabled={actionLoadingId === viewDefect._id}
                  onClick={() => {
                    if (
                      !confirm(
                        "Mark this defect as Closed? This will record completion and notify the team (if configured)."
                      )
                    ) {
                      return;
                    }
                    handleStatusChange(viewDefect._id, "Closed", { closeDetailModal: true });
                  }}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {actionLoadingId === viewDefect._id ? "Closing…" : "Mark as closed"}
                </button>
              ) : (
                <p className="text-center text-xs text-slate-500">
                  {viewDefect.status === "Closed"
                    ? "This defect is already closed."
                    : "Only approvers can close defects from this view."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

