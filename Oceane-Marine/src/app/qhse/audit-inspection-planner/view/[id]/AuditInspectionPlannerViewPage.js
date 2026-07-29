"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";

export default function AuditInspectionPlannerViewPage() {
  const { setPageLoading } = useQhseLoading();
  const { canApprove } = useQhseRole();
  const { contentClassName } = useQhseSidebar();
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const fetchOne = async () => {
      setLoading(true);
      setPageLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/qhse/audit-inspection-planner/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load planner");
        if (!data.data) throw new Error("Planner not found");
        setItem(data.data);
      } catch (err) {
        setError(err.message || "Failed to load planner");
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    };
    if (id) fetchOne();
  }, [id]);

  const handleApprove = async () => {
    if (!canApprove) return;
    if (!item || item.status === "Approved") return;
    if (!confirm("Approve this planner? This will set the status to Approved.")) return;
    setApproving(true);
    setError("");
    try {
      const res = await fetch("/api/qhse/audit-inspection-planner/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item._id, status: "Approved" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      setItem((prev) => (prev ? { ...prev, status: "Approved" } : null));
    } catch (err) {
      setError(err.message || "Failed to approve");
    } finally {
      setApproving(false);
    }
  };

  if (loading) return null;

  if (error || !item) {
    return (
      <div className={`${contentClassName} w-full min-w-0 pr-4`}>
        <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-10 space-y-3 sm:space-y-4">
          <Link
            href="/qhse/audit-inspection-planner/form"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm hover:bg-white/10 transition"
          >
            ← Open planner form
          </Link>
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
            {error || "Planner not found"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-sky-300">
              QHSE / Audit & Inspection Planner / View
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Planner Details</h1>
            <p className="text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">{item.formCode || "QAF-OFD-048"}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-048" />
            <button
              type="button"
              onClick={() => router.push("/qhse/audit-inspection-planner/form")}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition"
              title="Close"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm text-slate-100">
            <div>
              <div className="text-slate-400 text-xs uppercase">Form Code</div>
              <div className="font-semibold font-mono text-sky-300">{item.formCode || "—"}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs uppercase">Serial</div>
              <div className="font-semibold font-mono text-slate-200">{item.serialNumber || "—"}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs uppercase">Issue Date</div>
              <div className="font-semibold">
                {item.issueDate ? new Date(item.issueDate).toLocaleDateString("en-GB") : "—"}
              </div>
            </div>
            {item.status === "Approved" && (
              <div>
                <div className="text-slate-400 text-xs uppercase">Approved By</div>
                <div className="font-semibold">{item.approvedBy || "—"}</div>
              </div>
            )}
          </div>
        </section>

        {(item.categories || []).map((cat) => (
          <section
            key={cat.key}
            className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
          >
            <div className="bg-white/10 px-6 py-3 font-semibold text-white">
              {cat.title}
            </div>
            <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-200 border-b border-white/10 bg-white/5">
                    <th className="px-4 py-3 font-semibold">Audit / Inspection Description</th>
                    <th className="px-4 py-3 font-semibold">Frequency</th>
                    <th className="px-4 py-3 font-semibold">Due by</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Auditor Name</th>
                    <th className="px-4 py-3 font-semibold">Audit Date</th>
                    <th className="px-4 py-3 font-semibold">Remarks</th>
                    <th className="px-4 py-3 font-semibold">File</th>
                  </tr>
                </thead>
                <tbody>
                  {(cat.rows || []).map((row, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      <td className="px-4 py-2">{row.description || "—"}</td>
                      <td className="px-4 py-2">{row.frequency || "—"}</td>
                      <td className="px-4 py-2">{row.dueBy || "—"}</td>
                      <td className="px-4 py-2">{row.status || "—"}</td>
                      <td className="px-4 py-2">{row.auditorName || "—"}</td>
                      <td className="px-4 py-2">
                        {row.auditDate
                          ? new Date(row.auditDate).toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                      <td className="px-4 py-2">{row.remarks || "—"}</td>
                      <td className="px-4 py-2 min-w-[180px]">
                        {row.fileUrl && row.fileName && row.rowId ? (
                          <a
                            href={`/api/qhse/audit-inspection-planner/${item._id}/row-attachment?rowId=${encodeURIComponent(row.rowId)}`}
                            download={row.fileName}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-400/40 text-blue-200 bg-blue-500/15 hover:bg-blue-500/25 transition"
                          >
                            <span>📎</span>
                            <span className="truncate max-w-[150px]">{row.fileName}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <footer className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-end gap-3">
          {canApprove && item.status !== "Approved" && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold uppercase tracking-wider transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {approving ? "Approving…" : "Approve"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

