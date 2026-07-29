"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";
import { POAC_EVALUATION_ITEMS } from "@/lib/constants/qhse-poac/poacEvaluationItems";
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
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "not available" || trimmed.toLowerCase() === "n/a") return null;
  return resolveQhseSignatureImageSrc(trimmed);
}

const evaluationCategories = [
  { name: "Prior to commencement of Operations", start: 1, end: 9 },
  { name: "Mobilization", start: 10, end: 15 },
  { name: "Rigging of vessel", start: 16, end: 23 },
  { name: "Approach and mooring operation", start: 24, end: 42 },
  { name: "Hose connection", start: 43, end: 48 },
  { name: "Cargo operations", start: 49, end: 51 },
  { name: "Hose draining and disconnection", start: 52, end: 56 },
  { name: "Unmooring", start: 57, end: 62 },
  { name: "De-Mobilization", start: 63, end: 66 },
  { name: "General", start: 67, end: 71 },
  { name: "Office Requirements", start: 72, end: 75 },
];

export default function PoacCrossCompetencyViewPage() {
  const { setPageLoading } = useQhseLoading();
  const { canEdit, canApprove, canDownload } = useQhseRole();
  const { contentClassName } = useQhseSidebar();
  const params = useParams();
  const router = useRouter();
  const formId = params.id;

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    const fetchForm = async () => {
      if (!formId) return;

      setLoading(true);
      setPageLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/qhse/cross-competency/${formId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load form");
        }

        setForm(data.data);
      } catch (err) {
        setError(err.message || "Failed to load form");
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    };

    fetchForm();
  }, [formId]);

  const handleDownloadDocx = async () => {
    if (!canDownload) return;
    if (!formId || !form) return;
    setDownloadingDocx(true);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/cross-competency/${formId}/download`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let fileName = `POAC-Cross-Competency-${form.serialNumber || formId}.docx`;
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
      setDownloadingDocx(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!canDownload) return;
    if (!formId || !form) return;
    setDownloadingPdf(true);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/cross-competency/${formId}/download/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download PDF");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let fileName = `POAC-Cross-Competency-${form.serialNumber || formId}.pdf`;
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
      setDownloadingPdf(false);
    }
  };

  const handleApprove = async () => {
    if (!canApprove) return;
    if (!formId || !form) return;
    const name = window.prompt(
      "Approver name (shown on PDF / Word header as Approved by):",
      form.approvedBy?.trim() || ""
    );
    if (name == null) return;
    const approvedBy = name.trim();
    if (!approvedBy) {
      setError("Approver name is required.");
      return;
    }
    if (!window.confirm(`Approve this form and set "Approved by" to ${approvedBy}?`)) return;

    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/cross-competency/${formId}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedBy }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve");
      }
      setForm((prev) =>
        prev
          ? {
              ...prev,
              status: "Approved",
              approvedBy,
              rejectionReason: "",
            }
          : prev
      );
    } catch (err) {
      setError(err.message || "Failed to approve");
    } finally {
      setApproving(false);
    }
  };

  const openRejectModal = () => {
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!canApprove) return;
    if (!formId || !form) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      setError("Rejection reason is required.");
      return;
    }

    setRejecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/cross-competency/${formId}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject");
      }
      setShowRejectModal(false);
      setRejectionReason("");
      setForm((prev) =>
        prev
          ? {
              ...prev,
              status: "Rejected",
              rejectionReason: reason,
              approvedBy: "",
            }
          : prev
      );
    } catch (err) {
      setError(err.message || "Failed to reject");
    } finally {
      setRejecting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      Draft: "bg-slate-500/15 text-slate-300 border-slate-400/40",
      Submitted: "bg-blue-500/15 text-blue-300 border-blue-400/40",
      Reviewed: "bg-purple-500/15 text-purple-300 border-purple-400/40",
      Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
      Rejected: "bg-red-500/15 text-red-300 border-red-400/40",
    };

    const className = statusConfig[status] || statusConfig.Draft;

    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border ${className}`}
      >
        {status}
      </span>
    );
  };

  if (loading) return null;

  if (error || !form) {
    return (
      <div className={`${contentClassName} w-full min-w-0 pr-4`}>
        <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-10">
          <div className="rounded-3xl border border-red-500/40 bg-red-950/40 p-6">
            <p className="text-red-300">{error || "Form not found"}</p>
            <Link
              href="/qhse/poac/cross-competency/list"
              className="mt-4 inline-block rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10 transition"
            >
              Back to List
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">View POAC Cross Competency Form</h1>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-009" />
            {canDownload && (
              <button
                type="button"
                onClick={handleDownloadDocx}
                disabled={downloadingDocx || downloadingPdf || approving}
                className="rounded-full border cursor-pointer border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10 transition inline-flex items-center gap-1.5 disabled:opacity-50"
                title="Download as Word"
              >
                {downloadingDocx ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                Download as Word
              </button>
            )}
            {canDownload && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || downloadingDocx || approving}
                className="rounded-full border cursor-pointer border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition inline-flex items-center gap-1.5 disabled:opacity-50"
                title="Download as PDF"
              >
                {downloadingPdf ? (
                  <span className="inline-block w-4 h-4 border-2 border-rose-300/30 border-t-rose-200 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                Download as PDF
              </button>
            )}
            {canEdit && form.status === "Draft" && (
              <Link
                href={`/qhse/poac/cross-competency/form?edit=${form._id}`}
                className="rounded-full border cursor-pointer border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Edit
              </Link>
            )}
          </div>
        </header>

        <div className="space-y-6">
          {/* Form & POAC Details – actual form data in one card */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-orange-300">Form & POAC Details</h2>
                {getStatusBadge(form.status || "Draft")}
              </div>
              <button
                type="button"
                onClick={() => router.push("/qhse/poac/cross-competency/list")}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition shrink-0"
                title="Close"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Form Code</label>
                <p className="text-sm text-white font-mono">{form.formCode || "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Serial No</label>
                <p className="text-sm text-white font-mono">{form.serialNumber || "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Name of POAC</label>
                <p className="text-sm text-white">{form.nameOfPOAC || "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Evaluation Date</label>
                <p className="text-sm text-white">{formatDate(form.evaluationDate)}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Job Ref No</label>
                <p className="text-sm text-white">{form.jobRefNo || "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Lead POAC</label>
                <p className="text-sm text-white">{form.leadPOAC || "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Discharging Vessel</label>
                <p className="text-sm text-white">{form.dischargingVessel || "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Receiving Vessel</label>
                <p className="text-sm text-white">{form.receivingVessel || "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Location</label>
                <p className="text-sm text-white">{form.location || "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Type of Operation</label>
                <p className="text-sm text-white">{form.typeOfOperation || "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Weather Condition</label>
                <p className="text-sm text-white">{form.weatherCondition || "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Deadweight Discharging</label>
                <p className="text-sm text-white">{form.deadweightDischarging ?? "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Deadweight Receiving</label>
                <p className="text-sm text-white">{form.deadweightReceiving ?? "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Rev No</label>
                <p className="text-sm text-white">{form.revNo || "—"}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Rev Date</label>
                <p className="text-sm text-white">{formatDate(form.revDate)}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Approved By</label>
                <p className="text-sm text-white">{form.approvedBy || "—"}</p>
              </div>
            </div>
          </div>

          {/* Evaluation Items */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-orange-300">Evaluation Items</h2>
            <div className="space-y-6">
              {evaluationCategories.map((category) => {
                const categoryItems = (form.evaluationItems || []).filter(
                  (item) => item.srNo >= category.start && item.srNo <= category.end
                );

                if (categoryItems.length === 0) return null;

                return (
                  <div key={category.name} className="border border-white/10 rounded-xl p-4 bg-slate-900/20">
                    <h3 className="text-sm font-bold text-cyan-300 mb-3">{category.name}</h3>
                    <div className="space-y-3">
                      {categoryItems.map((item) => {
                        const hasEvaluation = item.evaluation !== null && item.evaluation !== undefined;
                        const evaluationValue = hasEvaluation ? parseInt(item.evaluation) : null;

                        return (
                          <div key={item.srNo} className="border border-white/5 rounded-lg p-3 bg-slate-900/30">
                            <div className="flex items-start gap-3">
                              <span className="text-xs font-semibold text-slate-300 min-w-[40px]">
                                {item.srNo}.
                              </span>
                              <div className="flex-1 space-y-2">
                                <p className="text-xs text-slate-200">{item.area}</p>
                                <div className="flex gap-4 items-start">
                                  <div>
                                    <label className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                                      Evaluation
                                    </label>
                                    <p className="text-sm text-white font-semibold">
                                      {hasEvaluation ? evaluationValue : "—"}
                                    </p>
                                  </div>
                                  {(item.remarks || (hasEvaluation && evaluationValue < 3)) && (
                                    <div className="flex-1">
                                      <label className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                                        Remarks
                                      </label>
                                      <p className="text-xs text-slate-200">
                                        {item.remarks || "—"}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lead POAC Comments & Signatures */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-orange-300">Lead POAC Comments & Signatures</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">
                  Lead POAC Comment
                </label>
                <p className="text-sm text-white whitespace-pre-wrap">
                  {form.leadPOACComment || "—"}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">
                    Lead POAC Name
                  </label>
                  <p className="text-sm text-white">{form.leadPOACName || "—"}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">
                    Lead POAC Date
                  </label>
                  <p className="text-sm text-white">{formatDate(form.leadPOACDate)}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">
                  Lead POAC Signature
                </label>
                {getSignatureSrc(form.leadPOACSignature) ? (
                  <div className="p-4 rounded-lg border border-white/20 bg-white/5 inline-block">
                    <img
                      src={getSignatureSrc(form.leadPOACSignature)}
                      alt="Lead POAC Signature"
                      className="max-h-24 w-auto max-w-[200px] object-contain block"
                      decoding="async"
                      onError={(e) => {
                        e.target.style.display = "none";
                        const fallback = e.target.nextElementSibling;
                        if (fallback) fallback.classList.remove("hidden");
                      }}
                    />
                    <span className="text-slate-500 text-xs hidden">Signature image could not be displayed.</span>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-white/10 bg-white/5 inline-flex items-center justify-center min-h-[80px] min-w-[160px]">
                    <span className="text-slate-500 text-sm">Signature not available</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Operations Support Team Comment */}
          {form.opsSupportTeamComment && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
              <h2 className="text-lg font-bold mb-4 text-orange-300">Operations Support Team Comment</h2>
              <p className="text-sm text-white whitespace-pre-wrap">
                {form.opsSupportTeamComment}
              </p>
            </div>
          )}

          {/* Ops Team Signatures */}
          {(form.opsTeamName || form.opsTeamSupdtName || form.opsTeamSignature || form.opsTeamSupdtSignature) && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
              <h2 className="text-lg font-bold mb-4 text-orange-300">Operations Team Signatures</h2>
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">
                      Ops Team Name
                    </label>
                    <p className="text-sm text-white">{form.opsTeamName || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">
                      Ops Team Date
                    </label>
                    <p className="text-sm text-white">{formatDate(form.opsTeamDate)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">
                      Ops Team Signature
                    </label>
                    {getSignatureSrc(form.opsTeamSignature) ? (
                      <div className="p-4 rounded-lg border border-white/20 bg-white/5 inline-block">
                        <img
                          src={getSignatureSrc(form.opsTeamSignature)}
                          alt="Ops Team Signature"
                          className="max-h-24 w-auto max-w-[200px] object-contain block"
                          decoding="async"
                          onError={(e) => {
                            e.target.style.display = "none";
                            const fallback = e.target.nextElementSibling;
                            if (fallback) fallback.classList.remove("hidden");
                          }}
                        />
                        <span className="text-slate-500 text-xs hidden">Signature image could not be displayed.</span>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg border border-white/10 bg-white/5 inline-flex items-center justify-center min-h-[80px] min-w-[160px]">
                        <span className="text-slate-500 text-sm">Signature not available</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">
                      Ops Team Superintendent Name
                    </label>
                    <p className="text-sm text-white">{form.opsTeamSupdtName || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">
                      Ops Team Superintendent Date
                    </label>
                    <p className="text-sm text-white">{formatDate(form.opsTeamSupdtDate)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">
                      Ops Team Superintendent Signature
                    </label>
                    {getSignatureSrc(form.opsTeamSupdtSignature) ? (
                      <div className="p-4 rounded-lg border border-white/20 bg-white/5 inline-block">
                        <img
                          src={getSignatureSrc(form.opsTeamSupdtSignature)}
                          alt="Ops Team Superintendent Signature"
                          className="max-h-24 w-auto max-w-[200px] object-contain block"
                          decoding="async"
                          onError={(e) => {
                            e.target.style.display = "none";
                            const fallback = e.target.nextElementSibling;
                            if (fallback) fallback.classList.remove("hidden");
                          }}
                        />
                        <span className="text-slate-500 text-xs hidden">Signature image could not be displayed.</span>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg border border-white/10 bg-white/5 inline-flex items-center justify-center min-h-[80px] min-w-[160px]">
                        <span className="text-slate-500 text-sm">Signature not available</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <div className="grid gap-4 md:grid-cols-2 text-xs text-slate-400">
              <div>
                <span className="font-semibold">Created:</span> {formatDate(form.createdAt)}
              </div>
              {form.updatedAt && (
                <div>
                  <span className="font-semibold">Last Updated:</span> {formatDate(form.updatedAt)}
                </div>
              )}
            </div>
            {form.status === "Rejected" && form.rejectionReason && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-red-300/90 mb-1">
                  Rejection reason
                </p>
                <p className="text-sm text-red-200/90 whitespace-pre-wrap">{form.rejectionReason}</p>
              </div>
            )}
          </div>

          {/* Approve / Reject — same pattern as other QHSE list detail cards (e.g. equipment base stock) */}
          {canApprove && form.status !== "Approved" && form.status !== "Rejected" && (
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-4 sm:px-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={openRejectModal}
                disabled={rejecting || approving}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-red-400/50 bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-50 transition"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || rejecting}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-emerald-400/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition inline-flex items-center gap-2"
              >
                {approving ? (
                  <span className="inline-block w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-100 rounded-full animate-spin" />
                ) : null}
                {approving ? "Approving…" : "Approve"}
              </button>
            </div>
          )}
        </div>

        {/* Reject modal */}
        {showRejectModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-labelledby="poac-reject-modal-title"
          >
            <div className="bg-slate-800 border border-white/15 rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 id="poac-reject-modal-title" className="text-lg font-semibold text-white mb-4">
                Reject form
              </h2>
              <p className="text-slate-300 text-sm mb-3">
                Form: {form.formCode || "QAF-OFD-009"} • {form.serialNumber || "—"}
              </p>
              <label htmlFor="poac-reject-reason" className="block text-sm text-slate-400 mb-1">
                Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                id="poac-reject-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 text-white px-3 py-2 text-sm min-h-[100px] resize-y"
                placeholder="Enter rejection reason…"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason("");
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectSubmit}
                  disabled={rejecting}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 border border-red-400/50 hover:bg-red-500/30 disabled:opacity-50"
                >
                  {rejecting ? "Rejecting…" : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

