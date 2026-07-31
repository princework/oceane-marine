"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../QhseSidebarContext";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StageBadge({ label, stage }) {
  const status = stage?.status;
  const config = {
    Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
    APPROVED: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
    Pending: "bg-amber-500/15 text-amber-300 border-amber-400/40",
    UNDER_REVIEW: "bg-amber-500/15 text-amber-300 border-amber-400/40",
    DRAFT: "bg-slate-500/15 text-slate-300 border-slate-400/40",
    Rejected: "bg-red-500/15 text-red-300 border-red-400/40",
    REJECTED: "bg-red-500/15 text-red-300 border-red-400/40",
  };
  const tone = config[status] || "bg-slate-500/15 text-slate-400 border-slate-500/30";
  const displayLabel = status || "Not started";
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] border ${tone}`}>
        {displayLabel}
      </span>
    </div>
  );
}

export default function VendorOnboardingDashboardPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canCreate, isQhseAdmin } = useQhseRole();

  const [vendors, setVendors] = useState([]);
  const [auditors, setAuditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [selectedAuditorByVendor, setSelectedAuditorByVendor] = useState({});

  const [sendingId, setSendingId] = useState(null);

  const loadAuditors = useCallback(async () => {
    try {
      const res = await fetch("/api/master/auditors/list");
      const data = await res.json();
      if (res.ok) setAuditors(data.auditors || []);
    } catch {
      // non-fatal — auditor picker just stays empty
    }
  }, []);

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    setPageLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/qhse/due-diligence/vendor-pipeline");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load vendors");
      }
      setVendors(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, [setPageLoading]);

  useEffect(() => {
    loadPipeline();
    loadAuditors();
  }, [loadPipeline, loadAuditors]);

  const sendStage1 = async (vendorId) => {
    setSendingId(`s1-${vendorId}`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/qhse/due-diligence/due-diligence-questionnaire/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to send email");
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingId(null);
    }
  };

  const sendStage2 = async (vendorId) => {
    const auditorId = selectedAuditorByVendor[vendorId];
    if (!auditorId) {
      setError("Select an auditor before sending the audit link.");
      return;
    }
    setSendingId(`s2-${vendorId}`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/qhse/due-diligence/audit-sub-contractor/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, auditorId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to send email");
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingId(null);
    }
  };

  if (loading) return null;

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
              QHSE / Due Diligence / Vendor Onboarding
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Vendor Onboarding</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Due Diligence → Sub-Contractor Audit → Vendor Approval
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <Link
              href="/qhse/due-diligence-subconstructor/due-diligence-questionnaire/questionnaire-list-admin"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs sm:text-sm font-semibold text-white/80 hover:bg-white/10 transition"
            >
              Due Diligence List
            </Link>
            <Link
              href="/qhse/due-diligence-subconstructor/audit-sub-contractor/list-admin"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs sm:text-sm font-semibold text-white/80 hover:bg-white/10 transition"
            >
              Audit List
            </Link>
            <Link
              href="/qhse/forms-checklist/vendor-supply/list"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs sm:text-sm font-semibold text-white/80 hover:bg-white/10 transition"
            >
              Vendor Approval List
            </Link>
          </div>
        </header>

        {isQhseAdmin && (
          <div className="flex flex-col gap-3 rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-200">
              Manage vendor and auditor master records in the Master Database module.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/qhse/master/vendor-register"
                className="rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs sm:text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
              >
                Vendor Register
              </Link>
              <Link
                href="/qhse/master/auditor-register"
                className="rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs sm:text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
              >
                Auditor Register
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">{error}</div>
        )}
        {message && (
          <div className="text-sm text-emerald-200 bg-emerald-950/40 border border-emerald-500/40 rounded-lg px-4 py-3">{message}</div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-white border-b border-white/10 pb-3">Vendors</h2>
          {vendors.length === 0 ? (
            <p className="text-sm text-slate-400">
              No vendors yet.
              {isQhseAdmin && (
                <>
                  {" "}
                  Add one in the{" "}
                  <Link href="/qhse/master/vendor-register" className="text-sky-300 hover:underline">
                    Vendor Register
                  </Link>
                  .
                </>
              )}
            </p>
          ) : (
            <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left text-slate-200 border-b border-white/10">
                    <th className="py-3 pr-4 font-semibold">Vendor</th>
                    <th className="py-3 pr-4 font-semibold">1. Due Diligence</th>
                    <th className="py-3 pr-4 font-semibold">2. Audit</th>
                    <th className="py-3 pr-4 font-semibold">3. Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => {
                    const stage1Approved = v.stage1?.status === "Approved";
                    const stage2Approved = v.stage2?.status === "Approved";
                    const stage1Actionable = !v.stage1 || v.stage1.status === "Rejected";
                    const stage2Actionable = stage1Approved && (!v.stage2 || v.stage2.status === "Rejected");
                    const stage3Actionable = stage2Approved && !v.stage3;

                    return (
                      <tr key={v.vendorId} className="border-b border-white/5 hover:bg-white/5 transition align-top">
                        <td className="py-3 pr-4">
                          <p className="text-white font-medium">{v.name}</p>
                          <p className="text-xs text-slate-400">{v.email}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <StageBadge label="Status" stage={v.stage1} />
                          {canCreate && stage1Actionable && (
                            <button
                              type="button"
                              onClick={() => sendStage1(v.vendorId)}
                              disabled={sendingId === `s1-${v.vendorId}`}
                              className="mt-2 rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 transition"
                            >
                              {sendingId === `s1-${v.vendorId}` ? "Sending…" : v.stage1 ? "Resend link" : "Send link"}
                            </button>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <StageBadge label="Status" stage={v.stage2} />
                          {v.auditSentAt && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              Sent to: <span className="text-sky-300">{v.auditSentAuditorName || v.auditSentTo}</span>
                              {" "}on {formatDateTime(v.auditSentAt)}
                            </p>
                          )}
                          {canCreate && stage1Approved && stage2Actionable && (
                            <div className="mt-2 flex flex-col gap-1.5">
                              <select
                                value={selectedAuditorByVendor[v.vendorId] || ""}
                                onChange={(e) =>
                                  setSelectedAuditorByVendor((prev) => ({
                                    ...prev,
                                    [v.vendorId]: e.target.value,
                                  }))
                                }
                                className="rounded-lg border border-white/10 bg-slate-900/40 px-2 py-1 text-[11px] text-white outline-none focus:ring-2 focus:ring-sky-500/50"
                              >
                                <option value="">Select auditor…</option>
                                {auditors.map((a) => (
                                  <option key={a._id} value={a._id}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => sendStage2(v.vendorId)}
                                disabled={sendingId === `s2-${v.vendorId}` || !selectedAuditorByVendor[v.vendorId]}
                                className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 transition"
                              >
                                {sendingId === `s2-${v.vendorId}` ? "Sending…" : v.stage2 ? "Resend link" : "Send link"}
                              </button>
                            </div>
                          )}
                          {!stage1Approved && (
                            <p className="mt-2 text-[11px] text-slate-500">Awaiting Due Diligence approval</p>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <StageBadge label="Status" stage={v.stage3} />
                          {v.stage3?.overallPercentageScore != null && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              Score: {v.stage3.overallPercentageScore}%
                              {v.stage3.approvedVendorEligible ? " • Eligible" : ""}
                            </p>
                          )}
                          {canCreate && stage3Actionable && (
                            <Link
                              href={`/qhse/forms-checklist/vendor-supply/form?vendorId=${v.vendorId}`}
                              className="mt-2 inline-block rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20 transition"
                            >
                              Create rating
                            </Link>
                          )}
                          {!stage2Approved && (
                            <p className="mt-2 text-[11px] text-slate-500">Awaiting Audit approval</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
