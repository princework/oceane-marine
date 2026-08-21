"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import {
  resolveLinkedFormFilePath,
  HARDCOPY_DOC_PREFIX,
} from "@/lib/utils/sts-linked-form-file";
import { downloadFileFromUrl } from "@/lib/utils/sts-file-download";

/** Map every OPS-OFD code to a human-readable form name */
const FORM_NAME_MAP = {
  "OPS-OFD-001":  "Checklist 1",
  "OPS-OFD-001-A":"Ship Standard Questionnaire",
  "OPS-OFD-002":  "Checklist 2",
  "OPS-OFD-003":  "Checklist 3A & B",
  "OPS-OFD-004":  "Checklist 4A-F",
  "OPS-OFD-005":  "Checklist 5A-C",
  "OPS-OFD-005B": "Checklist 6A & B",
  "OPS-OFD-005C": "Checklist 7",
  "OPS-OFD-005E": "Declaration at Sea",
  "OPS-OFD-005D": "Declaration for STS operations (At port & Terminal)",
  "OPS-OFD-028":  "Personnel Transfer Basket Checklist",
  "OPS-OFD-009":  "Mooring Master Job Report",
  "OPS-OFD-011":  "Standing Order",
  "OPS-OFD-014":      "STS Equipment Checklist",
  "OPS-OFD-014-B":    "Equip Checklist (Before Op.)",
  "OPS-OFD-014-A":    "Equip Checklist (After Op.)",
  "OPS-OFD-015":      "Hourly Checks",
  "OPS-OFD-018":      "STS Timesheet",
  "OPS-OFD-020":      "Master's Feedback",
  "OPS-OFD-020-CHS":  "Master's Feedback (CHS)",
  "OPS-OFD-020-MS":   "Master's Feedback (MS)",
  "OPS-OFD-023":      "Rest Hours CKL",
  "OPS-OFD-029":      "Mooring Master Expense Sheet",
};

const statusTone = {
  DRAFT: {
    dot: "bg-slate-500",
    pill: "bg-slate-500/80 border-slate-400/40 text-slate-100",
  },
  INPROGRESS: {
    dot: "bg-sky-600",
    pill: "bg-sky-500/80 border-sky-400/40 text-sky-100",
  },
  COMPLETED: {
    dot: "bg-emerald-600",
    pill: "bg-emerald-500/80 border-emerald-400/40 text-emerald-100",
  },
  "Lined Up": {
    dot: "bg-amber-600",
    pill: "bg-amber-500/80 border-amber-400/40 text-amber-100",
  },
  CANCELED: {
    dot: "bg-red-600",
    pill: "bg-red-500/80 border-red-400/40 text-red-100",
  },
};

function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function manualDocKey(doc) {
  if (!doc) return "";
  return `${doc.filePath}|${doc.documentType}|${doc.uploadedAt || ""}`;
}

/** MANUAL_UPLOAD rows that belong on a linked-form card (by documentType). */
function findManualUploadDocForLinkedForm(documents, formCode) {
  if (!documents?.length || !formCode) return null;
  const aliases = new Set([formCode]);
  if (formCode === "OPS-OFD-001-A") aliases.add("OPS-OFD-001A");
  const norm = (s) => String(s || "").replace(/-/g, "").toUpperCase();
  const targetNorm = norm(formCode);
  const manual = documents.filter((d) => d?.source === "MANUAL_UPLOAD" && d?.filePath);
  return (
    manual.find((d) => aliases.has(d.documentType)) ||
    manual.find((d) => norm(d.documentType) === targetNorm) ||
    null
  );
}

function getLatestHardcopyDocForForm(documents, formCode) {
  if (!documents?.length || !formCode) return null;
  const keys = new Set([`${HARDCOPY_DOC_PREFIX}${formCode}`]);
  if (formCode === "OPS-OFD-014-B" || formCode === "OPS-OFD-014-A") {
    keys.add(`${HARDCOPY_DOC_PREFIX}OPS-OFD-014`);
  }
  const list = documents.filter(
    (d) =>
      d?.source === "CHECKLIST_HARDCOPY" &&
      d?.filePath &&
      keys.has(d.documentType)
  );
  if (!list.length) return null;
  return [...list].sort(
    (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
  )[0];
}

function LinkedFormStatusCard({ form: f, documents }) {
  const latest = f.docs?.[0];
  const hasDigitalRow = Boolean(f.filled && latest);
  const digitalPath = hasDigitalRow
    ? resolveLinkedFormFilePath(documents, f.formCode, latest._id)
    : null;

  const hardcopyDoc = getLatestHardcopyDocForForm(documents, f.formCode);
  const manualDoc = findManualUploadDocForLinkedForm(documents, f.formCode);
  const manualAttachments = [hardcopyDoc, manualDoc].filter(Boolean);
  const primaryManualDoc =
    manualAttachments.length === 0
      ? null
      : [...manualAttachments].sort(
          (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
        )[0];
  const primaryManualPath = primaryManualDoc?.filePath || null;

  const manualOnly = !hasDigitalRow && Boolean(primaryManualPath);
  const pillText = f.filled ? `Filled (${f.count})` : manualOnly ? "Manual" : "Pending";
  const pillClass = f.filled
    ? "bg-emerald-500/20 text-emerald-300"
    : manualOnly
      ? "bg-amber-500/20 text-amber-200"
      : "bg-slate-500/20 text-slate-400";

  const borderClass = f.filled
    ? "border-emerald-500/30 bg-emerald-900/10"
    : manualOnly
      ? "border-amber-500/35 bg-amber-900/10"
      : "border-white/10 bg-white/5";

  const downloadIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );

  const extraManualPaths = [];
  if (hasDigitalRow && hardcopyDoc?.filePath && hardcopyDoc.filePath !== digitalPath) {
    extraManualPaths.push({ path: hardcopyDoc.filePath, label: "Manual hardcopy" });
  }
  if (hasDigitalRow && manualDoc?.filePath && manualDoc.filePath !== digitalPath) {
    const already = extraManualPaths.some((e) => e.path === manualDoc.filePath);
    if (!already) extraManualPaths.push({ path: manualDoc.filePath, label: "Manual file" });
  }

  return (
    <div className={`rounded-xl border p-4 transition-all ${borderClass}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <p className="text-xs font-bold text-orange-300 truncate">{f.formCode}</p>
          <p className="text-sm font-semibold text-white truncate">{f.label}</p>
        </div>
        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${pillClass}`}>
          {pillText}
        </span>
      </div>

      {hasDigitalRow && (
        <div className="mt-2 space-y-0.5 text-[11px] text-white/60">
          <p>
            Seq: <span className="text-sky-300 font-mono">{latest.sequenceNumber || "—"}</span>
          </p>
          <p>
            Status:{" "}
            <span
              className={
                latest.status === "SUBMITTED" || latest.status === "APPROVED"
                  ? "text-emerald-300"
                  : "text-amber-300"
              }
            >
              {latest.status}
            </span>
          </p>
          <p>
            Date:{" "}
            {latest.createdAt
              ? new Date(latest.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "-"}
          </p>
          <p className="mt-1">
            File:{" "}
            <span className={digitalPath ? "text-emerald-400 font-medium" : "text-white/50"}>
              {digitalPath ? "Yes" : "No"}
            </span>
          </p>
          {digitalPath && (
            <button
              type="button"
              onClick={() => downloadFileFromUrl(digitalPath, `${f.formCode || "form"}-${(digitalPath.split("/").pop() || "file")}`)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-orange-400/40 bg-orange-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-orange-200 hover:bg-orange-500/25 transition"
              title="Download file"
            >
              {downloadIcon}
              Download
            </button>
          )}
          {extraManualPaths.map((ex) => (
            <div key={ex.path} className="mt-2 border-t border-white/10 pt-2">
              <p className="text-[10px] font-semibold text-amber-200/90 uppercase tracking-wide">{ex.label}</p>
              <button
                type="button"
                onClick={() => downloadFileFromUrl(ex.path, `${ex.label || "document"}-${(ex.path.split("/").pop() || "file")}`)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/20 transition"
                title="Download file"
              >
                {downloadIcon}
                Download
              </button>
            </div>
          ))}
        </div>
      )}

      {manualOnly && primaryManualPath && (
        <div className="mt-2 space-y-0.5 text-[11px] text-white/60">
          <p>
            Status: <span className="text-amber-300 font-semibold">manual</span>
          </p>
          {primaryManualDoc?.uploadedAt && (
            <p>Date: {formatDateOnly(primaryManualDoc.uploadedAt)}</p>
          )}
          <p className="mt-1">
            File: <span className="text-emerald-400 font-medium">Yes</span>
          </p>
          <button
            type="button"
            onClick={() => downloadFileFromUrl(primaryManualPath, `${f.formCode || "form"}-${(primaryManualPath.split("/").pop() || "file")}`)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-orange-400/40 bg-orange-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-orange-200 hover:bg-orange-500/25 transition"
            title="Download file"
          >
            {downloadIcon}
            Download
          </button>
        </div>
      )}
    </div>
  );
}

function ViewOperationPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const { id } = params;

  const { canEditForm, isOpsAdmin } = useOperationsRole();
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const sidebarTabs = useMemo(() => getSidebarTabs(isOpsAdmin), [isOpsAdmin]);
  const [activeTab, setActiveTab] = useState("documentation");
  const [expandedModules, setExpandedModules] = useState(new Set());
  const sidebarRef = useRef(null);
  
  const [operationData, setOperationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linkedForms, setLinkedForms] = useState([]);
  const [linkedFormsLoading, setLinkedFormsLoading] = useState(false);

  useEffect(() => {
    if (pathname === "/operations/sts-operations/new") {
      setActiveTab("documentation");
    } else if (pathname.startsWith("/operations/sts-operations/new/compatibility")) {
      setActiveTab("compatibility");
    } else if (pathname.startsWith("/operations/sts-operations/new/form-checklist")) {
      setActiveTab("forms");
      setExpandedModules((prev) => new Set([...prev, "forms"]));
    }
  }, [pathname]);

  const fetchLinkedForms = async (opRef) => {
    if (!opRef) return;
    try {
      setLinkedFormsLoading(true);
      const res = await fetch(`/api/operations/sts/linked-forms?operationRef=${encodeURIComponent(opRef)}`);
      const json = await res.json();
      if (json.success) setLinkedForms(json.data || []);
    } catch (err) {
      console.error("Failed to fetch linked forms:", err);
    } finally {
      setLinkedFormsLoading(false);
    }
  };

  useEffect(() => {
    const fetchOperation = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/operations/sts/${id}`);
        const data = await response.json();

        if (data.success && data.data) {
          setOperationData(data.data);
          // Fetch linked forms once we have the operation ref
          if (data.data.Operation_Ref_No) {
            fetchLinkedForms(data.data.Operation_Ref_No);
          }
        } else {
          setError("Operation not found");
        }
      } catch (err) {
        console.error("Error fetching operation:", err);
        setError("Failed to load operation");
      } finally {
        setLoading(false);
      }
    };

    fetchOperation();
  }, [id]);

  const calculateBarrels = (mt) => {
    if (!mt || Number.isNaN(Number(mt))) return "-";
    return (Number(mt) * 7.33).toFixed(2);
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-white/60">Loading operation data...</p>
        </div>
      </div>
    );
  }

  if (error || !operationData) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-300">{error || "Operation not found"}</p>
          <Link
            href="/operations/sts-operations/new?tab=list"
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl text-white font-medium transition"
          >
            Back to List
          </Link>
        </div>
      </div>
    );
  }

  const op = operationData;

  return (
    <div className="min-h-screen text-white flex">
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
          <div className="flex-1 overflow-y-auto p-4">
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
                                    ? "bg-white/20 text-white border-orange-400/50 shadow-md"
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
                      className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
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
        <div className={`mx-auto py-8 space-y-6 ${isSidebarOpen ? "max-w-7xl px-6" : "px-6"}`}>
          <header className={`${isSidebarOpen ? "mt-0" : "mt-8"} mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4`}>
            {/* Left: Dashboard */}
            <Link
              href="/dashboard"
              className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
            >
              ← Dashboard
            </Link>

            {/* Center: Heading */}
            <div className="flex-1 flex flex-col items-center text-center">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-200 font-semibold">
                STS Management System
              </p>
              <h1 className="text-xl sm:text-2xl font-bold">View STS Operation</h1>
              <p className="text-xs text-slate-300 mt-1">
                Operation Ref: {op.Operation_Ref_No || "-"}
              </p>
            </div>
            
            {/* Right: Action Buttons */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {canEditForm && (
              <button
                onClick={() => router.push(`/operations/sts-operations/new/edit/${id}`)}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg text-white text-sm font-medium transition shadow-lg shadow-blue-500/30"
              >
                Edit Operation
              </button>
              )}
              <button
                onClick={() => router.push("/operations/sts-operations/new?tab=list")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition hover:scale-110"
                aria-label="Close"
                title="Close"
              >
                <span className="text-white text-xl">×</span>
              </button>
            </div>
          </header>

          {/* Operation Details */}
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="p-6 space-y-6">
              {/* Status Badge */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-lg font-semibold text-white">Operation Details</h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    statusTone[op.operationStatus]?.pill ||
                    "bg-white/10 text-white"
                  }`}
                >
                  {op.operationStatus || "-"}
                </span>
              </div>

              {/* Basic Information */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Operation Ref No
                  </label>
                  <p className="text-white font-medium">{op.Operation_Ref_No || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Type of Operation
                  </label>
                  <p className="text-white font-medium">{op.typeOfOperation || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Client
                  </label>
                  <p className="text-white font-medium">{op.client || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Agent
                  </label>
                  <p className="text-white font-medium">{op.agent || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Location
                  </label>
                  <p className="text-white font-medium">{op.location?.name || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Mooring Master
                  </label>
                  <p className="text-white font-medium">{op.mooringMaster?.name || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Type of Cargo
                  </label>
                  <p className="text-white font-medium">{op.typeOfCargo?.type || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Operation Type
                  </label>
                  <p className="text-white font-medium">{op.operationType || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Vessel Type (CHS)
                  </label>
                  <p className="text-white font-medium">{op.vesselTypeCHS || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Vessel Type (MS)
                  </label>
                  <p className="text-white font-medium">{op.vesselTypeMS || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Quantity (MT)
                  </label>
                  <p className="text-white font-medium">{op.quantity || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Quantity (Barrels)
                  </label>
                  <p className="text-white font-medium">{calculateBarrels(op.quantity)}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Flow Direction
                  </label>
                  <p className="text-white font-medium capitalize">{op.flowDirection || "-"}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Operation Start Time
                  </label>
                  <p className="text-white font-medium">{formatDate(op.operationStartTime)}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Operation End Time
                  </label>
                  <p className="text-white font-medium">{formatDate(op.operationEndTime)}</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-2">
                    Created At
                  </label>
                  <p className="text-white font-medium">{formatDate(op.createdAt)}</p>
                </div>
              </div>

              {/* CHS / MS Information — includes vessel info + attached docs (merged) */}
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">CHS / MS Information</h3>
                {(() => {
                  const downloadIcon = (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  );
                  const chsDocRows = [
                    { label: "SSQ", description: "Ship Standard Questionnaire", path: op.chsSSQ },
                    { label: "Q88", description: "Q88 Vessel Data", path: op.chsQ88 },
                    { label: "Mooring Arr.", description: "Mooring Arrangement", path: op.chsMooringArrangement },
                    { label: "GA Plan", description: "General Arrangement Plan", path: op.chsGAPlan },
                    { label: "MSDS", description: "Material Safety Data Sheet", path: op.chsMSDS },
                    { label: "Indemnity", description: "Indemnity Document", path: op.chsIndemnity },
                  ];
                  const msDocRows = [
                    { label: "SSQ", description: "Ship Standard Questionnaire", path: op.msSSQ },
                    { label: "Q88", description: "Q88 Vessel Data", path: op.msQ88 },
                    { label: "Mooring Arr.", description: "Mooring Arrangement", path: op.msMooringArrangement },
                    { label: "GA Plan", description: "General Arrangement Plan", path: op.msGAPlan },
                    { label: "MSDS", description: "Material Safety Data Sheet", path: op.msMSDS },
                    { label: "Indemnity", description: "Indemnity Document", path: op.msIndemnity },
                  ];
                  const DocRow = ({ label, description, path, accent }) => {
                    const isSky = accent === "sky";
                    const labelClass = isSky ? "text-[#54c1f9]" : "text-[#d8964e]";
                    const boxClass = "rounded-xl border border-white/10 bg-slate-800/60 shadow";
                    const btnClass = "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg shadow border border-white/10 bg-slate-700/80 text-white hover:bg-slate-600/80 text-sm font-medium transition";
                    return (
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className={`font-bold ${labelClass}`}>{label}</span>
                          <span className="text-white/60"> — {description}</span>
                        </p>
                        <div className={`p-3 ${boxClass}`}>
                          {path ? (
                            <button
                              type="button"
                              onClick={() => downloadFileFromUrl(path, `${label || "document"}-${(path.split("/").pop() || "file")}`)}
                              className={btnClass}
                            >
                              {downloadIcon}
                              Download
                            </button>
                          ) : (
                            <span className="text-white/70 text-sm">No file chosen</span>
                          )}
                        </div>
                      </div>
                    );
                  };
                  return (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4 space-y-3">
                        <h4 className="text-sm font-semibold text-sky-200 mb-3">CHS (Constant Heading Ship)</h4>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs text-white/60 mb-1">CHS Name</label>
                            <p className="text-white">{op.chs || "-"}</p>
                          </div>
                          <div>
                            <label className="block text-xs text-white/60 mb-1">Vessel Type</label>
                            <p className="text-white">{op.vesselTypeCHS || "-"}</p>
                          </div>
                          <div>
                            <label className="block text-xs text-white/60 mb-1">LOA (CHS)</label>
                            <p className="text-white">{op.loaCHS || "-"}</p>
                          </div>
                        </div>
                        <div className="border-t border-sky-400/20 pt-3 mt-3 space-y-3">
                          {chsDocRows.map((row) => (
                            <DocRow key={row.label} label={row.label} description={row.description} path={row.path} accent="sky" />
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-orange-400/20 bg-orange-500/5 p-4 space-y-3">
                        <h4 className="text-sm font-semibold text-orange-200 mb-3">MS (Manoeuvring Ship)</h4>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs text-white/60 mb-1">MS Name</label>
                            <p className="text-white">{op.ms || "-"}</p>
                          </div>
                          <div>
                            <label className="block text-xs text-white/60 mb-1">Vessel Type</label>
                            <p className="text-white">{op.vesselTypeMS || "-"}</p>
                          </div>
                          <div>
                            <label className="block text-xs text-white/60 mb-1">LOA (MS)</label>
                            <p className="text-white">{op.loaMS || "-"}</p>
                          </div>
                        </div>
                        <div className="border-t border-orange-400/20 pt-3 mt-3 space-y-3">
                          {msDocRows.map((row) => (
                            <DocRow key={row.label} label={row.label} description={row.description} path={row.path} accent="orange" />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Pre-STS Documents — same layout and CSS as Operations form */}
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-lg font-bold text-white mb-4">Pre-STS Documents</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                  {[
                    { label: "Joint Plan Operation", path: op.jpo },
                    { label: "Risk Assessment", path: op.riskAssessment },
                    { label: "Mooring Plan", description: "Upload mooring plan document", path: op.mooringPlan },
                  ].map((doc) => (
                    <div key={doc.label} className="min-w-0 space-y-2 flex flex-col">
                      <label className="block text-sm font-medium text-white break-words">
                        {doc.label}
                        {doc.description && <span className="text-white/60 font-normal"> — {doc.description}</span>}
                      </label>
                      {doc.path ? (
                        <div className="rounded-xl border border-white/10 bg-slate-800/80 shadow-md px-4 py-3 min-h-[44px] flex items-center w-full">
                          <button
                            type="button"
                            onClick={() => downloadFileFromUrl(doc.path, `${doc.label || "document"}-${(doc.path.split("/").pop() || "file")}`)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg shadow border border-white/10 bg-slate-700/80 text-sm font-medium transition hover:bg-slate-600/80 shrink-0"
                          >
                            <svg className="w-4 h-4 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            <span className="text-[#d8964e]">Download</span>
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-[#2b4961] shadow px-4 py-3 min-h-[44px] flex items-center w-full">
                          <span className="text-white/70 text-sm">No file chosen</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Attached Documents — System Generated + Manual Uploads + Other Documents */}
              {(() => {
                const linkedFormCodes = new Set(linkedForms.map((f) => f.formCode));
                const allDocs = op.documents || [];
                const consumedManualKeys = new Set();
                for (const lf of linkedForms) {
                  const m = findManualUploadDocForLinkedForm(allDocs, lf.formCode);
                  if (m) consumedManualKeys.add(manualDocKey(m));
                }
                const manualDocsRemaining = allDocs.filter(
                  (doc) =>
                    doc?.source === "MANUAL_UPLOAD" &&
                    doc?.filePath &&
                    !consumedManualKeys.has(manualDocKey(doc))
                );
                const systemDocs = allDocs.filter(
                  (doc) =>
                    doc?.source !== "MANUAL_UPLOAD" &&
                    doc?.source !== "CHECKLIST_HARDCOPY" &&
                    doc?.source !== "EMAIL_IMPORT" &&
                    !linkedFormCodes.has(doc.documentType)
                );
                const otherDocs = [
                  { label: "Standing Order", path: op.standingOrder },
                  { label: "Checklist 1", path: op.checklist1 },
                  ...manualDocsRemaining.map((d, idx) => ({
                    label: d.documentType || `Additional file ${idx + 1}`,
                    path: d.filePath,
                  })),
                ].filter((d) => d.path);
                const hasAny =
                  systemDocs.length > 0 || otherDocs.length > 0;
                if (!hasAny) return null;
                const downloadIcon = (
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                );
                return (
                  <div className="border-t border-white/10 pt-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Attached Documents</h3>
                    {systemDocs.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-white/80 mb-3">System Generated Documents</h4>
                        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                          {systemDocs.map((doc) => (
                            <div
                              key={`${doc.documentType}-${doc.filePath || doc.checklistId || Date.now()}`}
                              className={`rounded-xl border p-4 transition-all ${doc.filePath ? "border-emerald-500/30 bg-emerald-900/10" : "border-white/10 bg-white/5"}`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-orange-300 truncate">{doc.documentType || "-"}</p>
                                  <p className="text-sm font-semibold text-white truncate">{FORM_NAME_MAP[doc.documentType] || doc.documentType || "-"}</p>
                                </div>
                                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${doc.filePath ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-400"}`}>
                                  {doc.status || "-"}
                                </span>
                              </div>
                              {doc.filePath && (
                                <button
                                  type="button"
                                  onClick={() => downloadFileFromUrl(doc.filePath, `${doc.documentType || "document"}-${(doc.filePath.split("/").pop() || "file")}`)}
                                  className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-orange-400 hover:text-orange-300 underline"
                                >
                                  {downloadIcon}
                                  Download
                                </button>
                              )}
                              {doc.uploadedAt && <p className="text-[11px] text-white/60 mt-1">Uploaded: {formatDate(doc.uploadedAt)}</p>}
                              {doc.source && <p className="text-[11px] text-white/60">Source: {doc.source}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {otherDocs.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-white/80 mb-3">Other Documents</h4>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {otherDocs.map((doc) => (
                            <div key={doc.path} className="rounded-xl border border-white/10 bg-white/5 p-4">
                              <p className="text-sm font-medium text-white mb-2">{doc.label}</p>
                              <button
                                type="button"
                                onClick={() => downloadFileFromUrl(doc.path, `${doc.label || "document"}-${(doc.path.split("/").pop() || "file")}`)}
                                className="inline-flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 underline"
                              >
                                {downloadIcon}
                                Download
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ═══════════ Linked Checklist / Form Status ═══════════ */}
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Linked Forms Status</h3>

                {linkedFormsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400" />
                    Loading linked forms…
                  </div>
                ) : linkedForms.length > 0 ? (
                  <>
                    {/* Checklists */}
                    {linkedForms.filter((f) => f.category === "checklist").length > 0 && (
                      <div className="mb-5">
                        <h4 className="text-sm font-semibold text-white/80 mb-3">Checklists</h4>
                        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                          {linkedForms.filter((f) => f.category === "checklist").map((f) => (
                            <LinkedFormStatusCard key={f.formCode} form={f} documents={op.documents} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Equipment */}
                    {linkedForms.filter((f) => f.category === "equipment").length > 0 && (
                      <div className="mb-5">
                        <h4 className="text-sm font-semibold text-white/80 mb-3">STS Equipment</h4>
                        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                          {linkedForms.filter((f) => f.category === "equipment").map((f) => (
                            <LinkedFormStatusCard key={f.formCode} form={f} documents={op.documents} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feedback & Logs */}
                    {linkedForms.filter((f) => f.category === "feedback").length > 0 && (
                      <div className="mb-5">
                        <h4 className="text-sm font-semibold text-white/80 mb-3">Feedback & Logs</h4>
                        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                          {linkedForms.filter((f) => f.category === "feedback").map((f) => (
                            <LinkedFormStatusCard key={f.formCode} form={f} documents={op.documents} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-white/50 py-4">No linked form data available.</p>
                )}
              </div>

              {/* Equipment & Remarks — same two-column layout as Operations form */}
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-lg font-bold text-white mb-4">Equipment & Remarks</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <label className="block text-sm font-medium text-white">Equipment Used</label>
                    <div className="rounded-xl border border-white/10 bg-slate-800/60 shadow min-h-[44px] p-3">
                      {op.equipments && op.equipments.length > 0 ? (
                        <ul className="space-y-2">
                          {op.equipments.map((eq) => (
                            <li
                              key={eq.equipment?._id || eq.equipment?.id || `${eq.startTime}-${eq.equipment}`}
                              className="text-sm"
                            >
                              <span className="font-medium text-white">
                                {/* `equipmentName` is the snapshot taken at
                                    selection time — the last resort if the PMS
                                    record has since been deleted. */}
                                {eq.equipment?.equipmentName ||
                                  eq.equipment?.name ||
                                  eq.equipmentName ||
                                  "Equipment"}
                              </span>
                              {eq.equipmentSource === "Accessories" && (
                                <span className="ml-2 rounded-full border border-sky-400/30 bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-200">
                                  Accessory
                                </span>
                              )}
                              {(eq.startTime || eq.status) && (
                                <span className="block text-white/60 text-xs mt-0.5">
                                  {eq.startTime && `Start: ${formatDate(eq.startTime)}`}
                                  {eq.startTime && eq.status && " · "}
                                  {eq.status && `Status: ${eq.status}`}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-white/50 text-sm">No equipment selected</p>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <label className="block text-sm font-medium text-white">Remarks</label>
                    <div className="rounded-xl border border-white/10 bg-slate-800/60 shadow min-h-[120px] p-4">
                      <p className="text-white whitespace-pre-wrap text-sm">{op.remarks || "-"}</p>
                    </div>
                  </div>
                </div>
                <div className="min-w-0 space-y-2 mt-6">
                  <label className="block text-sm font-medium text-white">Description</label>
                  <div className="rounded-xl border border-white/10 bg-slate-800/60 shadow min-h-20 p-4">
                    <p className="text-white whitespace-pre-wrap text-sm">{op.description || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Imported Email Attachments — PDFs from the nomination email whose
                  filename didn't match a CHS/MS document slot; the operator downloads
                  and files them manually rather than the system guessing. */}
              {(() => {
                const emailAttachments = (op.documents || []).filter(
                  (d) => d?.source === "EMAIL_IMPORT" && d?.filePath
                );
                if (!emailAttachments.length) return null;

                const downloadIcon = (
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                );

                return (
                  <div className="border-t border-white/10 pt-6">
                    <h3 className="text-lg font-bold text-white mb-2">Imported Email Attachments</h3>
                    <p className="text-xs text-white/50 mb-4">
                      These PDFs came from the nomination email but couldn&apos;t be matched to a CHS/MS
                      document slot by filename. Download and attach them manually.
                    </p>
                    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                      {emailAttachments.map((doc, idx) => (
                        <div
                          key={`${doc.filePath}-${idx}`}
                          className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-4 transition-all"
                        >
                          <p className="text-sm font-semibold text-white truncate" title={doc.documentType}>
                            {doc.documentType || "Attachment"}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              downloadFileFromUrl(
                                doc.filePath,
                                doc.documentType || doc.filePath.split("/").pop() || "file"
                              )
                            }
                            className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-amber-300 hover:text-amber-200 underline"
                          >
                            {downloadIcon}
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
                <Link
                  href="/operations/sts-operations/new?tab=list"
                  className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10 transition"
                >
                  Back to List
                </Link>
                {canEditForm && (
                <button
                  onClick={() => router.push(`/operations/sts-operations/new/edit/${id}`)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-lg shadow-blue-500/30 transition"
                >
                  Edit Operation
                </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ViewOperationPage;
