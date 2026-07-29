"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useCallback, useEffect, useState } from "react";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../../utils/archive";
import { ArchiveIconButton, DeleteIconButton, ViewIconButton, DownloadIconButton } from "../../../components/ActionIcons";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";
import { QhseListPageContainer } from "../../../components/QhseListPageContainer";
import { useQhseRole } from "@/hooks/useQhseRole";
import Link from "next/link";
import { useQhseMongoCursorList } from "../../../hooks/useQhseMongoCursorList";
import QhseCursorPaginationFooter from "../../../components/QhseCursorPaginationFooter";

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

export default function PoacCrossCompetencyListPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canDelete, canDownload } = useQhseRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [year, setYear] = useState("");
  const [availableYears, setAvailableYears] = useState([]);
  const [loadingYears, setLoadingYears] = useState(false);
  const [archivingId, setArchivingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [downloadingDocxId, setDownloadingDocxId] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const getYears = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  };

  const itemsPerPage = 10;

  const loadPage = useCallback(
    async (requestCursor) => {
      const params = new URLSearchParams({
        paged: "cursor",
        limit: String(itemsPerPage),
        latestOnly: "true",
      });
      if (searchDebounced.trim()) {
        params.append("search", searchDebounced.trim());
      }
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (year !== "" && year != null) {
        params.append("year", year.toString());
      }
      if (requestCursor) {
        params.append("cursor", requestCursor);
      }
      const res = await fetch(
        `/api/qhse/cross-competency/list?${params.toString()}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load forms");
      }
      if (data.years && data.years.length > 0) {
        setAvailableYears(data.years);
      }
      return {
        items: data.data || [],
        hasNext: !!data.hasNext,
      };
    },
    [searchDebounced, statusFilter, year]
  );

  const cursorResetKey = `${searchDebounced}|${statusFilter}|${year}`;
  const {
    items: forms,
    loading,
    error,
    setError,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
    setItems: setForms,
  } = useQhseMongoCursorList(loadPage, cursorResetKey);

  useEffect(() => {
    setPageLoading(loading);
  }, [loading, setPageLoading]);

  const handleArchive = async (form) => {
    if (!confirm("Archive this form? It will be stored in QHSE Archive (POAC Cross Competency).")) return;
    setArchivingId(form._id);
    setError(null);
    setActionMessage(null);
    try {
      const payload = buildArchivePayload(ARCHIVE_MODULES.POAC_CROSS_COMPETENCY, form, form.nameOfPOAC || form.formCode, form.formCode);
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setForms((prev) => prev.filter((f) => f._id !== form._id));
      setActionMessage("Form archived successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (form) => {
    if (!canDelete) return;
    if (!confirm("Are you sure you want to delete this form? This cannot be undone.")) return;
    setDeleting(form._id);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/qhse/cross-competency/${form._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setForms((prev) => prev.filter((f) => f._id !== form._id));
      setActionMessage("Form deleted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleDownloadDocx = async (form) => {
    if (!canDownload) return;
    setDownloadingDocxId(form._id);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/cross-competency/${form._id}/download`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let fileName = `POAC-Cross-Competency-${form.serialNumber || form._id}.docx`;
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

  const handleDownloadPdf = async (form) => {
    if (!canDownload) return;
    setDownloadingPdfId(form._id);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/cross-competency/${form._id}/download/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download PDF");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let fileName = `POAC-Cross-Competency-${form.serialNumber || form._id}.pdf`;
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

  useEffect(() => {
    const fetchYears = async () => {
      setLoadingYears(true);
      try {
        const res = await fetch("/api/qhse/cross-competency/list?limit=1");
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

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      Draft: "bg-slate-500/15 text-slate-300 border-slate-400/40",
      Submitted: "bg-blue-500/15 text-blue-300 border-blue-400/40",
      Reviewed: "bg-purple-500/15 text-purple-300 border-purple-400/40",
      Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
      Rejected: "bg-red-500/15 text-red-300 border-red-400/40",
    };

    const tone = statusConfig[status] || statusConfig.Draft;

    return (
      <span
        className={`inline-flex max-w-[10rem] items-center justify-center truncate rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone}`}
      >
        {status}
      </span>
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
              QHSE / POAC Cross Competency
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              POAC Cross Competency Forms
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-009</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-009" />
          </div>
        </header>

        <main>
          <QhseListPageContainer
            searchPlaceholder="Search by Form Code, Job Ref No, or POAC Name..."
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
                <select
                  className="rounded-xl bg-slate-900/40 border border-white/15 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
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
                <p className="text-sm text-slate-300">Loading forms...</p>
              </div>
            ) : forms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm text-slate-300 mb-2">
                  {year !== "" && year != null
                    ? `No forms found for ${year}${searchTerm || statusFilter !== "all" ? " matching your criteria" : ""}`
                    : searchTerm || statusFilter !== "all"
                    ? "No forms found matching your criteria."
                    : "No POAC Cross Competency forms found."}
                </p>
                <p className="text-xs text-slate-400">
                  Forms are submitted via the external QHSE Forms app.
                </p>
              </div>
            ) : (
              <>
                <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead>
                      <tr className="text-left text-slate-200 border-b border-white/10">
                        <th className="py-3 pr-4 font-semibold">Form Code</th>
                        <th className="hidden py-3 pr-4 font-semibold md:table-cell">Serial</th>
                        <th className="py-3 pr-4 font-semibold">POAC Name</th>
                        <th className="py-3 pr-4 font-semibold">
                          Job Ref No
                        </th>
                        <th className="py-3 pr-4 font-semibold">Lead POAC</th>
                        <th className="hidden py-3 pr-4 font-semibold md:table-cell">Version</th>
                        <th className="py-3 pr-4 font-semibold whitespace-nowrap">
                          Status
                        </th>
                        <th className="py-3 pr-4 font-semibold text-right whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {forms.map((form) => (
                        <tr
                          key={form._id}
                          className="border-b border-white/5 hover:bg-white/5 transition"
                        >
                          <td className="py-3 pr-4">
                            <span className="font-mono text-sky-300">
                              {form.formCode || "—"}
                            </span>
                          </td>
                          <td className="hidden py-3 pr-4 md:table-cell">
                            <span className="font-mono text-slate-200">
                              {form.serialNumber || "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-slate-200">
                              {form.nameOfPOAC || "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-slate-200">
                              {form.jobRefNo || "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-slate-200">
                              {form.leadPOAC || "—"}
                            </span>
                          </td>
                          <td className="hidden py-3 pr-4 md:table-cell">
                            <span className="text-slate-300 font-mono text-[10px]">
                              v{form.revNo || "1.0"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 align-middle">
                            {getStatusBadge(form.status || "Draft")}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3 text-right align-middle sm:py-3 sm:pr-4">
                            <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                              {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadDocx(form)}
                                disabled={
                                  downloadingDocxId === form._id ||
                                  downloadingPdfId === form._id ||
                                  archivingId === form._id ||
                                  deleting === form._id
                                }
                                loading={downloadingDocxId === form._id}
                                title="Download as Word"
                              />
                              )}
                              {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadPdf(form)}
                                disabled={
                                  downloadingPdfId === form._id ||
                                  downloadingDocxId === form._id ||
                                  archivingId === form._id ||
                                  deleting === form._id
                                }
                                loading={downloadingPdfId === form._id}
                                title="Download as PDF"
                                className="!text-rose-400 hover:!text-rose-300"
                              />
                              )}
                              <ViewIconButton href={`/qhse/poac/cross-competency/${form._id}`} />
                              <ArchiveIconButton
                                onClick={() => handleArchive(form)}
                                disabled={archivingId === form._id || deleting === form._id}
                                loading={archivingId === form._id}
                              />
                              {canDelete && (
                              <DeleteIconButton
                                onClick={() => handleDelete(form)}
                                disabled={archivingId === form._id || deleting === form._id}
                                loading={deleting === form._id}
                              />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <QhseCursorPaginationFooter
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                  itemCount={forms.length}
                  onPrev={() => {
                    void goPrev();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onNext={() => {
                    void goNext();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  loading={loading}
                />
              </>
            )}
          </QhseListPageContainer>
        </main>
      </div>
    </div>
  );
}


