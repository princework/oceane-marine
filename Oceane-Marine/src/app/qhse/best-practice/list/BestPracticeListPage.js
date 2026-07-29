"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useEffect, useMemo, useState } from "react";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import Link from "next/link";
import { saveAs } from "file-saver";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../utils/archive";
import { useQhseSidebar } from "../../QhseSidebarContext";
import { ArchiveIconButton, DeleteIconButton, DownloadIconButton } from "../../components/ActionIcons";
import { QhseListPageContainer } from "../../components/QhseListPageContainer";
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

export default function BestPracticeListPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canCreate, canEdit, canDelete, canApprove, canDownload } = useQhseRole();
  const initialYears = getYears();
  
  const [bestPractices, setBestPractices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [downloadingDocxId, setDownloadingDocxId] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [availableYears, setAvailableYears] = useState(initialYears);
  const [loadingYears, setLoadingYears] = useState(true);
  const [year, setYear] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [bulkDownloading, setBulkDownloading] = useState(false);

  // Fetch available years
  useEffect(() => {
    const loadYears = async () => {
      setLoadingYears(true);
      try {
        const res = await fetch("/api/qhse/best-practice/list");
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

  const fetchData = async () => {
    setLoading(true);
    setPageLoading(true);
    setError(null);
    try {
      const url = year !== "" && year != null
        ? `/api/qhse/best-practice/list?year=${year}`
        : "/api/qhse/best-practice/list";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setBestPractices(data.bestPractices || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year]);

  const handleArchive = async (practice) => {
    if (!confirm("Archive this entry? It will be stored in QHSE Archive (Best Practice).")) return;
    setArchivingId(practice._id);
    setError(null);
    setActionMessage(null);
    try {
      const payload = buildArchivePayload(ARCHIVE_MODULES.BEST_PRACTICE, practice, practice.description || practice.formCode, practice.formCode);
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setBestPractices((prev) => prev.filter((p) => p._id !== practice._id));
      setActionMessage("Best practice archived successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDownloadDocx = async (practice) => {
    if (!canDownload) return;
    setDownloadingDocxId(practice._id);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/best-practice/${practice._id}/download`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Download failed");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition");
      const match = disp && disp.match(/filename="?([^";]+)"?/);
      const fileName = match ? match[1].trim() : `Best-Practice-${practice.serialNumber || practice._id}.docx`;
      saveAs(blob, fileName);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingDocxId(null);
    }
  };

  const handleDownloadPdf = async (practice) => {
    if (!canDownload) return;
    setDownloadingPdfId(practice._id);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/best-practice/${practice._id}/download/pdf`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "PDF download failed");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition");
      const match = disp && disp.match(/filename="?([^";]+)"?/);
      const fileName = match
        ? match[1].trim()
        : `Best-Practice-${practice.serialNumber || practice._id}.pdf`;
      saveAs(blob, fileName);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleBulkDownloadPdf = async () => {
    setBulkDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ module: "best-practice" });
      if (year !== "" && year != null) params.append("year", String(year));
      const res = await fetch(`/api/qhse/bulk-download-pdf?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate PDF");
      }
      const blob = await res.blob();
      saveAs(blob, `Best-Practices${year ? `-${year}` : "-All"}.pdf`);
    } catch (err) {
      setError(err.message || "Failed to download PDF");
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    if (!confirm("Are you sure you want to delete this best practice entry? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/qhse/best-practice/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setBestPractices((prev) => prev.filter((p) => p._id !== id));
      setActionMessage("Best practice deleted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredBestPractices = useMemo(() => {
    if (!searchTerm.trim()) return bestPractices;
    const s = searchTerm.toLowerCase();
    return bestPractices.filter(
      (p) =>
        (p.serialNumber || "").toLowerCase().includes(s) ||
        (p.description || "").toLowerCase().includes(s) ||
        (p.formCode || "").toLowerCase().includes(s)
    );
  }, [bestPractices, searchTerm]);

  const bestPracticeListPagination = useOperationsClientPagination(
    filteredBestPractices,
    `${searchTerm}|${year}|${bestPractices.length}`
  );
  const { paginatedItems: paginatedBestPracticeRows, ...bestPracticeListPaginationFooterProps } =
    bestPracticeListPagination;

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
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Best Practices</h1>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/best-practice/create"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Create Best Practice
              </Link>
              <Link
                href="/qhse/best-practice/list"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Best Practice List
              </Link>
            </div>
          </div>
        </header>

        <main>
          <QhseListPageContainer
            searchPlaceholder="Search by Serial, Description..."
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
                    title="Download all records as a single PDF"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
                    </svg>
                    {bulkDownloading ? "Generating..." : "Download All PDF"}
                  </button>
                </div>
              </>
            }
          >
            {error && (
              <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            {actionMessage && (
              <div className="text-sm text-emerald-200 bg-emerald-950/40 border border-emerald-500/40 rounded-lg px-4 py-3">
                {actionMessage}
              </div>
            )}
            {loading ? (
              <p className="text-sm text-slate-100">Loading...</p>
            ) : filteredBestPractices.length === 0 ? (
                <p className="text-sm text-slate-100">
                  {year !== "" && year != null ? `No records found for ${year}.` : "No records found."}
                  {searchTerm.trim() ? " matching search." : ""}
                </p>
              ) : (
                <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-200 border-b border-white/10">
                        <th className="py-3 pr-4 font-semibold">Form Code</th>
                        <th className="hidden py-3 pr-4 font-semibold md:table-cell">Serial</th>
                        <th className="py-3 pr-4 font-semibold">Event Date</th>
                        <th className="py-3 pr-4 font-semibold">Description</th>
                        <th className="py-3 pr-4 font-semibold">Created At</th>
                        <th className="py-3 pr-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBestPracticeRows.map((practice) => (
                      <tr
                        key={practice._id}
                        className="border-b border-white/5 hover:bg-white/5"
                      >
                        <td className="py-3 pr-4 font-mono text-sky-300">
                          {practice.formCode || "—"}
                        </td>
                        <td className="hidden py-3 pr-4 font-mono text-slate-200 md:table-cell">
                          {practice.serialNumber || "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {formatDate(practice.eventDate)}
                        </td>
                        <td className="py-3 pr-4 max-w-2xl">
                          <p className="text-slate-200">
                            {practice.description || "—"}
                          </p>
                        </td>
                        <td className="py-3 pr-4">
                          {formatDate(practice.createdAt)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-3 text-right sm:pr-4">
                          <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                            {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadDocx(practice)}
                                disabled={
                                  archivingId === practice._id ||
                                  deletingId === practice._id ||
                                  downloadingPdfId === practice._id
                                }
                                loading={downloadingDocxId === practice._id}
                                title="Download as Word"
                              />
                            )}
                            {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadPdf(practice)}
                                disabled={
                                  archivingId === practice._id ||
                                  deletingId === practice._id ||
                                  downloadingDocxId === practice._id
                                }
                                loading={downloadingPdfId === practice._id}
                                title="Download as PDF"
                                className="!text-rose-400 hover:!text-rose-300"
                              />
                            )}
                            <ArchiveIconButton
                              onClick={() => handleArchive(practice)}
                              disabled={archivingId === practice._id || deletingId === practice._id}
                              loading={archivingId === practice._id}
                            />
                            {canDelete && (
                              <DeleteIconButton
                                onClick={() => handleDelete(practice._id)}
                                disabled={archivingId === practice._id || deletingId === practice._id}
                                loading={deletingId === practice._id}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                      ))}
                    </tbody>
                  </table>
                  <OperationsListPaginationFooter {...bestPracticeListPaginationFooterProps} />
                </div>
              )}
          </QhseListPageContainer>
        </main>
      </div>
    </div>
  );
}

