"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useOperationsLoading } from "@/app/operations/OperationsLoadingContext";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import {
  ActionDownloadIcon,
  ActionEditIcon,
  ActionDeleteIcon,
  ActionViewIcon,
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

export default function QuotationListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const initialYears = getYears();
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const [activeTab, setActiveTab] = useState("forms");
  const [expandedModules, setExpandedModules] = useState(new Set(["forms"]));
  const sidebarRef = useRef(null);
  
  const [stsForms, setStsForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [quotationTab, setQuotationTab] = useState("OPS-OFD-030");
  const [searchTerm, setSearchTerm] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const { setPageLoading } = useOperationsLoading();
  const { isOpsAdmin, canEditForm, canDeleteForm } = useOperationsRole();
  const sidebarTabs = getSidebarTabs(isOpsAdmin);

  const fetchStsForms = async () => {
    setLoading(true);
    setError(null);
    setPageLoading(true);
    try {
      const url =
        year !== "" && year != null
          ? `/api/operations/form-checklist/sts-quotation-form/list?year=${year}`
          : "/api/operations/form-checklist/sts-quotation-form/list";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setStsForms(data.data || []);
      else setStsForms([]);
    } catch (err) {
      setError(err.message || "Failed to load quotations");
      setStsForms([]);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchStsForms();
  }, [year]);

  const handleEditSts = (record) => {
    router.push(`/operations/sts-operations/new/form-checklist/quotations/sts-form?edit=${record._id}`);
  };

  const handleDeleteSts = async (record) => {
    if (!confirm(`Are you sure you want to delete this quotation (${record.clientName || record.formType})? This action cannot be undone.`)) {
      return;
    }

    setDeleting(record._id);
    try {
      const res = await fetch(
        `/api/operations/form-checklist/sts-quotation-form/${record._id}/delete`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete record");
      }

      // Refresh the list
      fetchStsForms();
    } catch (err) {
      setError(err.message || "Failed to delete record");
    } finally {
      setDeleting(null);
    }
  };

  const handleDownloadSts = async (record) => {
    setDownloadingId(record._id);
    try {
      const res = await fetch("/api/operations/form-checklist/sts-quotation-form/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId: String(record._id) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `PDF failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotation-${(record.clientName || "quotation").replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to generate PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredForms =
    quotationTab === "POAC"
      ? stsForms.filter((r) => r.formType === "POAC")
      : quotationTab === "OPS-OFD-030B"
        ? stsForms.filter((r) => r.formType === "OPS-OFD-030B")
        : stsForms.filter((r) => r.formType === "OPS-OFD-030");

  const searchFiltered = !searchTerm.trim()
    ? filteredForms
    : filteredForms.filter((r) => {
        const s = searchTerm.toLowerCase();
        return (
          (r.clientName || "").toLowerCase().includes(s) ||
          (r.formType || "").toLowerCase().includes(s) ||
          formatDate(r.proposalDate || r.createdAt).toLowerCase().includes(s)
        );
      });

  const pagination = useOperationsClientPagination(
    searchFiltered,
    `${year}|${quotationTab}|${searchTerm}`
  );
  const { paginatedItems: paginatedQuotations, ...paginationFooterProps } = pagination;

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
    <div className="min-h-screen bg-transparent text-white flex">
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

      {/* Main Content */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
        <div className={`mx-auto py-6 sm:py-10 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`}>
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
              Operations / Forms & Checklist / Quotation
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Quotation</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">View and manage all Quotation records</p>
          </div>
          <div className="flex w-full shrink-0 justify-center md:w-auto md:justify-end">
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/operations/sts-operations/new/form-checklist/quotations/sts-form"
                className="px-2.5 py-1.5 text-[11px] font-semibold text-white/90 hover:bg-white/10 transition whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm"
              >
                Quotation Form
              </Link>
              <Link
                href="/operations/sts-operations/new/form-checklist/quotations/list"
                className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-orange-500 hover:bg-orange-600 transition whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm"
              >
                Quotation List
              </Link>
            </div>
          </div>
        </header>

        <QhseListPageContainer
          searchPlaceholder="Search by client name, form type, date..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          filterChildren={
            <>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
              <OperationsSelectField
                variant="pill"
                ariaLabel="Year filter"
                value={year === "" || year === null ? "" : String(year)}
                onChange={(v) => setYear(v === "" ? "" : Number(v))}
                options={[
                  { value: "", label: "All years" },
                  ...initialYears.map((y) => ({ value: String(y), label: String(y) })),
                ]}
                triggerClassName="ops-select-trigger rounded-full px-3 py-1 text-xs tracking-widest uppercase"
              />
            </>
          }
        >
          {error && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
              {error}
            </div>
          )}

        <div className="w-full overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] lg:overflow-visible">
          <div className="inline-flex min-w-max flex-nowrap rounded-xl border border-white/15 bg-white/5 lg:inline-flex lg:min-w-0 lg:w-full lg:flex-wrap lg:max-w-full">
            {[
              { key: "OPS-OFD-030", label: "STS Proposal (030)" },
              { key: "OPS-OFD-030B", label: "STS Advisor (030B)" },
              { key: "POAC", label: "POAC Quotation" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setQuotationTab(key)}
                className={`min-h-[2.25rem] shrink-0 px-2.5 py-1.5 text-left text-[11px] font-semibold leading-tight transition sm:min-h-0 lg:flex-1 lg:px-3 lg:py-2 lg:text-center lg:text-sm ${
                  quotationTab === key
                    ? "bg-orange-500 text-white"
                    : "text-white/90 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Quotation list */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
            {quotationTab === "POAC"
              ? "POAC Quotations"
              : quotationTab === "OPS-OFD-030B"
                ? "STS Advisor Quotations"
                : "STS Proposal Quotations"}
          </h2>
          {loading ? (
            <p className="text-white/60 text-sm">Loading quotations…</p>
          ) : filteredForms.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <p className="text-white/60 mb-4">
                {`No ${quotationTab === "POAC" ? "POAC" : quotationTab === "OPS-OFD-030B" ? "STS Advisor" : "STS Proposal"} quotations for the selected year.`}
              </p>
              <Link
                href="/operations/sts-operations/new/form-checklist/quotations/sts-form"
                className="inline-block px-6 py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition"
              >
                Create Quotation
              </Link>
            </div>
          ) : searchFiltered.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <p className="text-white/60">No rows match your search.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Form Type</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Client Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Proposal Date</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-white/90 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {paginatedQuotations.map((row) => (
                      <tr key={row._id} className="hover:bg-white/5 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono text-orange-400">{row.formType || "—"}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/90">{row.clientName || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/90">
                          {formatDate(row.proposalDate || row.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/90">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <ActionViewIcon
                              onClick={() => setViewingRecord(row)}
                              title="View details"
                            />
                            <ActionDownloadIcon
                              onClick={() => handleDownloadSts(row)}
                              disabled={downloadingId === row._id}
                              loading={downloadingId === row._id}
                              title="Download PDF"
                            />
                            {canEditForm && (
                              <ActionEditIcon onClick={() => handleEditSts(row)} title="Edit" />
                            )}
                            {canDeleteForm && (
                              <ActionDeleteIcon
                                onClick={() => handleDeleteSts(row)}
                                disabled={deleting === row._id}
                                loading={deleting === row._id}
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
              <OperationsListPaginationFooter {...paginationFooterProps} />
            </div>
          )}
        </section>
        </QhseListPageContainer>
        </div>
      </div>

      {viewingRecord ? (
        <QuotationViewModal
          record={viewingRecord}
          onClose={() => setViewingRecord(null)}
          onEdit={
            canEditForm
              ? () => {
                  const r = viewingRecord;
                  setViewingRecord(null);
                  handleEditSts(r);
                }
              : null
          }
          onDownload={() => handleDownloadSts(viewingRecord)}
          downloading={downloadingId === viewingRecord._id}
        />
      ) : null}
    </div>
  );
}

/* ============================================================ *
 * Read-only quotation details modal (eye-icon action target).  *
 * ============================================================ */

function QuotationViewModal({ record, onClose, onEdit, onDownload, downloading }) {
  /* Portal target: avoids ancestor `backdrop-filter` (e.g. cards using `backdrop-blur-*`)
   * which would otherwise become the containing block for this `position: fixed` overlay. */
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    setPortalTarget(typeof document !== "undefined" ? document.body : null);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!portalTarget) return null;

  const formType = record.formType || "—";
  const isAdvisor = formType === "OPS-OFD-030B";
  const isPoac = formType === "POAC";

  const overlay = (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 sm:p-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Quotation details"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative my-4 w-full max-w-3xl rounded-2xl border border-white/15 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sky-300">Quotation</p>
            <h2 className="text-lg font-semibold text-white truncate">
              {record.clientName || "—"}{" "}
              <span className="ml-2 align-middle text-xs font-mono text-orange-300">
                {formType}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onDownload ? (
              <button
                type="button"
                onClick={onDownload}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60"
              >
                {downloading ? "Generating…" : "Download PDF"}
              </button>
            ) : null}
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
              >
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white/80 hover:bg-white/15 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 text-sm text-white/90 styled-scrollbar">
          <ViewSection title="Client & Proposal (First page / Cover)">
            <ViewField label="Form No" value={record.formNo} />
            <ViewField label="Issue Date" value={formatDate(record.issueDate)} />
            <ViewField label="Client Name" value={record.clientName} />
            <ViewField label="Attn" value={record.attn} />
            <ViewField label="Proposal Date" value={formatDate(record.proposalDate)} />
            <ViewField label="Project Name" value={record.projectName} />
            {isAdvisor ? (
              <>
                <ViewField label="From" value={record.serviceOverviewFrom} />
                <ViewField label="To" value={record.serviceOverviewTo} />
              </>
            ) : null}
          </ViewSection>

          {!isAdvisor ? (
            <>
              <ViewSection title="Cost of Operation">
                <ViewField label="Job Ref #" value={record.jobRef} />
                <ViewField label="Discharging ship(s)" value={record.dischargingShip} />
                <ViewField label="Receiving ship(s)" value={record.receivingShip} />
                <ViewField label="Date" value={formatDate(record.operationDate)} />
                <ViewField label="Location" value={record.location} />
                <ViewField label="Cargo" value={record.cargo} />
                <ViewField
                  label="Quantity"
                  value={
                    record.quantity
                      ? `${record.quantity} ${record.quantityUnit || ""}`.trim()
                      : ""
                  }
                />
                {!isPoac ? (
                  <>
                    <ViewField label="Lump sum (USD)" value={record.lumpSum} />
                    <ViewField label="Thereafter (USD/HR)" value={record.thereafter} />
                    <ViewField label="Free time" value={record.freeTime} />
                    <ViewField label="Availability" value={record.availability} />
                  </>
                ) : (
                  <>
                    <ViewField label="Day Rate (USD)" value={record.dailyRate} />
                    <ViewField
                      label="Flight & Out of Pocket"
                      value={record.flightsTravel}
                    />
                    <ViewField label="Coordination Fee" value={record.managementFee} />
                  </>
                )}
                <ViewField label="Payment terms" value={record.paymentTerms} full />
              </ViewSection>

              <ViewSection title="STS Equipment">
                <ViewField label="Base info / Location" value={record.baseInfoLocation} full />
                <ViewField label="Primary Fenders" value={record.primaryFenders} full />
                <ViewField label="Secondary Fenders" value={record.secondaryFenders} full />
                <ViewField label="Fender Moorings" value={record.fenderMoorings} full />
                <ViewField label="Hoses" value={record.hoses} full />
                <ViewField label="Support Craft" value={record.supportCraft} />
                <ViewField
                  label="Personnel Transfer Basket"
                  value={record.personnelTransferBasket}
                />
              </ViewSection>

              <ViewSection title="Acceptance (Client)">
                <ViewField label="Client Name (Company)" value={record.acceptanceClientName} />
                <ViewField label="Person In Charge" value={record.personInCharge} />
                <ViewField label="Acceptance Date" value={formatDate(record.acceptanceDate)} />
                <ViewField label="Signature" value={record.acceptanceSignatureText} full />
              </ViewSection>
            </>
          ) : (
            <>
              <ViewSection title="POAC Service Charges">
                <ViewField label="Designated STS Advisor" value={record.designatedAdvisor} />
                <ViewField label="Daily Rate (USD)" value={record.dailyRate} />
                <ViewField label="Management Fee (USD)" value={record.managementFee} />
                <ViewField label="Flights & Travel" value={record.flightsTravel} />
                <ViewField label="Local Logistics (UAE)" value={record.localLogistics} />
                <ViewField
                  label="Communication Charges"
                  value={record.communicationCharges}
                />
              </ViewSection>

              <ViewSection title="Acceptance">
                <ViewField label="Name" value={record.acceptanceName} />
                <ViewField label="Date" value={formatDate(record.acceptanceDate030B)} />
                <ViewField label="Address" value={record.acceptanceAddress} full />
                <ViewField label="Email" value={record.acceptanceEmail} />
                <ViewField label="Telephone" value={record.acceptanceTelephone} />
                <ViewField
                  label="Authorized signatory for"
                  value={record.authorizedSignatoryFor}
                  full
                />
              </ViewSection>
            </>
          )}

          <ViewSection title="Record Info">
            <ViewField label="Created" value={formatDate(record.createdAt)} />
            <ViewField label="Last Updated" value={formatDate(record.updatedAt)} />
          </ViewSection>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, portalTarget);
}

function ViewSection({ title, children }) {
  return (
    <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-3 border-b border-white/10 pb-2 text-sm font-semibold uppercase tracking-wider text-sky-300">
        {title}
      </h3>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function ViewField({ label, value, full = false }) {
  const display =
    value == null || value === "" ? <span className="text-white/40">—</span> : String(value);
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-[11px] uppercase tracking-wider text-white/50">{label}</p>
      <p className="mt-0.5 break-words text-sm text-white/90">{display}</p>
    </div>
  );
}

