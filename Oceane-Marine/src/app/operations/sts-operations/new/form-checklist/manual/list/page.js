"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useOperationsLoading } from "@/app/operations/OperationsLoadingContext";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import {
  ActionDownloadIcon,
  ActionEditIcon,
  ActionDeleteIcon,
} from "@/app/components/RecordActionIcons";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import { QhseListPageContainer } from "@/app/qhse/components/QhseListPageContainer";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import OperationsSelectField from "@/app/operations/components/OperationsSelectField";

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

function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i < currentYear; i++) years.push(i);
  for (let i = currentYear; i <= currentYear + 5; i++) years.push(i);
  return years;
}

export default function ManualListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const initialYears = getYears();
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const [activeTab, setActiveTab] = useState("forms");
  const [expandedModules, setExpandedModules] = useState(new Set(["forms"]));
  const sidebarRef = useRef(null);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [formCode, setFormCode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { setPageLoading } = useOperationsLoading();
  const { isOpsAdmin, canEditForm, canDeleteForm } = useOperationsRole();
  const sidebarTabs = getSidebarTabs(isOpsAdmin);
  const [formCodeOptions, setFormCodeOptions] = useState([]);

  useEffect(() => {
    const fetchFormCodes = async () => {
      try {
        const res = await fetch("/api/operations/form-checklist/manual/form-codes");
        const data = await res.json();
        if (res.ok && data.success) {
          setFormCodeOptions(data.data || []);
        }
      } catch {
        /* fall back to empty */
      }
    };
    fetchFormCodes();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    setPageLoading(true);
    try {
      const params = new URLSearchParams();
      if (year !== "" && year != null) params.set("year", String(year));
      if (formCode) params.set("formCode", formCode);
      const url = `/api/operations/form-checklist/manual/list${params.toString() ? "?" + params.toString() : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load records");
      }
      setRecords(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [year, formCode]);

  const searchFiltered = !searchTerm.trim()
    ? records
    : records.filter((r) => {
        const s = searchTerm.toLowerCase();
        return (
          (r.serialNumber || "").toLowerCase().includes(s) ||
          (r.name || "").toLowerCase().includes(s) ||
          (r.formCode || "").toLowerCase().includes(s) ||
          String(r.revNo ?? r.version ?? "").toLowerCase().includes(s) ||
          (r.uploadedBy || "").toLowerCase().includes(s)
        );
      });

  const pagination = useOperationsClientPagination(
    searchFiltered,
    `${year}|${formCode}|${searchTerm}`
  );
  const { paginatedItems: paginatedRecords, ...paginationFooterProps } = pagination;

  const handleDownload = async (record) => {
    setDownloading(record._id);
    try {
      const res = await fetch(
        `/api/operations/form-checklist/manual/${record._id}/download`
      );

      if (!res.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = record.filePath.split("/").pop() || `manual-rev${record.revNo || record.version || "1.0"}.pdf`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download file");
    } finally {
      setDownloading(null);
    }
  };

  const handleEdit = (record) => {
    router.push(`/operations/sts-operations/new/form-checklist/manual/form?edit=${record._id}`);
  };

  const handleDelete = async (record) => {
    if (!confirm(`Delete "${record.name || record.formCode || "this manual"}" (Rev ${record.revNo || record.version || "1.0"})? This cannot be undone.`)) {
      return;
    }
    setDeleting(record._id);
    setError(null);
    try {
      const res = await fetch(`/api/operations/form-checklist/manual/${record._id}/delete`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setRecords((prev) => prev.filter((r) => r._id !== record._id));
    } catch (err) {
      setError(err.message || "Failed to delete record");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent text-white flex">
        <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
          <div className="flex items-center justify-center h-screen">
            <p className="text-white/60">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-transparent text-white flex flex-col">
      {/* Left Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full w-[260px] sm:w-[300px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-white/20 shadow-2xl backdrop-blur-md z-50 transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        
      >
        <div className="flex flex-col h-full">
          {/* Header */}
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

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent transition-all duration-200">
            <div className="space-y-1.5">
              {sidebarTabs.map((tab) => (
                <div key={tab.key} className="space-y-1">
                  {tab.submodules ? (
                    <>
                      <button
                        onClick={() => {
                          setExpandedModules((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(tab.key)) {
                              newSet.delete(tab.key);
                            } else {
                              newSet.add(tab.key);
                            }
                            return newSet;
                          });
                        }}
                        className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                          activeTab === tab.key
                            ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-[1.02]"
                            : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 hover:scale-[1.01]"
                        }`}
                      >
                        <span className="flex-1">{tab.label}</span>
                        <span
                          className={`text-sm transition-transform ${
                            expandedModules.has(tab.key) ? "rotate-90" : ""
                          }`}
                        >
                          ▶
                        </span>
                        {activeTab === tab.key && (
                          <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                        )}
                      </button>
                      {expandedModules.has(tab.key) && (
                        <div className="ml-4 space-y-1 mt-1.5 pl-4 border-l-2 border-orange-500/30">
                          {tab.submodules.map((submodule) => {
                            const isActiveSub = isFormsSubmoduleSidebarActive(
                              pathname,
                              submodule.href
                            );
                            return (
                              <Link
                                key={submodule.key}
                                href={submodule.href}
                                className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
                                  isActiveSub
                                    ? "bg-gradient-to-r from-orange-500/90 to-orange-600/90 text-white border-orange-400 shadow-lg"
                                    : "text-white/80 hover:bg-white/10 hover:text-white border-white/5 hover:border-white/10"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-xs">▸</span>
                                  {submodule.label}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={tab.href}
                      className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                        activeTab === tab.key
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-[1.02]"
                          : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 hover:scale-[1.01]"
                      }`}
                    >
                      <span className="flex-1">{tab.label}</span>
                      {activeTab === tab.key && (
                        <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                      )}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-slate-800/50">
            <p className="text-[10px] text-slate-400 text-center">
              Operations Management System
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar Toggle Button */}
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

      {/* Main Content - no scroll, fit on one screen */}
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
                Operations / Forms & Checklist / Manual
              </p>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Manual</h1>
              <p className="text-xs sm:text-sm text-slate-200 mt-1">View and manage all Manual records</p>
            </div>
            <div className="flex w-full shrink-0 justify-center md:w-auto md:justify-end">
              <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                <Link
                  href="/operations/sts-operations/new/form-checklist/manual/form"
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-white/90 hover:bg-white/10 transition whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm"
                >
                  Manual Form
                </Link>
                <Link
                  href="/operations/sts-operations/new/form-checklist/manual/list"
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-orange-500 hover:bg-orange-600 transition whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm"
                >
                  Manual List
                </Link>
                {isOpsAdmin && (
                  <Link
                    href="/operations/sts-operations/new/form-checklist/manual/admin"
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-white/90 hover:bg-white/10 transition whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm"
                  >
                    Admin
                  </Link>
                )}
              </div>
            </div>
          </header>

          <QhseListPageContainer
            searchPlaceholder="Search by serial, name, form code, revision, uploaded by..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterChildren={
              <div className="flex w-full min-w-0 flex-row flex-nowrap items-center gap-2 sm:gap-3">
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
                    Form
                  </span>
                  <OperationsSelectField
                    variant="pill"
                    ariaLabel="Form filter"
                    value={formCode}
                    onChange={(v) => setFormCode(v)}
                    options={[
                      { value: "", label: "All forms" },
                      ...formCodeOptions.map((opt) => ({
                        value: opt.code,
                        label: opt.code,
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
              <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
                {error}
              </div>
            )}

            {records.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-white/60">No records found for the selected filters.</p>
                <Link
                  href="/operations/sts-operations/new/form-checklist/manual/form"
                  className="mt-4 inline-block px-6 py-3 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition"
                >
                  Upload New Record
                </Link>
              </div>
            ) : searchFiltered.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-white/60">No rows match your search.</p>
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
            <div>
              <table className="w-full min-w-[800px]">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                      Serial No
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                      Form Code
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                      Rev No
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                      Rev Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-white/90 uppercase tracking-wider whitespace-nowrap w-[1%] min-w-[220px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {paginatedRecords.map((record) => (
                    <tr key={record._id} className="hover:bg-white/5 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-sky-300">
                          {record.serialNumber || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-white">
                          {record.name || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-white">
                          {record.formCode || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-white/90">
                          {record.revNo || record.version || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-white/90">
                          {formatDate(record.revDate || record.uploadedAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-white/90">
                          {formatDate(record.date)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap w-[1%] min-w-[220px]">
                        <div className="flex items-center justify-end gap-2 flex-shrink-0">
                          <ActionDownloadIcon
                            onClick={() => handleDownload(record)}
                            disabled={downloading === record._id}
                            loading={downloading === record._id}
                            title="Download"
                          />
                          {canEditForm && (
                            <ActionEditIcon onClick={() => handleEdit(record)} title="Edit" />
                          )}
                          {canDeleteForm && (
                            <ActionDeleteIcon
                              onClick={() => handleDelete(record)}
                              disabled={deleting === record._id}
                              loading={deleting === record._id}
                              title="Delete"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <OperationsListPaginationFooter {...paginationFooterProps} />
              </div>
            )}
          </QhseListPageContainer>
        </div>
      </div>
    </div>
  );
}
