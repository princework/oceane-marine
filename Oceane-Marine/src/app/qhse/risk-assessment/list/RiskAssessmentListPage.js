"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../../QhseSidebarContext";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../utils/archive";
import { QhseListPageContainer } from "../../components/QhseListPageContainer";
import { useQhseRole } from "@/hooks/useQhseRole";
import { useQhseMongoCursorList } from "../../hooks/useQhseMongoCursorList";
import QhseCursorPaginationFooter from "../../components/QhseCursorPaginationFooter";

export default function RiskAssessmentListPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canDelete, canDownload } = useQhseRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [archivingId, setArchivingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear + 5; y >= currentYear - 7; y--) {
    yearOptions.push(y);
  }

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    fetch("/api/master/locations/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.locations && Array.isArray(data.locations)) {
          setLocations(data.locations);
        }
      })
      .catch(() => {});
  }, []);

  const loadPage = useCallback(
    async (requestCursor) => {
      const params = new URLSearchParams({
        paged: "cursor",
        limit: "10",
      });
      if (locationFilter) params.set("location", locationFilter);
      if (yearFilter) params.set("year", yearFilter);
      if (searchDebounced.trim()) {
        params.set("search", searchDebounced.trim());
      }
      if (requestCursor) params.set("cursor", requestCursor);
      const res = await fetch(
        `/api/qhse/risk-assessment/list?${params.toString()}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      return {
        items: data.data || [],
        hasNext: !!data.hasNext,
      };
    },
    [locationFilter, yearFilter, searchDebounced]
  );

  const cursorResetKey = `${locationFilter}|${yearFilter}|${searchDebounced}`;
  const {
    items,
    loading,
    error,
    setError,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
    setItems,
  } = useQhseMongoCursorList(loadPage, cursorResetKey);

  useEffect(() => {
    setPageLoading(loading);
  }, [loading, setPageLoading]);

  const handleArchive = async (item) => {
    if (!confirm("Archive this risk assessment? It will be stored in QHSE Archive (Risk Assessment).")) return;
    setArchivingId(item._id);
    setError("");
    setActionMessage("");
    try {
      const payload = buildArchivePayload(
        ARCHIVE_MODULES.RISK_ASSESSMENT,
        item,
        item.locationName + (item.version ? ` – v${item.version}` : ""),
        ""
      );
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      setActionMessage("Risk assessment archived successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (item) => {
    if (!canDelete) return;
    if (
      !confirm(
        `Delete this risk assessment (${item.serialNumber || item.locationName})? This cannot be undone.`
      )
    )
      return;
    setDeletingId(item._id);
    setError("");
    setActionMessage("");
    try {
      const res = await fetch(`/api/qhse/risk-assessment/${item._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      setActionMessage("Risk assessment deleted successfully.");
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
            className="flex-shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / Risk Assessment
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Risk Assessments</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-006</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <a
              href="/templates/controlled-register/QAF-OFD-006.xlsx"
              download
              className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
              title="Download form template (QAF-OFD-006)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
              </svg>
              Template
            </a>
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/risk-assessment/form"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Risk Form
              </Link>
              <Link
                href="/qhse/risk-assessment/list"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Risk List
              </Link>
            </div>
          </div>
        </header>

        <QhseListPageContainer
          searchPlaceholder="Search by location, form code, serial..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          filterChildren={
            <div className="flex w-full min-w-0 flex-row flex-nowrap items-center gap-2 sm:max-w-none sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-200 sm:text-xs sm:tracking-[0.2em]">
                  Year
                </span>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-xs leading-tight text-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 sm:px-3 sm:py-2 sm:text-sm"
                >
                  <option value="">All years</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-200 sm:text-xs sm:tracking-[0.2em]">
                  <span className="sm:hidden">Loc</span>
                  <span className="hidden sm:inline">Location</span>
                </span>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-xs leading-tight text-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 sm:px-3 sm:py-2 sm:text-sm"
                >
                  <option value="">All locations</option>
                  {locations.map((loc) => (
                    <option key={loc._id} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
        >
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

          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[680px] text-sm text-left text-slate-200">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-slate-300">
                    <th className="whitespace-nowrap px-3 py-3 sm:px-4">Location</th>
                    <th className="whitespace-nowrap px-3 py-3 sm:px-4">Form Code</th>
                    <th className="whitespace-nowrap px-3 py-3 sm:px-4">Serial No</th>
                    <th className="min-w-[140px] px-3 py-3 sm:px-4">File</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-sm text-slate-300">
                        Loading...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-sm text-slate-300">
                        {searchTerm.trim() ? "No records match your search." : "No records found."}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item._id} className="hover:bg-white/5">
                        <td className="whitespace-nowrap px-3 py-3 font-medium text-white sm:px-4">
                          {item.locationName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 sm:px-4">{item.formCode || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono sm:px-4">{item.serialNumber || "—"}</td>
                        <td className="max-w-[220px] px-3 py-3 sm:max-w-xs sm:px-4">
                          <span className="line-clamp-2 break-words">{item.fileName}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right align-middle sm:px-4">
                          <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                            <span className="relative group inline-flex">
                              <button
                                type="button"
                                onClick={() => handleArchive(item)}
                                disabled={archivingId === item._id || deletingId === item._id}
                                title="Archive"
                                aria-label="Archive"
                                className="p-1.5 rounded text-slate-400 hover:text-slate-300 hover:bg-white/10 disabled:opacity-50 transition"
                              >
                                {archivingId === item._id ? (
                                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                  </svg>
                                )}
                              </button>
                              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-50 px-2 py-1 text-xs font-medium text-white bg-slate-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                                Archive
                              </span>
                            </span>
                            {canDownload && (
                              <span className="relative group inline-flex">
                                <a
                                  href={`/api/qhse/risk-assessment/${item._id}/download`}
                                  download
                                  title="Download as Word"
                                  aria-label="Download as Word"
                                  className="inline-flex rounded p-1.5 text-sky-400 transition hover:bg-white/10 hover:text-sky-300"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </a>
                                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-50 px-2 py-1 text-xs font-medium text-white bg-slate-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                                  Download as Word
                                </span>
                              </span>
                            )}
                            {canDelete && (
                              <span className="relative group inline-flex">
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item)}
                                  disabled={archivingId === item._id || deletingId === item._id}
                                  title="Delete"
                                  aria-label="Delete"
                                  className="p-1.5 rounded text-red-300 hover:text-red-200 hover:bg-red-500/10 disabled:opacity-50 transition"
                                >
                                  {deletingId === item._id ? (
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  )}
                                </button>
                                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-50 px-2 py-1 text-xs font-medium text-white bg-slate-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                                  Delete
                                </span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && items.length > 0 && (
              <div className="px-4 pb-4">
                <QhseCursorPaginationFooter
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                  itemCount={items.length}
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
              </div>
            )}
          </div>
        </QhseListPageContainer>
      </div>
    </div>
  );
}
