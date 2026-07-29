"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../../QhseSidebarContext";
import { useEffect, useMemo, useState } from "react";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import Link from "next/link";
import { TemplateDownloadLink } from "../../components/TemplateDownloadLink";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../utils/archive";
import { ArchiveIconButton, DeleteIconButton, DownloadIconButton } from "../../components/ActionIcons";
import { QhseListPageContainer } from "../../components/QhseListPageContainer";
import { useQhseRole } from "@/hooks/useQhseRole";

export default function KpiListPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canCreate, canEdit, canDelete, canApprove, canDownload } = useQhseRole();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(""); // "" = All years
  const [searchTerm, setSearchTerm] = useState("");
  const [archivingId, setArchivingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setPageLoading(true);
      setError("");
      try {
        const url = year ? `/api/qhse/kpi/list?year=${year}` : "/api/qhse/kpi/list";
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load files");
        setItems(data.data || []);
        if (Array.isArray(data.years)) setYears(data.years);
      } catch (err) {
        setError(err.message || "Failed to load files");
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    };
    fetchData();
  }, [year]);

  const filteredKpiItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const s = searchTerm.toLowerCase();
    return items.filter(
      (i) =>
        (i.originalName || "").toLowerCase().includes(s) ||
        (i.serialNumber || "").toLowerCase().includes(s) ||
        (i.formCode || "").toLowerCase().includes(s)
    );
  }, [items, searchTerm]);

  const kpiListPagination = useOperationsClientPagination(
    filteredKpiItems,
    `${searchTerm}|${year}|${items.length}`
  );
  const { paginatedItems: paginatedKpiRows, ...kpiListPaginationFooterProps } = kpiListPagination;

  const handleArchive = async (item) => {
    if (!confirm("Archive this KPI file? It will be stored in QHSE Archive (KPI).")) return;
    setArchivingId(item._id);
    setError("");
    setActionMessage("");
    try {
      const payload = buildArchivePayload(
        ARCHIVE_MODULES.KPI_UPLOAD,
        item,
        item.originalName || item.formCode || "KPI upload",
        item.formCode || "HSE-001B"
      );
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      setActionMessage("KPI file archived successfully.");
    } catch (err) {
      setError(err.message || "Failed to archive");
    } finally {
      setArchivingId(null);
    }
  };

  const handleBulkDownloadPdf = async () => {
    setBulkDownloading(true);
    setError("");
    try {
      const params = new URLSearchParams({ module: "target-kpi" });
      if (year) params.append("year", String(year));
      const res = await fetch(`/api/qhse/bulk-download-pdf?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate PDF");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Target-KPI${year ? `-${year}` : "-All"}.pdf`;
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

  const handleDelete = async (item) => {
    if (!canDelete) return;
    if (!confirm(`Delete "${item.originalName || item.serialNumber}"? This cannot be undone.`)) return;
    setDeletingId(item._id);
    setError("");
    setActionMessage("");
    try {
      const res = await fetch(`/api/qhse/kpi/${item._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      setActionMessage("KPI file deleted successfully.");
    } catch (err) {
      setError(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

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
              QHSE / KPI
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">HSE Objectives & Targets</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">Form code: <span className="font-mono font-semibold text-sky-300">HSE-001B</span></p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="HSE-001B" />
            <div className="flex rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/kpi/target-kpi/form"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Target KPI
              </Link>
              <Link
                href="/qhse/kpi/create"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                KPI
              </Link>
            </div>
            <div className="flex rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/kpi/create"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Form
              </Link>
              <Link
                href="/qhse/kpi/list"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                List
              </Link>
            </div>
          </div>
        </header>

        <QhseListPageContainer
          searchPlaceholder="Search by file name, serial..."
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
                  >
                    <option value="">All years</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleBulkDownloadPdf}
                  disabled={bulkDownloading}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50 sm:px-3 sm:text-xs"
                  title="Download all Target KPI records as a single PDF"
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
            <p className="text-sm text-slate-300">Loading...</p>
          ) : filteredKpiItems.length === 0 ? (
              <p className="text-sm text-slate-300">No uploads yet.</p>
            ) : (
              <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <table className="min-w-full text-sm text-left text-slate-200">
                  <thead className="text-xs uppercase tracking-wide text-slate-300 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3">Form code</th>
                      <th className="hidden px-4 py-3 md:table-cell">Serial</th>
                      <th className="px-4 py-3">File name</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {paginatedKpiRows.map((item) => (
                    <tr key={item._id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-mono text-sky-300">
                        {item.formCode || "—"}
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-slate-200 md:table-cell">
                        {item.serialNumber || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {item.originalName || item.filename || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right sm:px-4 sm:py-3">
                        <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                          {canDownload && (
                            <DownloadIconButton href={`/api/qhse/kpi/${item._id}/download`} title="Download as Word" />
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
                <OperationsListPaginationFooter {...kpiListPaginationFooterProps} />
              </div>
            )}
        </QhseListPageContainer>
      </div>
    </div>
  );
}
