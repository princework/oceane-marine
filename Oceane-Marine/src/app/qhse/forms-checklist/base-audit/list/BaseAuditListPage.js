"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useEffect, useMemo, useState } from "react";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../../utils/archive";
import { ArchiveIconButton, DeleteIconButton, DownloadIconButton, EditIconButton } from "../../../components/ActionIcons";
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

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

export default function BaseAuditListPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const router = useRouter();
  const { canCreate, canEdit, canDelete, canApprove, canDownload } = useQhseRole();
  const currentYear = new Date().getFullYear();
  const initialYears = getYears();
  
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [availableYears, setAvailableYears] = useState(initialYears);
  const [loadingYears, setLoadingYears] = useState(true);
  const [year, setYear] = useState("");
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch("/api/master/locations/list");
        const data = await res.json();
        if (res.ok && data.locations) {
          setLocations(data.locations);
        }
      } finally {
        setLoadingLocations(false);
      }
    };
    fetchLocations();
  }, []);

  // Fetch available years
  useEffect(() => {
    const loadYears = async () => {
      setLoadingYears(true);
      try {
        const res = await fetch("/api/qhse/form-checklist/base-audit/list");
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.years)) {
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

  const fetchReports = async () => {
    setLoading(true);
    setPageLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (year !== "" && year != null) params.set("year", year);
      if (locationId) params.set("locationId", locationId);
      const url = params.toString()
        ? `/api/qhse/form-checklist/base-audit/list?${params}`
        : "/api/qhse/form-checklist/base-audit/list";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load reports");
      }
      setReports(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [year, locationId]);

  const handleDownloadDocx = async (report) => {
    if (!canDownload) return;
    setDownloading(report._id);
    try {
      // Fetch generated DOCX from server
      const res = await fetch(
        `/api/qhse/form-checklist/base-audit/${report._id}/download`
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to download document");
      }

      // Get blob and create download
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BaseAudit-${report.serialNumber || report._id}.docx`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download document");
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadPdf = async (report) => {
    if (!canDownload) return;
    setDownloadingPdf(report._id);
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/base-audit/${report._id}/download-pdf`
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to download PDF");
      }

      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BaseAudit-${report.serialNumber || report._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleDownloadFile = async (report) => {
    if (!canDownload) return;
    setDownloadingFile(report._id);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/form-checklist/base-audit/${report._id}/download-file`);
      
      // Check if response is JSON (error) or binary (file)
      const contentType = res.headers.get("content-type") || "";
      
      if (!res.ok) {
        // Try to parse as JSON error
        const data = await res.json().catch(() => ({}));
        const errorMsg = data.error || data.message || `Failed to download file (${res.status})`;
        alert(errorMsg);
        setError(errorMsg);
        return;
      }

      // Check if it's a redirect response
      if (res.redirected || res.status === 307 || res.status === 308) {
        // For redirects, open in new window
        window.open(res.url, "_blank");
        return;
      }

      // Check if content type indicates it's a file (not JSON)
      if (contentType.includes("application/json")) {
        const data = await res.json();
        const errorMsg = data.error || data.message || "No file available";
        alert(errorMsg);
        setError(errorMsg);
        return;
      }

      // It's a file - download it
      const blob = await res.blob();
      
      // Extract filename from Content-Disposition header
      const contentDisposition = res.headers.get("Content-Disposition");
      let fileName = `BaseAudit-file-${report._id}`;
      
      if (contentDisposition) {
        // Try to extract filename from Content-Disposition header
        // Format: attachment; filename="file.pdf" or attachment; filename*=UTF-8''file.pdf
        const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/i) || 
                             contentDisposition.match(/filename="?([^";]+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          fileName = decodeURIComponent(filenameMatch[1]);
        }
      }
      
      console.log("[Base Audit File Download Frontend] Downloading file:", fileName, "Size:", blob.size, "Type:", blob.type);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (err) {
      const errorMsg = err.message || "Failed to download file";
      alert(errorMsg);
      setError(errorMsg);
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleEdit = (report) => {
    if (!canEdit) return;
    router.push(`/qhse/forms-checklist/base-audit/form?edit=${report._id}`);
  };

  const handleArchive = async (report) => {
    if (!confirm("Archive this report? It will be stored in QHSE Archive (Base Audit).")) return;
    setArchivingId(report._id);
    setError(null);
    try {
      const payload = buildArchivePayload(ARCHIVE_MODULES.BASE_AUDIT, report, report.description || report.formCode, report.formCode);
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setReports((prev) => prev.filter((r) => r._id !== report._id));
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
      const res = await fetch(`/api/qhse/form-checklist/base-audit/${report._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setReports((prev) => prev.filter((r) => r._id !== report._id));
    } catch (err) {
      setError(err.message || "Failed to delete report");
    } finally {
      setDeleting(null);
    }
  };

  const filteredBaseAuditItems = useMemo(() => {
    if (!searchTerm.trim()) return reports;
    const s = searchTerm.toLowerCase();
    return reports.filter((r) => {
      // Location is denormalised onto the record (`r.location.name`); fall
      // back to the master list lookup using the correct `r.location.locationId`
      // path so that a search like "fujairah" still matches even if the
      // record's name was empty when it was saved.
      const locName =
        (r.location?.name || "").trim() ||
        (locations.find(
          (l) =>
            String(l._id) === String(r.location?.locationId || "")
        ) || {}).name ||
        "";
      return (
        (r.serialNumber || "").toLowerCase().includes(s) ||
        (r.formCode || "").toLowerCase().includes(s) ||
        locName.toLowerCase().includes(s)
      );
    });
  }, [reports, searchTerm, locations]);

  const baseAuditListPagination = useOperationsClientPagination(
    filteredBaseAuditItems,
    `${searchTerm}|${year}|${locationId}|${reports.length}`
  );
  const { paginatedItems: paginatedBaseAuditRows, ...baseAuditListPaginationFooterProps } =
    baseAuditListPagination;

  if (loading) return null;

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
              QHSE / Forms & Checklist / Base Audit
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Base Audit Reports</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-004</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <a
              href="/templates/controlled-register/QAF-OFD-004.docx"
              download
              className="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
              title="Download form template (QAF-OFD-004)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
              </svg>
              Template
            </a>
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/forms-checklist/base-audit/form"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Base Audit Form
              </Link>
              <Link
                href="/qhse/forms-checklist/base-audit/list"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Base Audit List
              </Link>
            </div>
          </div>
        </header>

        <main>
          <QhseListPageContainer
            searchPlaceholder="Search by Serial, Location..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterChildren={
              <>
                <div className="flex items-center gap-2">
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
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Location</span>
                  <select
                    className="theme-select rounded-full px-3 py-1 text-xs tracking-widest uppercase"
                    value={locationId || ""}
                    onChange={(e) => setLocationId(e.target.value)}
                    disabled={loadingLocations}
                  >
                    <option value="">All</option>
                    {locations.map((loc) => (
                      <option key={loc._id} value={loc._id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            }
          >
            {error && (
              <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            {reports.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-white/10 bg-white/5">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/20 border border-sky-500/50">
                  <svg
                    className="h-8 w-8 text-sky-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-white/60 mb-2">
                {year !== "" && year != null ? `No reports found for ${year}` : "No reports found"}
              </p>
              <p className="text-sm text-slate-400 mb-4">
                {year !== "" && year != null
                  ? "Try selecting a different year or upload a new report"
                  : "Start by uploading your first base audit report"}
              </p>
              <Link
                href="/qhse/forms-checklist/base-audit/form"
                className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Upload Report
              </Link>
            </div>
          ) : filteredBaseAuditItems.length === 0 ? (
              <div className="text-center py-12 rounded-2xl border border-white/10 bg-white/5">
                <p className="text-white/60">No reports matching search.</p>
              </div>
            ) : (
            <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-200 border-b border-white/10 bg-white/5">
                      <th className="px-6 py-4 font-semibold">Form Code</th>
                      <th className="hidden px-6 py-4 font-semibold md:table-cell">Serial</th>
                      <th className="px-6 py-4 font-semibold">Location</th>
                      <th className="hidden px-6 py-4 font-semibold md:table-cell">Version</th>
                      <th className="px-6 py-4 font-semibold">Uploaded By</th>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBaseAuditRows.map((report) => (
                      <tr
                        key={report._id}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sky-300">
                            {report.formCode || "—"}
                          </span>
                        </td>
                        <td className="hidden px-6 py-4 md:table-cell">
                          <span className="font-mono text-slate-200">
                            {report.serialNumber || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-200">
                            {report.location?.name || "—"}
                          </span>
                        </td>
                        <td className="hidden px-6 py-4 md:table-cell">
                          <span className="font-mono text-sky-300">
                            v{report.version || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-200">
                            {report.uploadedBy?.name || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">{formatDate(report.date)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right sm:px-6 sm:py-4">
                          <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                            {/* Only show file download button if file is attached */}
                            {report.filePath && canDownload && (
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(report)}
                                disabled={downloadingFile === report._id}
                                className="px-2 py-1 rounded border border-purple-400/30 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-purple-200 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                title="Download attached file"
                              >
                                {downloadingFile === report._id ? (
                                  <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                  </svg>
                                )}
                              </button>
                            )}
                            {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadDocx(report)}
                                disabled={downloading === report._id || downloadingPdf === report._id}
                                loading={downloading === report._id}
                                title="Download as Word"
                              />
                            )}
                            <ArchiveIconButton
                              onClick={() => handleArchive(report)}
                              disabled={archivingId === report._id || deleting === report._id}
                              loading={archivingId === report._id}
                            />
                            {canEdit && (
                              <EditIconButton onClick={() => handleEdit(report)} />
                            )}
                            {canDelete && (
                              <DeleteIconButton
                                onClick={() => handleDelete(report)}
                                disabled={archivingId === report._id || deleting === report._id}
                                loading={deleting === report._id}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <OperationsListPaginationFooter {...baseAuditListPaginationFooterProps} />
              </div>
            )}
          </QhseListPageContainer>
        </main>
      </div>
    </div>
  );
}
