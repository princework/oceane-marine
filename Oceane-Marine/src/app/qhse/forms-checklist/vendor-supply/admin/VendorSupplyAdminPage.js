"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../../utils/archive";
import { ArchiveIconButton, DeleteIconButton, ViewIconButton, ApproveIconButton, RejectIconButton, DownloadIconButton } from "../../../components/ActionIcons";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QhseListPageContainer } from "../../../components/QhseListPageContainer";
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

function getStatusBadge(status) {
  const map = {
    DRAFT: {
      label: "Draft",
      classes: "bg-slate-700/40 border-slate-400/60 text-slate-100",
    },
    UNDER_REVIEW: {
      label: "Under Review",
      classes: "bg-yellow-500/20 border-yellow-500/50 text-yellow-300",
    },
    APPROVED: {
      label: "Approved",
      classes: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300",
    },
    REJECTED: {
      label: "Rejected",
      classes: "bg-red-500/20 border-red-500/50 text-red-300",
    },
  };

  const cfg = map[status] || map.DRAFT;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}

function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i < currentYear; i++) years.push(i);
  for (let i = currentYear; i <= currentYear + 5; i++) years.push(i);
  return years;
}

export default function VendorSupplyAdminPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canApprove, canDelete, canDownload, isQhseAdmin } = useQhseRole();
  const initialYears = getYears();
  const [searchDebounced, setSearchDebounced] = useState("");
  const [actionId, setActionId] = useState(null); // approving
  const [filter, setFilter] = useState("UNDER_REVIEW"); // UNDER_REVIEW, APPROVED, REJECTED, ALL
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingId, setRejectingId] = useState(null);
  const [showRejectFor, setShowRejectFor] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [downloadingDocx, setDownloadingDocx] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const [year, setYear] = useState("");
  const [availableYears, setAvailableYears] = useState(initialYears);
  const [loadingYears, setLoadingYears] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadPage = useCallback(
    async (requestCursor) => {
      const params = new URLSearchParams({
        paged: "cursor",
        limit: "10",
        excludeDraft: "1",
        status: filter,
      });
      if (year !== "" && year != null) {
        params.set("year", String(year));
      }
      if (searchDebounced.trim()) {
        params.set("search", searchDebounced.trim());
      }
      if (requestCursor) params.set("cursor", requestCursor);
      const res = await fetch(
        `/api/qhse/form-checklist/vendor-supply-form/list?${params.toString()}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load vendor approvals");
      }
      // Merge dynamic years from API so historical records stay selectable.
      if (Array.isArray(data.years)) {
        setAvailableYears((prev) =>
          Array.from(new Set([...prev, ...data.years])).sort((a, b) => b - a)
        );
      }
      setLoadingYears(false);
      return {
        items: data.data || [],
        hasNext: !!data.hasNext,
      };
    },
    [year, filter, searchDebounced]
  );

  const cursorResetKey = `${year}|${filter}|${searchDebounced}`;
  const {
    items: forms,
    loading,
    error,
    setError,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
    refreshFirstPage,
    setItems: setForms,
  } = useQhseMongoCursorList(loadPage, cursorResetKey);

  useEffect(() => {
    setPageLoading(loading);
  }, [loading, setPageLoading]);

  const handleApprove = async (id) => {
    if (!canApprove) return;
    if (!confirm("Are you sure you want to approve this vendor/supplier form?"))
      return;

    setActionId(id);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/vendor-supply-form/${id}/approval`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "APPROVED",
            approvedBy: "admin", // TODO: replace with real user id
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve form");
      }
      await refreshFirstPage();
    } catch (err) {
      setError(err.message || "Failed to approve form");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id) => {
    if (!canApprove) return;
    if (!rejectionReason.trim()) {
      setError("Please provide a rejection reason");
      return;
    }

    setRejectingId(id);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/vendor-supply-form/${id}/approval`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "REJECTED",
            rejectionReason: rejectionReason.trim(),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject form");
      }

      setRejectionReason("");
      setShowRejectFor(null);
      await refreshFirstPage();
    } catch (err) {
      setError(err.message || "Failed to reject form");
    } finally {
      setRejectingId(null);
    }
  };

  const handleDownloadDocx = async (form) => {
    setDownloadingDocx(form._id);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/vendor-supply-form/${form._id}/download`
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to download document");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Vendor-Supplier-Approval-${form.serialNumber || form._id}.docx`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download document");
    } finally {
      setDownloadingDocx(null);
    }
  };

  const handleDownloadPdf = async (form) => {
    setDownloadingPdf(form._id);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/vendor-supply-form/${form._id}/download/pdf`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download PDF");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Vendor-Supplier-Approval-${form.serialNumber || form._id}.pdf`;
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

  const handleArchive = async (form) => {
    if (!confirm("Archive this form? It will be stored in QHSE Archive (Vendor Supply).")) return;
    setArchivingId(form._id);
    setError("");
    try {
      const title = form.vendorName || form._id;
      const payload = buildArchivePayload(ARCHIVE_MODULES.VENDOR_SUPPLY, form, title, form.formCode);
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setForms((prev) => prev.filter((f) => f._id !== form._id));
    } catch (err) {
      setError(err.message || "Failed to archive");
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (form) => {
    if (!canDelete) return;
    if (!confirm("Are you sure you want to delete this form? This cannot be undone.")) return;
    setDeleting(form._id);
    setError("");
    try {
      const res = await fetch(`/api/qhse/form-checklist/vendor-supply-form/${form._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setForms((prev) => prev.filter((f) => f._id !== form._id));
    } catch (err) {
      setError(err.message || "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
        {/* Header */}
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/dashboard"
            className="flex-shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / Forms & Checklist / Vendor & Supplier
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              Vendor / Supplier Approval – Admin Review
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-037</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/forms-checklist/vendor-supply/form"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Vendor Form
              </Link>
              <Link
                href="/qhse/forms-checklist/vendor-supply/list"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Vendor List
              </Link>
              <Link
                href="/qhse/forms-checklist/vendor-supply/admin"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Vendor Admin
              </Link>
            </div>
          </div>
        </header>

        <QhseListPageContainer
          searchPlaceholder="Search by serial, form code, vendor..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          filterChildren={
            <>
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
              {["UNDER_REVIEW", "APPROVED", "REJECTED", "ALL"].map((key) => {
                const labelMap = {
                  UNDER_REVIEW: "Pending Review",
                  APPROVED: "Approved",
                  REJECTED: "Rejected",
                  ALL: "All",
                };
                const active = filter === key;
                const base = "px-4 py-2 rounded-lg text-sm font-medium transition border";
                const activeClass =
                  key === "UNDER_REVIEW"
                    ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/50"
                    : key === "APPROVED"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                    : key === "REJECTED"
                    ? "bg-red-500/20 text-red-300 border-red-500/50"
                    : "bg-slate-700/50 text-white/80 border-sky-400/40";
                const inactiveClass = "bg-slate-800/40 text-white/70 border-slate-500/40 hover:bg-slate-700/60";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFilter(key);
                      setShowRejectFor(null);
                      setRejectionReason("");
                    }}
                    className={`${base} ${active ? activeClass : inactiveClass}`}
                  >
                    {labelMap[key]}
                  </button>
                );
              })}
            </>
          }
        >
          {error && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
              {error}
            </div>
          )}
          {loading ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center text-white/60 text-sm">
              Loading…
            </div>
          ) : forms.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
            <p className="text-white/60 text-sm">
              {searchTerm.trim()
                ? "No vendor/supplier forms match your search."
                : filter === "UNDER_REVIEW"
                ? "No vendor/supplier forms pending review."
                : filter === "APPROVED"
                ? "No approved vendor/supplier forms."
                : filter === "REJECTED"
                ? "No rejected vendor/supplier forms."
                : "No vendor/supplier forms found."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {forms.map((form) => (
              <div
                key={form._id}
                className="bg-white/5 border border-white/10 rounded-xl px-6 py-4 space-y-3 hover:border-white/20 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-sm font-semibold text-white/90 truncate max-w-sm">
                        {form.vendorName || "Unnamed Vendor"}
                      </h2>
                      {form.serialNumber && (
                        <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 font-mono">
                          {form.serialNumber}
                        </span>
                      )}
                      {getStatusBadge(form.status)}
                      {typeof form.overallPercentageScore === "number" && (
                        <span className="text-xs text-sky-300 font-semibold">
                          Overall Score: {form.overallPercentageScore}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/60 line-clamp-1">
                      {form.vendorAddress || "No address provided"}
                    </p>
                    <div className="flex flex-wrap gap-4 text-[11px] text-white/50">
                      <span>Date: {formatDate(form.date)}</span>
                      <span>
                        Created: {formatDate(form.createdAt)} • Updated:{" "}
                        {formatDate(form.updatedAt)}
                      </span>
                      <span>
                        Requested By: {form.requestedBy || "Not specified"}
                      </span>
                    </div>
                  </div>

                  <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                    <ViewIconButton
                      onClick={() =>
                        setExpandedId(
                          expandedId === form._id ? null : form._id
                        )}
                      title={expandedId === form._id ? "Hide details" : "View details"}
                    />
                    {canDownload && (
                      <DownloadIconButton
                        onClick={() => handleDownloadDocx(form)}
                        disabled={
                          downloadingDocx === form._id ||
                          downloadingPdf === form._id
                        }
                        loading={downloadingDocx === form._id}
                        title="Download as Word"
                      />
                    )}
                    {canDownload && (
                      <DownloadIconButton
                        onClick={() => handleDownloadPdf(form)}
                        disabled={
                          downloadingPdf === form._id ||
                          downloadingDocx === form._id
                        }
                        loading={downloadingPdf === form._id}
                        title="Download as PDF"
                        className="!text-rose-400 hover:!text-rose-300"
                      />
                    )}
                    {canApprove && form.status === "UNDER_REVIEW" && expandedId === form._id && (
                      <>
                        <ApproveIconButton
                          onClick={() => handleApprove(form._id)}
                          disabled={actionId === form._id}
                          loading={actionId === form._id}
                        />
                        <RejectIconButton
                          onClick={() => {
                            setShowRejectFor(
                              showRejectFor === form._id ? null : form._id
                            );
                            setRejectionReason("");
                          }}
                          disabled={rejectingId === form._id}
                          loading={rejectingId === form._id}
                        />
                      </>
                    )}
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
                </div>

                {/* Detail view when expanded */}
                {expandedId === form._id && (
                  <div className="mt-3 border-t border-white/10 pt-3 space-y-4">
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-white/80">
                      <div className="space-y-1">
                        <p className="text-xs text-white/60">Vendor Name</p>
                        <p>{form.vendorName || "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-white/60">Vendor Address</p>
                        <p>{form.vendorAddress || "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-white/60">Date</p>
                        <p>{formatDate(form.date)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-white/60">Requested By</p>
                        <p>{form.requestedBy || "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-white/60">For Accounts (Sign)</p>
                        <p>{form.forAccountsSign || "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-white/60">Parts % score</p>
                        <p>
                          {form.supplyOfParts?.percentageScore ??
                            "Not calculated"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-white/60">
                          Services % score
                        </p>
                        <p>
                          {form.supplyOfServices?.percentageScore ??
                            "Not calculated"}
                        </p>
                      </div>
                    </div>

                    {(form.requestedBySignatureImage ||
                      form.forAccountsSignSignatureImage) && (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-white/60">
                            Requested By – Signature
                          </p>
                          {form.requestedBySignatureImage ? (
                            <div className="inline-block rounded-md border border-white/15 bg-white p-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={form.requestedBySignatureImage}
                                alt="Requested by signature"
                                className="h-20 w-auto max-w-full object-contain"
                              />
                            </div>
                          ) : (
                            <p className="text-xs text-white/50 italic">
                              No signature uploaded
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-white/60">
                            For Accounts – Signature
                          </p>
                          {form.forAccountsSignSignatureImage ? (
                            <div className="inline-block rounded-md border border-white/15 bg-white p-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={form.forAccountsSignSignatureImage}
                                alt="For accounts signature"
                                className="h-20 w-auto max-w-full object-contain"
                              />
                            </div>
                          ) : (
                            <p className="text-xs text-white/50 italic">
                              No signature uploaded
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Rejection reason section */}
                {showRejectFor === form._id && (
                  <div className="mt-3 border-t border-white/10 pt-3 space-y-2">
                    <label className="text-xs font-medium text-white/70">
                      Rejection Reason
                    </label>
                    <textarea
                      rows={3}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full rounded-xl border border-red-400/50 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-red-400/80"
                      placeholder="Provide a reason for rejection..."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowRejectFor(null);
                          setRejectionReason("");
                        }}
                        className="px-4 py-2 rounded-full text-xs font-semibold border border-white/25 bg-white/5 text-white/80 hover:bg-white/10 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(form._id)}
                        disabled={rejectingId === form._id}
                        className="px-4 py-2 rounded-full text-xs font-semibold border border-red-400/60 bg-red-500/20 text-red-100 hover:bg-red-500/30 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {rejectingId === form._id
                          ? "Rejecting..."
                          : "Confirm Reject"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
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
          </div>
        )}
        </QhseListPageContainer>
      </div>
    </div>
  );
}


