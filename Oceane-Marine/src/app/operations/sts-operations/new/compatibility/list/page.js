"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useOperationsLoading } from "@/app/operations/OperationsLoadingContext";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { QhseListPageContainer } from "@/app/qhse/components/QhseListPageContainer";
import {
  ActionViewIconLink,
  ActionEditIconLink,
  ActionDeleteIcon,
  ActionDownloadIcon,
} from "@/app/components/RecordActionIcons";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import { getSidebarTabs } from "@/app/operations/sts-operations/new/sidebarTabs";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import OperationsSelectField from "@/app/operations/components/OperationsSelectField";

function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i < currentYear; i++) years.push(i);
  for (let i = currentYear; i <= currentYear + 5; i++) years.push(i);
  return years;
}

function calcTypeLabel(rec) {
  const hasHose = rec.results?.hose?.HoseCal != null || rec.results?.hose?.FreeboardDiff != null;
  const hasFender = rec.results?.fender?.EDC != null || rec.results?.fender?.Fenderselect_Calm;
  return hasHose ? "Hose Calculation" : hasFender ? "Fender Calculation" : "—";
}

export default function CompatibilityListPage() {
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const [activeTab, setActiveTab] = useState("compatibility");
  const [expandedModules, setExpandedModules] = useState(new Set());
  const sidebarRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [downloadingDocx, setDownloadingDocx] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [locationId, setLocationId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { setPageLoading } = useOperationsLoading();
  const { canEditCompatibility, canDeleteCompatibility, isOpsAdmin } = useOperationsRole();
  const sidebarTabs = getSidebarTabs(isOpsAdmin);

  useEffect(() => {
    fetch("/api/master/locations/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.locations) setLocations(data.locations);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setPageLoading(true);
    const params = new URLSearchParams();
    if (year !== "" && year != null) params.set("year", String(year));
    if (locationId) params.set("locationId", locationId);
    fetch(`/api/operations/compatibility/list?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setRecords(data.data || []);
        else setError(data.error || "Failed to load");
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoading(false);
        setPageLoading(false);
      });
  }, [year, locationId, setPageLoading]);

  async function downloadCompatibilityFile(rec, format) {
    const isPdf = format === "pdf";
    const setLoading = isPdf ? setDownloadingPdf : setDownloadingDocx;
    setLoading(rec._id);
    try {
      const url = isPdf
        ? `/api/operations/compatibility/${rec._id}/download/pdf`
        : `/api/operations/compatibility/${rec._id}/download`;
      const res = await fetch(url);
      if (!res.ok) {
        let msg = isPdf ? "Failed to download PDF" : "Failed to download document";
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const fallbackExt = isPdf ? "pdf" : "docx";
      const fileName = match
        ? match[1]
        : `Compatibility-${rec.operationNumber || rec._id}.${fallbackExt}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  const initialYears = getYears();

  const searchFiltered = !searchTerm.trim()
    ? records
    : records.filter((rec) => {
        const s = searchTerm.toLowerCase();
        const typeLabel = calcTypeLabel(rec);
        return (
          (rec.operationNumber || "").toLowerCase().includes(s) ||
          String(rec.year ?? "").includes(s) ||
          (rec.location?.name || "").toLowerCase().includes(s) ||
          (rec.STBL?.name || "").toLowerCase().includes(s) ||
          (rec.SS?.name || "").toLowerCase().includes(s) ||
          typeLabel.toLowerCase().includes(s)
        );
      });

  const pagination = useOperationsClientPagination(
    searchFiltered,
    `${searchTerm}|${year}|${locationId}`
  );
  const { paginatedItems: paginatedRecords, ...paginationFooterProps } = pagination;

  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {/* Sidebar - same as compatibility form */}
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full w-[260px] sm:w-[300px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-white/20 shadow-2xl backdrop-blur-md z-50 transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-orange-500/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30">
                <span className="text-white text-xl">⚡</span>
              </div>
              <h2 className="text-lg font-bold text-white">Operations Modules</h2>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition hover:scale-110"
              aria-label="Close sidebar"
            >
              <span className="text-white text-lg">×</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1.5">
              {sidebarTabs.map((tab) => (
                <div key={tab.key} className="space-y-1">
                  {tab.submodules ? (
                    <>
                      <button
                        onClick={() => {
                          setExpandedModules((prev) => {
                            const next = new Set(prev);
                            if (next.has(tab.key)) next.delete(tab.key);
                            else next.add(tab.key);
                            return next;
                          });
                        }}
                        className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                          activeTab === tab.key ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white" : "text-white/90 hover:bg-white/10"
                        }`}
                      >
                        <span className="flex-1">{tab.label}</span>
                        <span className={`text-sm transition-transform ${expandedModules.has(tab.key) ? "rotate-90" : ""}`}>▶</span>
                      </button>
                      {expandedModules.has(tab.key) && (
                        <div className="ml-4 space-y-1 mt-1.5 pl-4 border-l-2 border-orange-500/30">
                          {tab.submodules.map((sub) => (
                            <Link
                              key={sub.key}
                              href={sub.href}
                              className="block w-full text-left px-4 py-2.5 rounded-lg text-sm text-white/80 hover:bg-white/10"
                            >
                              {sub.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={tab.href}
                      className={`block px-4 py-3 rounded-xl text-base font-medium ${
                        activeTab === tab.key ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white" : "text-white/90 hover:bg-white/10"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 border-t border-white/10 bg-slate-800/50">
            <p className="text-[10px] text-slate-400 text-center">Operations Management System</p>
          </div>
        </div>
      </div>

      {!isSidebarOpen && (
        <div className="fixed left-4 top-4 z-40 flex items-center gap-2">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition border border-orange-400/30 shadow-lg shadow-orange-500/30 hover:scale-110"
            aria-label="Open sidebar"
          >
            <span className="text-white text-xl">☰</span>
          </button>
          <Link
            href="/dashboard"
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
        </div>
      )}

      <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
        <div className={`w-full mx-auto py-6 sm:py-10 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`}>
          <header
            className={`${isSidebarOpen ? "mt-0" : "mt-8 md:mt-0"} mb-2 flex w-full flex-col items-center gap-3 md:flex-row md:items-center md:justify-between md:gap-4`}
          >
            <Link
              href="/dashboard"
              className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
            >
              ← Dashboard
            </Link>
            <div className="flex w-full flex-col items-center text-center md:w-auto md:flex-1">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
                Operations / Compatibility
              </p>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Compatibility List</h1>
              <p className="text-xs sm:text-sm text-slate-200 mt-1">View operations by year and location</p>
            </div>
            <div className="flex w-full shrink-0 justify-center md:w-auto md:justify-end">
              <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                <Link
                  href="/operations/sts-operations/new/compatibility?section=hose"
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition whitespace-nowrap"
                >
                  Hose Calculation
                </Link>
                <Link
                  href="/operations/sts-operations/new/compatibility?section=fender"
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition whitespace-nowrap"
                >
                  Fender Calculation
                </Link>
                <Link
                  href="/operations/sts-operations/new/compatibility/list"
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition whitespace-nowrap"
                >
                  List
                </Link>
              </div>
            </div>
          </header>

          <QhseListPageContainer
            searchPlaceholder="Search by operation no., year, location, STBL, SS, calculation type..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterChildren={
              <div className="flex w-full min-w-0 flex-row flex-nowrap items-center gap-2 sm:max-w-none sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-200 sm:text-xs sm:tracking-[0.2em]">
                    Year
                  </span>
                  <OperationsSelectField
                    variant="pill"
                    ariaLabel="Year filter"
                    value={year === "" || year === null ? "" : String(year)}
                    onChange={(v) => setYear(v === "" ? "" : Number(v))}
                    options={[
                      { value: "", label: "All years" },
                      ...initialYears.map((y) => ({ value: String(y), label: String(y) })),
                    ]}
                    className="min-w-0 flex-1"
                    triggerClassName="ops-select-trigger min-w-0 flex-1 rounded-full px-2 py-1 text-[11px] tracking-wide uppercase sm:px-3 sm:text-xs"
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-200 sm:text-xs sm:tracking-[0.2em]">
                    <span className="sm:hidden">Loc</span>
                    <span className="hidden sm:inline">Location</span>
                  </span>
                  <OperationsSelectField
                    variant="pill"
                    ariaLabel="Location filter"
                    value={locationId || ""}
                    onChange={(v) => setLocationId(v)}
                    options={[
                      { value: "", label: "All locations" },
                      ...locations.map((loc) => ({
                        value: String(loc._id),
                        label: loc.name,
                      })),
                    ]}
                    className="min-w-0 flex-1"
                    triggerClassName="ops-select-trigger min-w-0 flex-1 rounded-full px-2 py-1 text-[11px] tracking-wide uppercase sm:px-3 sm:text-xs"
                  />
                </div>
              </div>
            }
          >
            {error && (
              <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div
                className="rounded-2xl border border-white/10 overflow-hidden p-12 text-center text-white/90"
                style={{ backgroundColor: "#2C4257" }}
              >
                Loading...
              </div>
            ) : records.length === 0 ? (
              <div
                className="rounded-2xl border border-white/10 overflow-hidden p-12 text-center"
                style={{ backgroundColor: "#2C4257" }}
              >
                <p className="text-white/90">No operations found for the selected year and location.</p>
                <Link
                  href="/operations/sts-operations/new/compatibility"
                  className="mt-4 inline-block px-6 py-3 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition"
                >
                  Add New Operation
                </Link>
              </div>
            ) : searchFiltered.length === 0 ? (
              <div
                className="rounded-2xl border border-white/10 overflow-hidden p-12 text-center"
                style={{ backgroundColor: "#2C4257" }}
              >
                <p className="text-white/90">No rows match your search.</p>
              </div>
            ) : (
              <div
                className="flex flex-col rounded-2xl border border-white/10 shadow-xl"
                style={{ backgroundColor: "#2C4257" }}
              >
                <div className="min-w-0 overflow-x-auto overflow-hidden rounded-t-2xl">
                  <table className="w-full border-collapse">
                    <thead className="border-b border-white/10" style={{ backgroundColor: "#23374D" }}>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Operation No</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Year</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">STBL</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">SS</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Calculation type</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-white/90 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {paginatedRecords.map((rec, index) => {
                      const typeLabel = calcTypeLabel(rec);
                      return (
                        <tr key={rec._id} className="hover:opacity-90 transition-opacity" style={{ backgroundColor: index % 2 === 0 ? "#2C4257" : "#23374D" }}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-white">{rec.operationNumber || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-white/90">{rec.year ?? "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-white/90">{rec.location?.name || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-white/90">{rec.STBL?.name || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-white/90">{rec.SS?.name || "—"}</td>
                          <td className="px-4 py-3 text-sm text-white/90">{typeLabel}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <ActionViewIconLink
                                href={`/operations/sts-operations/new/compatibility/view/${rec._id}`}
                                title="View"
                              />
                              <ActionDownloadIcon
                                onClick={() => downloadCompatibilityFile(rec, "docx")}
                                disabled={
                                  downloadingDocx === rec._id ||
                                  downloadingPdf === rec._id
                                }
                                loading={downloadingDocx === rec._id}
                                title="Download Word"
                                className="!border-sky-400/50 !text-sky-300 hover:!bg-sky-500/15"
                              />
                              <ActionDownloadIcon
                                onClick={() => downloadCompatibilityFile(rec, "pdf")}
                                disabled={
                                  downloadingDocx === rec._id ||
                                  downloadingPdf === rec._id
                                }
                                loading={downloadingPdf === rec._id}
                                title="Download PDF"
                                className="!border-rose-400/50 !text-rose-300 hover:!bg-rose-500/15"
                              />
                              {canEditCompatibility && (
                                <ActionEditIconLink
                                  href={`/operations/sts-operations/new/compatibility?edit=${rec._id}`}
                                  title="Edit"
                                />
                              )}
                              {canDeleteCompatibility && <ActionDeleteIcon
                                onClick={async () => {
                                  if (!confirm(`Are you sure you want to delete operation ${rec.operationNumber}? This action cannot be undone.`)) {
                                    return;
                                  }
                                  setDeleting(rec._id);
                                  try {
                                    const res = await fetch(`/api/operations/compatibility/${rec._id}/delete`, { method: "DELETE" });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error || "Failed to delete");
                                    const fetchRecords = async () => {
                                      const params = new URLSearchParams();
                                      if (year !== "" && year != null) params.set("year", String(year));
                                      if (locationId) params.set("locationId", locationId);
                                      const url = `/api/operations/compatibility/list${params.toString() ? `?${params.toString()}` : ""}`;
                                      const res2 = await fetch(url);
                                      const data2 = await res2.json();
                                      if (res2.ok) setRecords(data2.data || []);
                                    };
                                    await fetchRecords();
                                  } catch (err) {
                                    setError(err.message);
                                  } finally {
                                    setDeleting(null);
                                  }
                                }}
                                disabled={deleting === rec._id}
                                loading={deleting === rec._id}
                                title="Delete"
                              />}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <OperationsListPaginationFooter
                  {...paginationFooterProps}
                  className="rounded-b-2xl"
                />
              </div>
            )}
          </QhseListPageContainer>
        </div>
      </div>
    </div>
  );
}
