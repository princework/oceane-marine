"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import { HARDCOPY_DOC_PREFIX } from "@/lib/utils/sts-linked-form-file";
import { downloadFileFromUrl } from "@/lib/utils/sts-file-download";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import OperationsSelectField from "@/app/operations/components/OperationsSelectField";

/** External STS form app: `{base}/{formNo}` with optional `?operationRef=` and `mode=update` (see operations-sts-checklist). */
const STS_CHECKLIST_EXTERNAL_BASE = (
  process.env.NEXT_PUBLIC_STS_CHECKLIST_FORMS_BASE_URL ?? "https://operations.oceanegroup.oceanemarine.com"
).replace(/\/$/, "");

function stsChecklistExternalUrl(formNo, operationRef, options) {
  const path = `${STS_CHECKLIST_EXTERNAL_BASE}/${encodeURIComponent(formNo)}`;
  const ref = operationRef?.trim();
  if (!ref) {
    return path;
  }
  const params = new URLSearchParams();
  params.set("operationRef", ref);
  if (options?.mode === "update") {
    params.set("mode", "update");
  }
  return `${path}?${params.toString()}`;
}

const FORMS = [
  { formNo: "OPS-OFD-001", title: "Checklist 1 - Before Operation Commence", apiPath: "ops-ofd-001" },
  { formNo: "OPS-OFD-001A", title: "Ship's Standard Questionnaire", apiPath: "ops-ofd-001a" },
  { formNo: "OPS-OFD-002", title: "Checklist 2 - Before Run In & Mooring", apiPath: "ops-ofd-002" },
  { formNo: "OPS-OFD-003", title: "Checklist 3A & 3B - Before Cargo Transfer", apiPath: "ops-ofd-003" },
  { formNo: "OPS-OFD-004", title: "Checklist 4A-F - Pre Transfer Conference", apiPath: "ops-ofd-004" },
  { formNo: "OPS-OFD-005", title: "Checklist 5A-C – After Connection Checks till Disconnection", apiPath: "ops-ofd-005" },
  { formNo: "OPS-OFD-005B", title: "Checklist 6A & B – Checks Before & After Disconnection", apiPath: "ops-ofd-005b" },
  { formNo: "OPS-OFD-005C", title: "Checklist 7 - Pre Transfer Conference Alongside a Terminal", apiPath: "ops-ofd-005c" },
  { formNo: "OPS-OFD-005D", title: "Declaration for STS operations (At port & Terminal)", apiPath: "ops-ofd-005d" },
  { formNo: "OPS-OFD-005E", title: "Declaration Of STS At Sea", apiPath: "declaration-of-sea" },
  { formNo: "OPS-OFD-028", title: "Personnel Transfer Basket Checklist", apiPath: "ops-ofd-028" },
  { formNo: "OPS-OFD-009", title: "Mooring Master's Job Report", apiPath: "ops-ofd-009" },
  { formNo: "OPS-OFD-011", title: "STS Superintendent Standing Order", apiPath: "ops-ofd-011" },
  { formNo: "OPS-OFD-014", title: "STS Equipment Checklist", apiPath: "ops-ofd-014" },
  { formNo: "OPS-OFD-015", title: "Hourly Checks on Discharged and Received Quantities", apiPath: "ops-ofd-015" },
  { formNo: "OPS-OFD-018", title: "Timesheet", apiPath: "ops-ofd-018" },
  { formNo: "OPS-OFD-020", title: "Master's Feedback Form", apiPath: "ops-ofd-020" },
  { formNo: "OPS-OFD-023", title: "Record of Work Hours (Rest Hours CKL)", apiPath: "ops-ofd-023" },
  { formNo: "OPS-OFD-029", title: "Mooring Master Expense Sheet", apiPath: "ops-ofd-029" },
];

/** Map checklist table form number → linked-forms / hardcopy API target. */
function formNoToHardcopyTarget(formNo) {
  if (formNo === "OPS-OFD-001A") return "OPS-OFD-001-A";
  return formNo;
}

export default function StsChecklistPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const { isOpsAdmin, role } = useOperationsRole();
  const canUploadHardcopy = role === "admin" || role === "editor";
  const sidebarTabs = getSidebarTabs(isOpsAdmin);
  const [activeTab] = useState("forms");
  const [expandedModules, setExpandedModules] = useState(new Set(["forms"]));
  const sidebarRef = useRef(null);
  const [copiedLink, setCopiedLink] = useState(null);
  const [selectedOperationRef, setSelectedOperationRef] = useState("");
  const [inProgressOperations, setInProgressOperations] = useState([]);
  const [loadingOperations, setLoadingOperations] = useState(false);
  const [overallCopied, setOverallCopied] = useState(false);
  const [operationDocuments, setOperationDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [rowUploadingTarget, setRowUploadingTarget] = useState(null);
  const [uploadNotice, setUploadNotice] = useState(null);
  const pendingHardcopyTargetRef = useRef(null);
  const hiddenHardcopyInputRef = useRef(null);

  const hardcopyDocs = useMemo(
    () =>
      (operationDocuments || []).filter((d) => d.source === "CHECKLIST_HARDCOPY" && d.filePath),
    [operationDocuments]
  );

  useEffect(() => {
    const ref = selectedOperationRef?.trim();
    if (!ref) {
      setOperationDocuments([]);
      setUploadNotice(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingDocuments(true);
        const res = await fetch(
          `/api/operations/sts/linked-forms?operationRef=${encodeURIComponent(ref)}`
        );
        const json = await res.json();
        if (!cancelled && json.success) {
          setOperationDocuments(json.documents || []);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setOperationDocuments([]);
      } finally {
        if (!cancelled) setLoadingDocuments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOperationRef]);

  const refreshDocuments = async () => {
    const ref = selectedOperationRef?.trim();
    if (!ref) return;
    try {
      const res = await fetch(
        `/api/operations/sts/linked-forms?operationRef=${encodeURIComponent(ref)}`
      );
      const json = await res.json();
      if (json.success) setOperationDocuments(json.documents || []);
    } catch (e) {
      console.error(e);
    }
  };

  const triggerRowHardcopyUpload = (formNo) => {
    if (!selectedOperationRef?.trim()) {
      alert("Please select an operation reference first.");
      return;
    }
    const target = formNoToHardcopyTarget(formNo);
    pendingHardcopyTargetRef.current = target;
    hiddenHardcopyInputRef.current?.click();
  };

  const handleHardcopyFilePicked = async (e) => {
    const file = e.target.files?.[0];
    const formTarget = pendingHardcopyTargetRef.current;
    pendingHardcopyTargetRef.current = null;
    e.target.value = "";
    const ref = selectedOperationRef?.trim();
    if (!file || !formTarget || !ref) return;

    try {
      setRowUploadingTarget(formTarget);
      setUploadNotice(null);
      const fd = new FormData();
      fd.set("operationRef", ref);
      fd.set("formTarget", formTarget);
      fd.set("file", file);
      const res = await fetch("/api/operations/sts/checklist-hardcopy", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Upload failed");
      }
      setUploadNotice({ type: "ok", text: `Hardcopy saved for ${formTarget}.` });
      setTimeout(() => setUploadNotice(null), 4000);
      await refreshDocuments();
    } catch (err) {
      setUploadNotice({ type: "error", text: err.message || "Upload failed" });
      setTimeout(() => setUploadNotice(null), 6000);
    } finally {
      setRowUploadingTarget(null);
    }
  };

  const handleViewList = (apiPath) => {
    router.push(`/operations/sts-operations/new/form-checklist/sts-checklist/${apiPath}/list`);
  };

  // Fetch INPROGRESS operations on mount
  useEffect(() => {
    const fetchInProgressOperations = async () => {
      try {
        setLoadingOperations(true);
        const response = await fetch('/api/operations/sts/list?status=INPROGRESS');
        const data = await response.json();
        
        if (data.success && data.data) {
          // Extract operation ref numbers and trim whitespace
          const refs = data.data
            .map(op => op.Operation_Ref_No?.trim()) // Trim whitespace
            .filter(ref => ref && ref.length > 0) // Remove null/undefined/empty
            .sort(); // Sort alphabetically
          
          setInProgressOperations(refs);
        }
      } catch (error) {
        console.error('Error fetching INPROGRESS operations:', error);
      } finally {
        setLoadingOperations(false);
      }
    };

    fetchInProgressOperations();
  }, []);

  const handleCopyLink = async (link, formNo) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(formNo);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = link;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedLink(formNo);
        setTimeout(() => setCopiedLink(null), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  /** Open form: `{base}/{formNo}` or `{base}/{formNo}?operationRef=`; update adds `&mode=update`. */
  const getFormLinks = (formNo) => {
    if (!selectedOperationRef?.trim()) {
      const base = stsChecklistExternalUrl(formNo);
      return { createLink: base, updateLink: null };
    }
    return {
      createLink: stsChecklistExternalUrl(formNo, selectedOperationRef),
      updateLink: stsChecklistExternalUrl(formNo, selectedOperationRef, { mode: "update" }),
    };
  };

  // Forms that need separate copy buttons (001A, 005D, 028)
  const formsWithSeparateCopy = ['OPS-OFD-001A', 'OPS-OFD-005D', 'OPS-OFD-028'];

  // Forms included in overall copy (001, 002, 003, 004, 005, 005b, 005c, 005e, 009, 011, 014, 015, 018, 020, 023, 028, 029)
  const overallCopyFormNos = ['OPS-OFD-001', 'OPS-OFD-002', 'OPS-OFD-003', 'OPS-OFD-004', 'OPS-OFD-005', 'OPS-OFD-005B', 'OPS-OFD-005C', 'OPS-OFD-005E', 'OPS-OFD-009', 'OPS-OFD-011', 'OPS-OFD-014', 'OPS-OFD-015', 'OPS-OFD-018', 'OPS-OFD-020', 'OPS-OFD-023', 'OPS-OFD-028', 'OPS-OFD-029'];

  const handleOverallCopy = async () => {
    if (!selectedOperationRef) {
      alert('Please select an Operation Ref first');
      return;
    }

    const cleanOperationRef = selectedOperationRef.trim();
    const rows = overallCopyFormNos.map((formNo) => {
      const form = FORMS.find((f) => f.formNo === formNo);
      if (!form) return null;
      const url = stsChecklistExternalUrl(formNo, cleanOperationRef);
      return { code: formNo, name: form.title, url };
    }).filter(Boolean);

    const maxCodeLen = Math.max(...rows.map(r => r.code.length));
    const maxNameLen = Math.max(...rows.map(r => r.name.length));

    const header = `${"Form Code".padEnd(maxCodeLen + 4)}${"Form Name".padEnd(maxNameLen + 4)}Link`;
    const separator = `${"-".repeat(maxCodeLen + 4)}${"-".repeat(maxNameLen + 4)}${"-".repeat(4)}`;
    const lines = rows.map(r =>
      `${r.code.padEnd(maxCodeLen + 4)}${r.name.padEnd(maxNameLen + 4)}${r.url}`
    );

    const textToCopy = [header, separator, ...lines].join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      setOverallCopied(true);
      setTimeout(() => setOverallCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy links:', err);
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setOverallCopied(true);
        setTimeout(() => setOverallCopied(false), 3000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
        alert('Failed to copy links');
      }
      document.body.removeChild(textArea);
    }
  };

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
        <div className="fixed left-4 top-4 z-40 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1.5">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition border border-orange-400/30 shadow-lg shadow-orange-500/30 hover:scale-110 sm:h-10 sm:w-10"
            aria-label="Open sidebar"
          >
            <span className="text-white text-xl">☰</span>
          </button>
          <Link
            href="/dashboard"
            className="md:hidden inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-black/25 backdrop-blur-md transition hover:bg-white/15"
          >
            ← Dashboard
          </Link>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
        <div className={`mx-auto py-6 sm:py-10 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`}>
          <header className={`${isSidebarOpen ? "mt-0" : "mt-8"} mb-4 flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4`}>
            {/* Left: Dashboard */}
            <Link
              href="/dashboard"
              className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
            >
              ← Dashboard
            </Link>

            {/* Center: Heading */}
            <div className="flex w-full flex-col items-center text-center sm:w-auto sm:flex-1">
              <p className="text-xs uppercase tracking-[0.25em] text-sky-300">
                Operations / Forms & Checklist / STS Checklist
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-white">STS Checklist</h1>
              <p className="text-xs text-slate-200 mt-1">
                Select a form to view all submitted entries
              </p>
            </div>
            
            <div className="hidden w-[140px] shrink-0 sm:block" aria-hidden />
          </header>

          {/* Operation Ref Dropdown */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="flex items-center gap-4 flex-wrap">
              <label htmlFor="operationRef" className="text-sm font-semibold text-white/90 whitespace-nowrap">
                Select Operation Ref:
              </label>
              <OperationsSelectField
                id="operationRef"
                ariaLabel="Select operation reference"
                value={selectedOperationRef}
                onChange={(v) => setSelectedOperationRef(v)}
                options={[
                  { value: "", label: "-- Select Operation Ref --" },
                  ...inProgressOperations.map((ref) => ({
                    value: ref,
                    label: ref,
                  })),
                ]}
                disabled={loadingOperations}
                loading={loadingOperations}
                triggerClassName="flex-1 max-w-xs px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent min-h-[2.75rem]"
                className="min-w-0 flex-1 max-w-xs"
              />
              {selectedOperationRef && (
                <>
                  <button
                    onClick={() => setSelectedOperationRef("")}
                    className="px-4 py-2 text-sm text-red-400 hover:text-red-300 transition"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleOverallCopy}
                    className="px-4 py-2.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 hover:border-purple-400/50 text-purple-300 hover:text-purple-200 text-sm font-medium transition-all duration-200 flex items-center gap-2"
                  >
                    {overallCopied ? (
                      <>
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-400">All Links Copied</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Overall Copy</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
            {selectedOperationRef && (
              <p className="mt-3 text-xs text-sky-300">
                Selected: <span className="font-semibold">{selectedOperationRef}</span> - Links below will include this operation reference
              </p>
            )}
          </div>

          {uploadNotice && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                uploadNotice.type === "ok"
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                  : "border-red-400/40 bg-red-500/10 text-red-100"
              }`}
            >
              {uploadNotice.text}
            </div>
          )}

          {/* Forms Table */}
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <input
                ref={hiddenHardcopyInputRef}
                type="file"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={handleHardcopyFilePicked}
              />
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                      Form Number
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                      Form Title
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                      Link
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-white/90 uppercase tracking-wider min-w-[11rem]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {FORMS.map((form) => {
                    const hcTarget = formNoToHardcopyTarget(form.formNo);
                    const hcKey = `${HARDCOPY_DOC_PREFIX}${hcTarget}`;
                    const hcCount = hardcopyDocs.filter((d) => d.documentType === hcKey).length;
                    const latestHc = [...hardcopyDocs]
                      .filter((d) => d.documentType === hcKey)
                      .sort(
                        (a, b) =>
                          new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
                      )[0];
                    return (
                    <tr
                      key={form.formNo}
                      className="hover:bg-white/5 transition"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-orange-400 font-semibold">
                          {form.formNo}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/90">{form.title}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          {selectedOperationRef ? (
                            // Show Create and Update links when operation ref is selected
                            <div className="flex flex-col gap-2">
                              <a
                                href={getFormLinks(form.formNo).createLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 hover:border-green-400/50 text-green-300 hover:text-green-200 text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Create New Form
                              </a>
                              <a
                                href={getFormLinks(form.formNo).updateLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 hover:border-blue-400/50 text-blue-300 hover:text-blue-200 text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Update Form
                              </a>
                              {/* Separate copy button for 001A, 005D, 028 */}
                              {formsWithSeparateCopy.includes(form.formNo) && (
                                <button
                                  onClick={() => {
                                    const linkWithRef = getFormLinks(form.formNo).createLink;
                                    handleCopyLink(linkWithRef, form.formNo);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 hover:border-sky-400/50 text-sky-300 hover:text-sky-200 text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5"
                                >
                                  {copiedLink === form.formNo ? (
                                    <>
                                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span className="text-green-400">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                      <span>Copy Link</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          ) : (
                            // Show copy link button when no operation ref is selected
                            <button
                              onClick={() => handleCopyLink(stsChecklistExternalUrl(form.formNo), form.formNo)}
                              className="rounded-lg bg-sky-500/20 px-2.5 py-1.5 text-[11px] font-medium text-sky-300 transition-all duration-200 hover:bg-sky-500/30 hover:text-sky-200 flex items-center gap-1.5 border border-sky-400/30 hover:border-sky-400/50 sm:px-4 sm:py-2 sm:text-sm sm:gap-2"
                            >
                              {copiedLink === form.formNo ? (
                                <>
                                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="text-green-400">Link copied</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        <div className="flex flex-col items-stretch gap-2 sm:items-center">
                          <button
                            type="button"
                            onClick={() => handleViewList(form.apiPath)}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-orange-500/30 transition-all duration-200 hover:from-orange-600 hover:to-orange-700 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-95 sm:px-5 sm:py-2.5 sm:text-sm sm:hover:scale-105"
                          >
                            View List
                          </button>
                          {canUploadHardcopy && (
                            <>
                              <button
                                type="button"
                                onClick={() => triggerRowHardcopyUpload(form.formNo)}
                                disabled={
                                  !selectedOperationRef?.trim() ||
                                  rowUploadingTarget === hcTarget
                                }
                                title={
                                  selectedOperationRef?.trim()
                                    ? "Attach a scanned or saved file for this form"
                                    : "Select an operation reference above first"
                                }
                                className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[11px] font-semibold text-amber-100 shadow-md transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-45 sm:px-5 sm:py-2.5 sm:text-sm"
                              >
                                {rowUploadingTarget === hcTarget ? "Uploading…" : "Upload"}
                              </button>
                              {selectedOperationRef?.trim() && (
                                <div className="text-[10px] leading-tight text-white/50">
                                  {loadingDocuments
                                    ? "…"
                                    : hcCount > 0
                                      ? `${hcCount} hardcop${hcCount === 1 ? "y" : "ies"}`
                                      : "No hardcopy"}
                                  {latestHc?.filePath ? (
                                    <>
                                      {" · "}
                                      <button
                                        type="button"
                                        onClick={() => downloadFileFromUrl(latestHc.filePath, `${form.formNo || "hardcopy"}-${(latestHc.filePath.split("/").pop() || "file")}`)}
                                        className="font-semibold text-orange-300/90 underline-offset-2 hover:text-orange-200 hover:underline"
                                        title="Download latest hardcopy"
                                      >
                                        Download
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
