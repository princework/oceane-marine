"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

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
  const statusConfig = {
    Draft: "bg-slate-500/15 text-slate-300 border-slate-400/40",
    "Pending Approval": "bg-amber-500/15 text-amber-300 border-amber-400/40",
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
}

export default function DrillPlanReviewPage() {
  const { setPageLoading } = useQhseLoading();
  const { canApprove } = useQhseRole();
  const { contentClassName } = useQhseSidebar();
  const params = useParams();
  const planId = params.id;

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    const fetchPlan = async () => {
      if (!planId) return;
      setLoading(true);
      setPageLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/qhse/drill/plan/${planId}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load drill plan");
        }
        setPlan(data.data);
      } catch (err) {
        setError(err.message || "Failed to load drill plan");
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    };
    fetchPlan();
  }, [planId]);

  const handleApprove = async () => {
    if (!canApprove || !plan) return;
    if (!window.confirm(`Approve the Drill Plan for ${plan.year}?`)) return;

    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/drill/plan/${planId}/approve`, {
        method: "PUT",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve");
      }
      setPlan(data.data);
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
    if (!canApprove || !plan) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      setError("Rejection reason is required.");
      return;
    }

    setRejecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/drill/plan/${planId}/reject`, {
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
      setPlan(data.data);
    } catch (err) {
      setError(err.message || "Failed to reject");
    } finally {
      setRejecting(false);
    }
  };

  if (loading) return null;

  if (error && !plan) {
    return (
      <div className={`${contentClassName} w-full min-w-0 pr-4`}>
        <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-10">
          <div className="rounded-3xl border border-red-500/40 bg-red-950/40 p-6">
            <p className="text-red-300">{error || "Drill plan not found"}</p>
            <Link
              href="/qhse/drills/create/plan"
              className="mt-4 inline-block rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10 transition"
            >
              Back to Drill Matrix
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const quarterFiles = plan.quarterFiles || {};

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
              QHSE / Drills
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              Review Drill Plan — {plan.year}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">{plan.formCode || "QAF-OFD-040"}</span>
              {plan.serialNumber ? ` • ${plan.serialNumber}` : ""}
            </p>
          </div>
          <div className="flex-shrink-0">{getStatusBadge(plan.status)}</div>
        </header>

        {error && (
          <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-slate-200 border-b border-white/10">
                <th className="py-2 pr-4 font-semibold">Quarter</th>
                <th className="py-2 pr-4 font-semibold">Planned Date</th>
                <th className="py-2 pr-4 font-semibold">Topic</th>
                <th className="py-2 pr-4 font-semibold">Instructor</th>
                <th className="py-2 pr-4 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {(plan.planItems || []).map((item, idx) => (
                <tr key={idx} className="border-b border-white/5">
                  <td className="py-2 pr-4 text-slate-200">{item.quarter || "—"}</td>
                  <td className="py-2 pr-4 text-slate-200">{formatDate(item.plannedDate)}</td>
                  <td className="py-2 pr-4 text-slate-200">{item.topic || "—"}</td>
                  <td className="py-2 pr-4 text-slate-200">{item.instructor || "—"}</td>
                  <td className="py-2 pr-4 text-slate-300">{item.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {QUARTERS.some((q) => quarterFiles[q]) && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <h2 className="text-sm font-semibold text-white mb-3">Attachments</h2>
            <ul className="space-y-2 text-sm">
              {QUARTERS.filter((q) => quarterFiles[q]).map((q) => (
                <li key={q}>
                  <span className="text-slate-400">{q}: </span>
                  <a
                    href={`/api/qhse/drill/download/quarter-file?planId=${plan._id}&quarter=${q}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-300 hover:underline"
                  >
                    {quarterFiles[q].fileName || "Download"}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
          <div className="grid gap-4 md:grid-cols-2 text-xs text-slate-400">
            <div>
              <span className="font-semibold">Submitted:</span> {formatDate(plan.createdAt)}
            </div>
            {plan.updatedAt && (
              <div>
                <span className="font-semibold">Last Updated:</span> {formatDate(plan.updatedAt)}
              </div>
            )}
          </div>
          {plan.status === "Rejected" && plan.rejectionReason && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-red-300/90 mb-1">
                Rejection reason
              </p>
              <p className="text-sm text-red-200/90 whitespace-pre-wrap">{plan.rejectionReason}</p>
            </div>
          )}
        </div>

        {canApprove && plan.status === "Pending Approval" && (
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

      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drill-plan-reject-modal-title"
        >
          <div className="bg-slate-800 border border-white/15 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="drill-plan-reject-modal-title" className="text-lg font-semibold text-white mb-4">
              Reject Drill Plan
            </h2>
            <p className="text-slate-300 text-sm mb-3">
              Year: {plan.year} • {plan.serialNumber || "—"}
            </p>
            <label htmlFor="drill-plan-reject-reason" className="block text-sm text-slate-400 mb-1">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              id="drill-plan-reject-reason"
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
  );
}
