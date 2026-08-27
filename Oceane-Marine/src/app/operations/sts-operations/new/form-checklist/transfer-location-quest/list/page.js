"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOperationsLoading } from "@/app/operations/OperationsLoadingContext";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import { useQhseRole } from "@/hooks/useQhseRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import { QhseListPageContainer } from "@/app/qhse/components/QhseListPageContainer";
import { ActionViewIconLink, ActionDeleteIcon } from "@/app/components/RecordActionIcons";

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

function getStatusBadge(status) {
  const statusConfig = {
    "Pending Approval": "bg-amber-500/15 text-amber-300 border-amber-400/40",
    Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
    Rejected: "bg-red-500/15 text-red-300 border-red-400/40",
  };
  const tone = statusConfig[status] || "bg-slate-500/15 text-slate-300 border-slate-400/40";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] border ${tone}`}
    >
      {status}
    </span>
  );
}

export default function TransferLocationQuestListPage() {
  const pathname = usePathname();
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const { setPageLoading } = useOperationsLoading();
  const { isOpsAdmin } = useOperationsRole();
  /* Approve/reject and the "Send to Client" action are QHSE-compliance permissions —
     the underlying API routes still enforce them via assertQhsePermission, so the UI
     gate has to match, regardless of which sidebar the page is opened from. */
  const { canCreate, canDelete } = useQhseRole();
  const sidebarTabs = getSidebarTabs(isOpsAdmin);
  const [activeTab] = useState("forms");
  const [expandedModules, setExpandedModules] = useState(new Set(["forms"]));

  const [draftOperations, setDraftOperations] = useState([]);
  const [loadingDraftOps, setLoadingDraftOps] = useState(true);
  const [selectedRef, setSelectedRef] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState(null);
  const [sendError, setSendError] = useState(null);

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const loadDraftOperations = useCallback(async () => {
    setLoadingDraftOps(true);
    try {
      const res = await fetch("/api/qhse/form-checklist/transfer-location-quest/draft-operations");
      const data = await res.json();
      if (res.ok && data.success) {
        setDraftOperations(data.data || []);
      }
    } finally {
      setLoadingDraftOps(false);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setPageLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const url = params.toString()
        ? `/api/qhse/form-checklist/transfer-location-quest/submissions?${params}`
        : "/api/qhse/form-checklist/transfer-location-quest/submissions";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load submissions");
      }
      setSubmissions(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, [statusFilter, setPageLoading]);

  useEffect(() => {
    loadDraftOperations();
  }, [loadDraftOperations]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleSendEmail = async () => {
    if (!selectedRef) return;
    setSending(true);
    setSendMessage(null);
    setSendError(null);
    try {
      const res = await fetch("/api/qhse/form-checklist/transfer-location-quest/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationRef: selectedRef }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send email");
      }
      setSendMessage(data.message || "Email sent.");
      await loadDraftOperations();
    } catch (err) {
      setSendError(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (form) => {
    if (!canDelete) return;
    if (!confirm("Are you sure you want to delete this submission? This cannot be undone.")) return;
    setDeletingId(form._id);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/transfer-location-quest/submissions/${form._id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete submission");
      }
      setSubmissions((prev) => prev.filter((s) => s._id !== form._id));
    } catch (err) {
      setError(err.message || "Failed to delete submission");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (s.operationRef || "").toLowerCase().includes(term) ||
      (s.location?.locationName || "").toLowerCase().includes(term) ||
      (s.serialNumber || "").toLowerCase().includes(term)
    );
  });

  const selectedDraftOp = draftOperations.find((op) => op.operationRef === selectedRef);

  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {/* Left Sidebar */}
      <div
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
                Operations / Forms & Checklist / Transfer Location Questionnaire
              </p>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                Transfer Location Questionnaire
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 mt-1">
                Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-049</span>
              </p>
            </div>
          </header>

          {canCreate && (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-4">
              <h2 className="text-base font-semibold text-white border-b border-white/10 pb-3">
                Send to Client
              </h2>
              <p className="text-xs text-slate-400">
                Pick a Draft operation and email the client the Transfer Location Questionnaire link.
                Once the client submits and an approver approves it, the operation moves to Lined Up,
                then automatically to In Progress once its start date/time arrives.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <select
                  className="flex-1 rounded-xl bg-slate-900/40 border border-white/15 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  value={selectedRef}
                  onChange={(e) => {
                    setSelectedRef(e.target.value);
                    setSendMessage(null);
                    setSendError(null);
                  }}
                  disabled={loadingDraftOps}
                >
                  <option value="">
                    {loadingDraftOps ? "Loading draft operations…" : "Select a Draft operation…"}
                  </option>
                  {draftOperations.map((op) => (
                    <option key={op.operationRef} value={op.operationRef}>
                      {op.operationRef}
                      {op.client ? ` — ${op.client}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={!selectedRef || sending}
                  className="shrink-0 rounded-xl bg-sky-500 hover:bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? "Sending…" : "Send Email"}
                </button>
              </div>
              {!loadingDraftOps && draftOperations.length === 0 && (
                <p className="text-xs text-slate-500">No Draft operations found.</p>
              )}
              {selectedDraftOp?.transferLocationQuestSentAt && (
                <p className="text-xs text-slate-400">
                  Already sent to {selectedDraftOp.transferLocationQuestSentTo} on{" "}
                  {formatDateTime(selectedDraftOp.transferLocationQuestSentAt)}
                  {selectedDraftOp.questionnaireStatus ? ` — ${selectedDraftOp.questionnaireStatus}` : ""}.
                </p>
              )}
              {sendMessage && (
                <div className="text-sm text-emerald-200 bg-emerald-950/40 border border-emerald-500/40 rounded-lg px-4 py-3">
                  {sendMessage}
                </div>
              )}
              {sendError && (
                <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                  {sendError}
                </div>
              )}
            </section>
          )}

          <QhseListPageContainer
            searchPlaceholder="Search by Operation Ref, Location, Serial..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterChildren={
              <select
                className="rounded-xl bg-slate-900/40 border border-white/15 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            }
          >
            {error && (
              <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            {loading ? (
              <div className="text-center py-12 rounded-2xl border border-white/10 bg-white/5">
                <p className="text-white/60">Loading…</p>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-12 rounded-2xl border border-white/10 bg-white/5">
                <p className="text-white/60">No submissions yet.</p>
              </div>
            ) : (
              <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-left text-slate-200 border-b border-white/10">
                      <th className="py-3 pr-4 font-semibold">Operation Ref</th>
                      <th className="py-3 pr-4 font-semibold">Location</th>
                      <th className="hidden py-3 pr-4 font-semibold md:table-cell">Submitted By</th>
                      <th className="py-3 pr-4 font-semibold">Submitted</th>
                      <th className="py-3 pr-4 font-semibold">Status</th>
                      <th className="py-3 pr-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((form) => (
                      <tr key={form._id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-3 pr-4">
                          <span className="font-mono text-sky-300">{form.operationRef}</span>
                        </td>
                        <td className="py-3 pr-4 text-slate-200">
                          {form.location?.locationName || "—"}
                        </td>
                        <td className="hidden py-3 pr-4 md:table-cell text-slate-200">
                          {form.submittedByName || "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">{formatDateTime(form.createdAt)}</td>
                        <td className="py-3 pr-4">{getStatusBadge(form.status)}</td>
                        <td className="py-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <ActionViewIconLink
                              href={`/operations/sts-operations/new/form-checklist/transfer-location-quest/${form._id}`}
                            />
                            {canDelete && (
                              <ActionDeleteIcon
                                onClick={() => handleDelete(form)}
                                disabled={deletingId === form._id}
                                loading={deletingId === form._id}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QhseListPageContainer>
        </div>
      </div>
    </div>
  );
}
