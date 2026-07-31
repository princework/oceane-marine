"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../../utils/archive";
import { ViewIconButton, ArchiveIconButton, DeleteIconButton, DownloadIconButton } from "../../../components/ActionIcons";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";
import { QhseListPageContainer } from "../../../components/QhseListPageContainer";
import { useQhseMongoCursorList } from "../../../hooks/useQhseMongoCursorList";
import QhseCursorPaginationFooter from "../../../components/QhseCursorPaginationFooter";
import { resolveQhseSignatureImageSrc } from "@/lib/utils/qhse-signature-url";

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

function getSignatureSrc(value) {
  return resolveQhseSignatureImageSrc(value);
}

export default function AuditSubContractorListAdminPage() {
  const { setPageLoading } = useQhseLoading();
  const { canDelete, canApprove, canDownload } = useQhseRole();
  const { contentClassName } = useQhseSidebar();
  const [searchDebounced, setSearchDebounced] = useState("");
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [downloadingDocxId, setDownloadingDocxId] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [filterStatus, setFilterStatus] = useState("Pending"); // "Pending", "Approved", "Rejected", "All"
  const [searchTerm, setSearchTerm] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadPage = useCallback(
    async (requestCursor) => {
      const params = new URLSearchParams({
        paged: "cursor",
        limit: "10",
        status: filterStatus,
      });
      if (searchDebounced.trim()) {
        params.set("search", searchDebounced.trim());
      }
      if (requestCursor) params.set("cursor", requestCursor);
      const res = await fetch(
        `/api/qhse/due-diligence/audit-sub-contractor/list?${params.toString()}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load audit forms");
      }
      return {
        items: data.data || data.subContractorAudits || [],
        hasNext: !!data.hasNext,
      };
    },
    [filterStatus, searchDebounced]
  );

  const cursorResetKey = `${filterStatus}|${searchDebounced}`;
  const {
    items: auditRows,
    loading,
    error,
    setError,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
    refreshFirstPage,
    setItems: setAuditRows,
  } = useQhseMongoCursorList(loadPage, cursorResetKey);

  useEffect(() => {
    setPageLoading(loading);
  }, [loading, setPageLoading]);

  useEffect(() => {
    setSelectedAudit((prev) => {
      if (!prev) return prev;
      const updated = auditRows.find((a) => String(a._id) === String(prev._id));
      return updated || prev;
    });
  }, [auditRows]);

  useEffect(() => {
    if (selectedAudit) {
      const matchesFilter =
        filterStatus === "All" || selectedAudit.status === filterStatus;
      if (!matchesFilter) {
        setSelectedAudit(null);
      }
    }
  }, [filterStatus, selectedAudit]);

  const handleDownloadDocx = async (audit) => {
    if (!canDownload) return;
    setDownloadingDocxId(audit._id);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/due-diligence/audit-sub-contractor/${audit._id}/download`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let fileName = `SubContractor-Audit-${audit.serialNumber || audit._id}.docx`;
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

  const handleDownloadPdf = async (audit) => {
    if (!canDownload) return;
    setDownloadingPdfId(audit._id);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/due-diligence/audit-sub-contractor/${audit._id}/download/pdf`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download PDF");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let fileName = `SubContractor-Audit-${audit.serialNumber || audit._id}.pdf`;
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

  const handleApprove = async (auditId) => {
    if (!canApprove) return;
    if (!confirm("Are you sure you want to approve this audit form?")) {
      return;
    }

    setApproving(auditId);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/due-diligence/audit-sub-contractor/${auditId}/approve`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Check if response is JSON before parsing
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to approve form");
      }

      await refreshFirstPage();
      setSelectedAudit(null);
      alert("Audit form approved successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setApproving(null);
    }
  };

  const openRejectModal = () => {
    if (!canApprove) return;
    setRejectionReasonInput("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!canApprove || !selectedAudit) return;
    const reason = rejectionReasonInput.trim();
    if (!reason) {
      setError("Rejection reason is required.");
      return;
    }

    const auditId = selectedAudit._id;
    setRejecting(auditId);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/due-diligence/audit-sub-contractor/${auditId}/reject`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rejectionReason: reason }),
        }
      );

      // Check if response is JSON before parsing
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reject form");
      }

      setShowRejectModal(false);
      setRejectionReasonInput("");
      await refreshFirstPage();
      setSelectedAudit(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRejecting(null);
    }
  };

  const handleArchive = async (audit) => {
    if (!confirm("Archive this audit form? It will be stored in QHSE Archive (Audit Sub Contractor).")) return;
    setArchivingId(audit._id);
    setError(null);
    try {
      const title = audit.subcontractorName || audit.formCode || audit.serialNumber || audit._id;
      const payload = buildArchivePayload(ARCHIVE_MODULES.AUDIT_SUB_CONTRACTOR, audit, title, audit.formCode);
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      // Keep the form in the list (do not refetch so the archived item stays visible)
      if (selectedAudit?._id === audit._id) setSelectedAudit(null);
      alert("Audit form archived successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (audit) => {
    if (!canDelete) return;
    if (!confirm("Are you sure you want to delete this audit form? This cannot be undone.")) return;
    setDeleting(audit._id);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/due-diligence/audit-sub-contractor/${audit._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setAuditRows((prev) => prev.filter((a) => a._id !== audit._id));
      if (selectedAudit?._id === audit._id) setSelectedAudit(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
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
              QHSE / Due Diligence / Audit Form - Sub Contractor
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Admin Review</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-055</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-055" />
          </div>
        </header>

        <QhseListPageContainer
          searchPlaceholder="Search by serial, form code, sub-contractor, service..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          filterChildren={
            <>
              {["Pending", "Approved", "Rejected", "All"].map((statusKey) => (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => {
                    setFilterStatus(statusKey);
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                    filterStatus === statusKey
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
                      : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {statusKey === "Pending" ? "Pending Review" : statusKey}
                </button>
              ))}
            </>
          }
        >
          {error && (
            <div className="text-xs text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <main className="space-y-6">
          {/* Detail Card - Shows when audit is selected */}
          {selectedAudit && (
            <div className="w-full rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Audit Form Details
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      FORM CODE:{" "}
                      <span className="font-mono text-sky-300">
                        {selectedAudit.formCode || "—"}
                      </span>
                      {" · "}
                      SERIAL:{" "}
                      <span className="font-mono text-sky-300">
                        {selectedAudit.serialNumber || "—"}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border ${
                      selectedAudit.status === "Approved"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                        : selectedAudit.status === "Rejected"
                        ? "bg-red-500/20 text-red-300 border-red-400/50"
                        : "bg-blue-500/20 text-blue-300 border-blue-400/50"
                    }`}
                  >
                    {selectedAudit.status || "Pending"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAudit(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition text-white text-xl font-bold"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Sub-Contractor Details */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                    Sub-Contractor Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Name: </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.subcontractorName || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Address: </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.subcontractorAddress || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Service Type: </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.serviceType || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Contact Person: </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.contactPerson || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Email: </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.emailOfContactPerson || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Phone: </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.phoneOfContactPerson || "—"}
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-slate-400">
                        Operating Areas:{" "}
                      </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.operatingAreas || "—"}
                      </span>
                    </div>
                    <div className="md:col-span-2 rounded-lg border border-sky-400/20 bg-sky-500/5 px-3 py-2">
                      <span className="text-slate-400">Assigned Auditor: </span>
                      <span className="text-sky-200 font-semibold">
                        {selectedAudit.auditorName || "—"}
                      </span>
                      {selectedAudit.auditorEmail && (
                        <span className="text-slate-400"> ({selectedAudit.auditorEmail})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compliance Information */}
                <div className="border-t border-white/10 pt-4 space-y-4">
                  <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                    Compliance Information
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Trade License: </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.tradeLicenseCopyAvailable
                          ? "Yes"
                          : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">HSE Policy: </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.hasHSEPolicy ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">
                        Audits Subcontractors:{" "}
                      </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.auditsSubcontractors ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Has Insurance: </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.hasInsurance ? "Yes" : "No"}
                      </span>
                    </div>
                    {selectedAudit.hasInsurance && (
                      <div className="md:col-span-2">
                        <span className="text-slate-400">
                          Insurance Details:{" "}
                        </span>
                        <span className="text-white font-semibold">
                          {selectedAudit.insuranceDetails || "—"}
                        </span>
                      </div>
                    )}
                    <div className="md:col-span-3">
                      <span className="text-slate-400">
                        ISO Certifications:{" "}
                      </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.isoCertifications?.join(", ") || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Office Use */}
                <div className="border-t border-white/10 pt-4 space-y-4">
                  <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                    Office Use
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">
                        Audit Completed By:{" "}
                      </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.auditCompletedBy?.name || "—"} (
                        {selectedAudit.auditCompletedBy?.designation || "—"})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Signed At: </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.auditCompletedBy?.signedAt
                          ? formatDate(
                              selectedAudit.auditCompletedBy.signedAt
                            )
                          : "—"}
                      </span>
                    </div>
                    {(selectedAudit.auditCompletedBy?.signatureText || getSignatureSrc(selectedAudit.auditCompletedBy?.signaturePhoto)) && (
                      <div className="md:col-span-2">
                        <span className="text-slate-400 block mb-1">Audit Completed By – Signature:</span>
                        {selectedAudit.auditCompletedBy?.signatureText && (
                          <p className="text-white font-semibold mb-1">{selectedAudit.auditCompletedBy.signatureText}</p>
                        )}
                        {getSignatureSrc(selectedAudit.auditCompletedBy?.signaturePhoto) && (
                          <div className="inline-block p-2 rounded-lg border border-white/20 bg-white/5">
                            <img
                              src={getSignatureSrc(selectedAudit.auditCompletedBy.signaturePhoto)}
                              alt="Audit completed by signature"
                              className="max-h-24 w-auto max-w-[200px] border border-white/20 rounded-lg bg-white object-contain block"
                              style={{ minHeight: 48 }}
                              decoding="async"
                              onError={(e) => {
                                e.target.style.display = "none";
                                const fallback = e.target.nextElementSibling;
                                if (fallback) fallback.classList.remove("hidden");
                              }}
                            />
                            <span className="text-slate-500 text-xs hidden">Signature image could not be loaded.</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400">
                        Contractor Approved By:{" "}
                      </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.contractorApprovedBy?.name || "—"} (
                        {selectedAudit.contractorApprovedBy?.designation ||
                          "—"}
                        )
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Signed At: </span>
                      <span className="text-white font-semibold">
                        {selectedAudit.contractorApprovedBy?.signedAt
                          ? formatDate(
                              selectedAudit.contractorApprovedBy.signedAt
                            )
                          : "—"}
                      </span>
                    </div>
                    {(selectedAudit.contractorApprovedBy?.signatureText || getSignatureSrc(selectedAudit.contractorApprovedBy?.signaturePhoto)) && (
                      <div className="md:col-span-2">
                        <span className="text-slate-400 block mb-1">Contractor Approved By – Signature:</span>
                        {selectedAudit.contractorApprovedBy?.signatureText && (
                          <p className="text-white font-semibold mb-1">{selectedAudit.contractorApprovedBy.signatureText}</p>
                        )}
                        {getSignatureSrc(selectedAudit.contractorApprovedBy?.signaturePhoto) && (
                          <div className="inline-block p-2 rounded-lg border border-white/20 bg-white/5">
                            <img
                              src={getSignatureSrc(selectedAudit.contractorApprovedBy.signaturePhoto)}
                              alt="Contractor approved by signature"
                              className="max-h-24 w-auto max-w-[200px] border border-white/20 rounded-lg bg-white object-contain block"
                              style={{ minHeight: 48 }}
                              decoding="async"
                              onError={(e) => {
                                e.target.style.display = "none";
                                const fallback = e.target.nextElementSibling;
                                if (fallback) fallback.classList.remove("hidden");
                              }}
                            />
                            <span className="text-slate-500 text-xs hidden">Signature image could not be loaded.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Approve/Reject Buttons - Only show for Pending forms */}
                {canApprove && selectedAudit.status === "Pending" && (
                  <div className="border-t border-white/10 pt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={openRejectModal}
                      disabled={rejecting === selectedAudit._id || approving === selectedAudit._id}
                      className="px-6 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold uppercase tracking-wider transition disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-red-500/30"
                    >
                      {rejecting === selectedAudit._id
                        ? "Rejecting..."
                        : "Reject Form"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedAudit._id)}
                      disabled={approving === selectedAudit._id || rejecting === selectedAudit._id}
                      className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold uppercase tracking-wider transition disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30"
                    >
                      {approving === selectedAudit._id
                        ? "Approving..."
                        : "Approve Form"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Table Section - Only show when no audit is selected */}
          {!selectedAudit && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-slate-100">Loading forms…</div>
                </div>
              ) : auditRows.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-slate-100">
                    {searchTerm.trim()
                      ? "No audit forms match your search."
                      : `No ${filterStatus === "All" ? "" : `${filterStatus.toLowerCase()} `}forms found.`}
                  </p>
                </div>
              ) : (
                <>
                  <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-200 border-b border-white/10">
                          <th className="py-3 pr-4 font-semibold">
                            Form Code
                          </th>
                          <th className="hidden py-3 pr-4 font-semibold md:table-cell">
                            Serial No
                          </th>
                          <th className="py-3 pr-4 font-semibold">
                            Sub-Contractor Name
                          </th>
                          <th className="py-3 pr-4 font-semibold">
                            Service Type
                          </th>
                          <th className="py-3 pr-4 font-semibold">
                            Auditor
                          </th>
                          <th className="py-3 pr-4 font-semibold">
                            Submitted At
                          </th>
                          <th className="py-3 pr-4 font-semibold">Status</th>
                          <th className="py-3 pr-4 font-semibold text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditRows.map((audit) => (
                          <tr
                            key={audit._id}
                            className="border-b border-white/5 hover:bg-white/5 transition"
                          >
                            <td className="py-3 pr-4">
                              <span className="font-mono text-sky-300">
                                {audit.formCode || "—"}
                              </span>
                            </td>
                            <td className="hidden py-3 pr-4 md:table-cell">
                              <span className="font-mono text-slate-200">
                                {audit.serialNumber || "—"}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <div className="max-w-xs">
                                <p className="text-slate-200">
                                  {audit.subcontractorName || "—"}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              {audit.serviceType || "—"}
                            </td>
                            <td className="py-3 pr-4">
                              <span className="text-sky-200">{audit.auditorName || "—"}</span>
                            </td>
                            <td className="py-3 pr-4">
                              {formatDate(audit.updatedAt)}
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={`inline-flex items-center rounded-lg px-3 py-1 text-[10px] font-semibold uppercase tracking-wider border ${
                                  audit.status === "Approved"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                                    : audit.status === "Rejected"
                                    ? "bg-red-500/20 text-red-300 border-red-400/50"
                                    : "bg-blue-500/20 text-blue-300 border-blue-400/50"
                                }`}
                              >
                                {audit.status || "Pending"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap py-2 pr-3 text-right sm:py-3 sm:pr-4">
                              <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                                {canDownload && (
                                  <DownloadIconButton
                                    onClick={() => handleDownloadDocx(audit)}
                                    disabled={
                                      downloadingDocxId === audit._id ||
                                      downloadingPdfId === audit._id
                                    }
                                    loading={downloadingDocxId === audit._id}
                                    title="Download as Word"
                                  />
                                )}
                                {canDownload && (
                                  <DownloadIconButton
                                    onClick={() => handleDownloadPdf(audit)}
                                    disabled={
                                      downloadingPdfId === audit._id ||
                                      downloadingDocxId === audit._id
                                    }
                                    loading={downloadingPdfId === audit._id}
                                    title="Download as PDF"
                                    className="!text-rose-400 hover:!text-rose-300"
                                  />
                                )}
                                <ViewIconButton
                                  onClick={() => setSelectedAudit(audit)}
                                  title="View Details"
                                />
                                <ArchiveIconButton
                                  onClick={() => handleArchive(audit)}
                                  disabled={archivingId === audit._id || deleting === audit._id}
                                  loading={archivingId === audit._id}
                                />
                                {canDelete && (
                                  <DeleteIconButton
                                    onClick={() => handleDelete(audit)}
                                    disabled={archivingId === audit._id || deleting === audit._id}
                                    loading={deleting === audit._id}
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
                    itemCount={auditRows.length}
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
            </div>
          )}
        </main>
        </QhseListPageContainer>
      </div>

      {showRejectModal && selectedAudit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-reject-modal-title"
        >
          <div className="bg-slate-800 border border-white/15 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="audit-reject-modal-title" className="text-lg font-semibold text-white mb-4">
              Reject Sub Contractor Audit
            </h2>
            <p className="text-slate-300 text-sm mb-3">
              {selectedAudit.subcontractorName || selectedAudit.formCode || "—"}
            </p>
            <label htmlFor="audit-reject-reason" className="block text-sm text-slate-400 mb-1">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              id="audit-reject-reason"
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/5 text-white px-3 py-2 text-sm min-h-[100px] resize-y"
              placeholder="Enter rejection reason…"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReasonInput("");
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejecting === selectedAudit._id}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 border border-red-400/50 hover:bg-red-500/30 disabled:opacity-50"
              >
                {rejecting === selectedAudit._id ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


