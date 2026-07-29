"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useEffect, useState } from "react";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import Link from "next/link";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";
import { ArchiveIconButton, DeleteIconButton, ViewIconButton } from "../../../components/ActionIcons";
import { useQhseRole } from "@/hooks/useQhseRole";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../../utils/archive";

function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i <= currentYear + 5; i++) years.push(i);
  return years;
}

export default function TargetKpiListPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canCreate, canEdit, canDelete, canApprove, canDownload } = useQhseRole();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [availableYears, setAvailableYears] = useState([]);
  const [year, setYear] = useState(""); // "" = All years
  const [archivingId, setArchivingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [downloadingDocxId, setDownloadingDocxId] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);

  const handleArchive = async (item) => {
    if (!confirm("Archive this Target KPI? It will be stored in QHSE Archive (Target KPI).")) return;
    setArchivingId(item._id);
    setError("");
    setActionMessage("");
    try {
      const payload = buildArchivePayload(ARCHIVE_MODULES.TARGET_KPI, item, `Target KPI ${item.year}`, item.formCode || "HSE-001A");
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      setActionMessage("Target KPI archived successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (item) => {
    if (!canDelete) return;
    if (!confirm(`Delete Target KPI for year ${item.year ?? "?"}? This cannot be undone.`)) return;
    setDeletingId(item._id);
    setError("");
    setActionMessage("");
    try {
      const res = await fetch(`/api/qhse/kpi/target/${item._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      setActionMessage("Target KPI deleted successfully.");
    } catch (err) {
      setError(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadDocx = async (item) => {
    if (!canDownload) return;
    if (!item._id) return;
    setDownloadingDocxId(item._id);
    try {
      const res = await fetch(`/api/qhse/kpi/target/${item._id}/download`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Target-KPI-${item.year ?? "kpi"}-${item.serialNumber ?? item._id}.docx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download Word");
    } finally {
      setDownloadingDocxId(null);
    }
  };

  const handleDownloadPdf = async (item) => {
    if (!canDownload) return;
    if (!item._id) return;
    setDownloadingPdfId(item._id);
    try {
      const res = await fetch(`/api/qhse/kpi/target/${item._id}/download/pdf`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Target-KPI-${item.year ?? "kpi"}-${item.serialNumber ?? item._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setPageLoading(true);
      setError("");
      try {
        const url = year ? `/api/qhse/kpi/target/list?year=${year}` : "/api/qhse/kpi/target/list";
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load");
        setItems(data.data || []);
        if (Array.isArray(data.years) && data.years.length > 0) {
          setAvailableYears(data.years);
        } else {
          setAvailableYears(getYears());
        }
      } catch (err) {
        setError(err.message || "Failed to load");
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    };
    fetchData();
  }, [year]);

  const years = availableYears.length > 0 ? availableYears : getYears();

  const targetKpiListPagination = useOperationsClientPagination(items, `${year}|${items.length}`);
  const { paginatedItems: paginatedTargetKpiRows, ...targetKpiListPaginationFooterProps } =
    targetKpiListPagination;

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
              QHSE / KPI / Target KPI
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Target KPI List</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">HSE-001A</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="HSE-001A" />
            <div className="flex rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/kpi/target-kpi/form"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Target KPI
              </Link>
              <Link
                href="/qhse/kpi/create"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                KPI
              </Link>
            </div>
            <div className="flex rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/kpi/target-kpi/form"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Form
              </Link>
              <Link
                href="/qhse/kpi/target-kpi/list"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                List
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
            {error}
          </div>
        )}
        {actionMessage && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-200 text-sm font-medium">
            {actionMessage}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
              <select
                className="rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[5rem]"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                <option value="">All years</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-slate-300">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-300">
              No Target KPIs for this year. Create one from Target KPI form.
            </p>
          ) : (
            <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="min-w-full text-sm text-left text-slate-200">
                <thead className="text-xs uppercase tracking-wide text-slate-300 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3">Form Code</th>
                    <th className="hidden px-4 py-3 md:table-cell">Serial</th>
                    <th className="px-4 py-3">Year</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedTargetKpiRows.map((item) => (
                    <tr key={item._id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-mono font-medium text-sky-300">
                        {item.formCode || "—"}
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-slate-200 md:table-cell">
                        {item.serialNumber || "—"}
                      </td>
                      <td className="px-4 py-3">{item.year ?? "—"}</td>
                      <td className="px-4 py-3">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right sm:px-4 sm:py-3">
                        <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                          {canDownload && (
                            <button
                              type="button"
                              onClick={() => handleDownloadDocx(item)}
                              disabled={downloadingDocxId === item._id || downloadingPdfId === item._id}
                              className="text-xs px-2 py-1 rounded border border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 disabled:opacity-50 transition"
                              title="Download Word"
                            >
                              {downloadingDocxId === item._id ? "…" : "Word"}
                            </button>
                          )}
                          {canDownload && (
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(item)}
                              disabled={downloadingDocxId === item._id || downloadingPdfId === item._id}
                              className="text-xs px-2 py-1 rounded border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 transition"
                              title="Download PDF"
                            >
                              {downloadingPdfId === item._id ? "…" : "PDF"}
                            </button>
                          )}
                          <ArchiveIconButton
                            onClick={() => handleArchive(item)}
                            disabled={archivingId === item._id || deletingId === item._id}
                            loading={archivingId === item._id}
                          />
                          <ViewIconButton href={`/qhse/kpi/target-kpi/view/${String(item._id ?? "")}`} />
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
              <OperationsListPaginationFooter {...targetKpiListPaginationFooterProps} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
