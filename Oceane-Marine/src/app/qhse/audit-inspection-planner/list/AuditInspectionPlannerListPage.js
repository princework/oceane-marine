"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../../QhseSidebarContext";
import { useEffect, useMemo, useState } from "react";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import Link from "next/link";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../utils/archive";
import { ArchiveIconButton, DeleteIconButton, EditIconButton, ViewIconButton, DownloadIconButton } from "../../components/ActionIcons";
import { QhseListPageContainer } from "../../components/QhseListPageContainer";
import { useQhseRole } from "@/hooks/useQhseRole";

export default function AuditInspectionPlannerListPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canCreate, canEdit, canDelete, canApprove, canDownload } = useQhseRole();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [year, setYear] = useState(""); // "" = All years
  const [availableYears, setAvailableYears] = useState([]);
  const [loadingYears, setLoadingYears] = useState(false);
  const [archivingId, setArchivingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingDocxId, setDownloadingDocxId] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const handleArchive = async (item) => {
    if (!confirm("Archive this planner? It will be stored in QHSE Archive (Audit & Inspection Planner).")) return;
    setArchivingId(item._id);
    setError("");
    setActionMessage("");
    try {
      const payload = buildArchivePayload(ARCHIVE_MODULES.AUDIT_INSPECTION_PLANNER, item, item.formCode || `Planner v${item.version}`, item.formCode);
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      setActionMessage("Planner archived successfully.");
    } catch (err) {
      setError(err.message || "Failed to archive");
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (item) => {
    if (!canDelete) return;
    if (!confirm(`Delete planner ${item.serialNumber || item.formCode || item._id}? This cannot be undone.`)) return;
    setDeletingId(item._id);
    setError("");
    setActionMessage("");
    try {
      const res = await fetch(`/api/qhse/audit-inspection-planner/${item._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      setActionMessage("Planner deleted successfully.");
    } catch (err) {
      setError(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const getYears = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  };

  const fetchData = async () => {
    setLoading(true);
    setPageLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (year && String(year).trim()) {
        params.append("year", String(year).trim());
      }
      const url = `/api/qhse/audit-inspection-planner/list${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load planners");
      setItems(data.data || []);
      if (data.years && data.years.length > 0) {
        setAvailableYears(data.years);
      }
    } catch (err) {
      setError(err.message || "Failed to load planners");
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year]);

  const handleDownloadDocx = async (item) => {
    if (!canDownload) return;
    setDownloadingDocxId(item._id);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/audit-inspection-planner/${item._id}/download`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let fileName = `Audit-Inspection-Planner-${item.serialNumber || item._id}.docx`;
      const contentDisposition = res.headers.get("Content-Disposition");
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^";]+)/i) || contentDisposition.match(/filename="?([^"]+)"?/i);
        if (match && match[1]) {
          fileName = match[1].trim().replace(/"$/g, "");
        }
      }
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download");
    } finally {
      setDownloadingDocxId(null);
    }
  };

  const handleDownloadPdf = async (item) => {
    if (!canDownload) return;
    setDownloadingPdfId(item._id);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/audit-inspection-planner/${item._id}/download/pdf`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download PDF");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let fileName = `Audit-Inspection-Planner-${item.serialNumber || item._id}.pdf`;
      const contentDisposition = res.headers.get("Content-Disposition");
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^";]+)/i) || contentDisposition.match(/filename="?([^"]+)"?/i);
        if (match && match[1]) {
          fileName = match[1].trim().replace(/"$/g, "");
        }
      }
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleBulkDownloadPdf = async () => {
    setBulkDownloading(true);
    setError("");
    try {
      const params = new URLSearchParams({ module: "audit-inspection" });
      if (year && String(year).trim()) params.append("year", String(year).trim());
      const res = await fetch(`/api/qhse/bulk-download-pdf?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate PDF");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Audit-Inspection-Planner${year ? `-${year}` : "-All"}.pdf`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download PDF");
    } finally {
      setBulkDownloading(false);
    }
  };

  useEffect(() => {
    const fetchYears = async () => {
      setLoadingYears(true);
      try {
        const res = await fetch("/api/qhse/audit-inspection-planner/list");
        const data = await res.json();
        if (res.ok && data.years) {
          setAvailableYears(data.years);
        } else {
          setAvailableYears(getYears());
        }
      } catch (err) {
        setAvailableYears(getYears());
      } finally {
        setLoadingYears(false);
      }
    };
    fetchYears();
  }, []);

  const filteredAuditPlannerItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const s = searchTerm.toLowerCase();
    return items.filter(
      (i) =>
        (i.serialNumber || "").toLowerCase().includes(s) ||
        (i.formCode || "").toLowerCase().includes(s)
    );
  }, [items, searchTerm]);

  const auditPlannerListPagination = useOperationsClientPagination(
    filteredAuditPlannerItems,
    `${searchTerm}|${year}|${items.length}`
  );
  const { paginatedItems: paginatedAuditPlannerRows, ...auditPlannerListPaginationFooterProps } =
    auditPlannerListPagination;

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
              QHSE / Audit & Inspection Planner
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Audit & Inspection Planners</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-048</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <a
              href="/templates/controlled-register/QAF-OFD-048.xlsx"
              download
              className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
              title="Download form template (QAF-OFD-048)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
              </svg>
              Template
            </a>
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/audit-inspection-planner/form"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Planner Form
              </Link>
              <Link
                href="/qhse/audit-inspection-planner/list"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Planner List
              </Link>
            </div>
          </div>
        </header>

        <main>
          <QhseListPageContainer
            searchPlaceholder="Search by Form Code, Serial..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterChildren={
              <>
                <div className="flex w-full min-w-0 flex-nowrap items-center justify-center gap-2 sm:inline-flex sm:w-auto sm:max-w-none">
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
                    <select
                      className="theme-select max-w-[9rem] rounded-full px-3 py-1 text-xs tracking-widest uppercase sm:max-w-none"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      disabled={loadingYears}
                    >
                      <option value="">All years</option>
                      {(availableYears.length ? availableYears : getYears()).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
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
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-slate-300">Loading...</p>
              </div>
            ) : filteredAuditPlannerItems.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-white/10 bg-white/5">
                  <p className="text-white/60 mb-2">
                    {year ? `No planners found for ${year}` : "No planners found"}
                    {searchTerm.trim() ? " matching search." : ""}
                  </p>
                  <Link
                    href="/qhse/audit-inspection-planner/form"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition"
                  >
                    Create Planner
                  </Link>
                </div>
              ) : (
                <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-200 border-b border-white/10 bg-white/5">
                        <th className="px-6 py-4 font-semibold">Form Code</th>
                        <th className="hidden px-6 py-4 font-semibold md:table-cell">Serial</th>
                        <th className="hidden px-6 py-4 font-semibold md:table-cell">Rev</th>
                        <th className="px-6 py-4 font-semibold">Issue Date</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAuditPlannerRows.map((item) => (
                      <tr key={item._id} className="border-b border-white/5">
                        <td className="px-6 py-4 font-mono text-sky-300">{item.formCode}</td>
                        <td className="hidden px-6 py-4 font-mono text-slate-200 md:table-cell">{item.serialNumber || "—"}</td>
                        <td className="hidden px-6 py-4 md:table-cell">{item.version ?? "1.0"}</td>
                        <td className="px-6 py-4">
                          {item.issueDate ? new Date(item.issueDate).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="px-6 py-4">{item.status}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right sm:px-6 sm:py-4">
                          <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                            {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadDocx(item)}
                                disabled={
                                  downloadingDocxId === item._id ||
                                  downloadingPdfId === item._id
                                }
                                loading={downloadingDocxId === item._id}
                                title="Download as Word"
                              />
                            )}
                            {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadPdf(item)}
                                disabled={
                                  downloadingPdfId === item._id ||
                                  downloadingDocxId === item._id
                                }
                                loading={downloadingPdfId === item._id}
                                title="Download as PDF"
                                className="!text-rose-400 hover:!text-rose-300"
                              />
                            )}
                            <ViewIconButton href={`/qhse/audit-inspection-planner/view/${item._id}`} />
                            {canEdit && (
                              <EditIconButton href={`/qhse/audit-inspection-planner/form?edit=${item._id}`} />
                            )}
                            <ArchiveIconButton
                              onClick={() => handleArchive(item)}
                              disabled={archivingId === item._id || deletingId === item._id}
                              loading={archivingId === item._id}
                            />
                            {canDelete && (
                              <DeleteIconButton
                                onClick={() => handleDelete(item)}
                                disabled={archivingId === item._id || deletingId === item._id}
                                loading={deletingId === item._id}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                      ))}
                    </tbody>
                  </table>
                  <OperationsListPaginationFooter {...auditPlannerListPaginationFooterProps} />
                </div>
              )}
          </QhseListPageContainer>
        </main>
      </div>
    </div>
  );
}

