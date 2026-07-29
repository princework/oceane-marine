"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";

export default function ManualAdminPage() {
  const pathname = usePathname();
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const { isOpsAdmin } = useOperationsRole();
  const sidebarTabs = getSidebarTabs(isOpsAdmin);
  const [expandedModules, setExpandedModules] = useState(new Set(["forms"]));
  const sidebarRef = useRef(null);

  const [formCodes, setFormCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  const fetchFormCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operations/form-checklist/manual/form-codes");
      const data = await res.json();
      if (res.ok && data.success) {
        setFormCodes(data.data || []);
      } else {
        setError(data.error || "Failed to load form codes");
      }
    } catch {
      setError("Failed to load form codes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpsAdmin) fetchFormCodes();
  }, [isOpsAdmin]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) {
      setError("Both code and name are required");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/operations/form-checklist/manual/form-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode.trim(), name: newName.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add form code");
      }

      setSuccess(`Form code "${newCode.trim()}" added successfully`);
      setNewCode("");
      setNewName("");
      await fetchFormCodes();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, code) => {
    if (!confirm(`Delete form code "${code}"? This will not affect existing manual records.`)) {
      return;
    }

    setDeleting(id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/operations/form-checklist/manual/form-codes/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete form code");
      }

      setSuccess(`Form code "${code}" deleted`);
      setFormCodes((prev) => prev.filter((fc) => fc._id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const adminPag = useOperationsClientPagination(formCodes, "manual-admin-codes");
  const { paginatedItems: formCodesPage, ...adminFooterProps } = adminPag;

  if (!isOpsAdmin) {
    return (
      <div className="min-h-screen bg-transparent text-white flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-5xl" aria-hidden>
            &#128274;
          </div>
          <h2 className="text-xl font-bold">Access Restricted</h2>
          <p className="text-white/60">
            Only operations administrators can manage manual form codes.
          </p>
          <Link
            href="/operations/sts-operations/new/form-checklist/manual/form"
            className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition"
          >
            Go to Manual
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex-1 min-w-0 bg-transparent text-white flex">
      {/* Left Sidebar */}
      <div
        ref={sidebarRef}
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
              <span className="text-white text-lg">&times;</span>
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
                            if (newSet.has(tab.key)) newSet.delete(tab.key);
                            else newSet.add(tab.key);
                            return newSet;
                          });
                        }}
                        className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                          tab.key === "forms"
                            ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-[1.02]"
                            : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 hover:scale-[1.01]"
                        }`}
                      >
                        <span className="flex-1">{tab.label}</span>
                        <span className={`text-sm transition-transform ${expandedModules.has(tab.key) ? "rotate-90" : ""}`}>
                          &#9654;
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
                                    ? "bg-gradient-to-r from-orange-500/90 to-orange-600/90 text-white border-orange-400 shadow-lg"
                                    : "text-white/80 hover:bg-white/10 hover:text-white border-white/5 hover:border-white/10"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-xs">&#9656;</span>
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
                      className="group flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 text-white/90 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 hover:scale-[1.01]"
                    >
                      <span className="flex-1">{tab.label}</span>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-white/10 bg-slate-800/50">
            <p className="text-[10px] text-slate-400 text-center">Operations Management System</p>
          </div>
        </div>
      </div>

      {/* Sidebar Toggle */}
      {!isSidebarOpen && (
        <div className="fixed left-4 top-4 z-40 flex items-center gap-2">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition border border-orange-400/30 shadow-lg shadow-orange-500/30 hover:scale-110"
            aria-label="Open sidebar"
          >
            <span className="text-white text-xl">&#9776;</span>
          </button>
          <Link
            href="/dashboard"
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            &larr; Dashboard
          </Link>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 min-w-0 pr-4 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
        <div className={`w-full py-6 sm:py-10 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-[95%] mx-auto pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`}>
          <header className={`${isSidebarOpen ? "mt-0" : "mt-8"} mb-4 flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4`}>
            <Link
              href="/dashboard"
              className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
            >
              &larr; Dashboard
            </Link>

            <div className="flex w-full flex-col items-center text-center sm:w-auto sm:flex-1">
              <p className="text-sm uppercase tracking-[0.25em] text-sky-300">
                Operations / Forms & Checklist / Manual
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Admin - Manage Form Codes
              </h1>
            </div>

            <div className="flex w-full shrink-0 justify-center sm:w-auto sm:justify-end">
              <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                <Link
                  href="/operations/sts-operations/new/form-checklist/manual/form"
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-white/90 hover:bg-white/10 transition whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm"
                >
                  Manual Form
                </Link>
                <Link
                  href="/operations/sts-operations/new/form-checklist/manual/list"
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-white/90 hover:bg-white/10 transition whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm"
                >
                  Manual List
                </Link>
                <Link
                  href="/operations/sts-operations/new/form-checklist/manual/admin"
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-orange-500 hover:bg-orange-600 transition whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm"
                >
                  Admin
                </Link>
              </div>
            </div>
          </header>

          {/* Add Form Code */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 border border-orange-400/30">
                <svg className="h-5 w-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Add New Form Code</h2>
                <p className="text-xs text-white/60 mt-0.5">
                  New codes will appear in the Form Code dropdown on the Manual form.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 backdrop-blur-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 backdrop-blur-sm">
                {success}
              </div>
            )}

            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label htmlFor="newCode" className="block text-sm font-medium text-white/90 mb-2">
                  Form Code <span className="text-red-400">*</span>
                </label>
                <input
                  id="newCode"
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="e.g. STS-OFD-05"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none transition-all backdrop-blur-sm"
                />
              </div>
              <div className="flex-[2]">
                <label htmlFor="newName" className="block text-sm font-medium text-white/90 mb-2">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="newName"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. STS Operations Manual"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none transition-all backdrop-blur-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving || !newCode.trim() || !newName.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {saving ? "Adding..." : "Add Code"}
                </button>
              </div>
            </form>
          </div>

          {/* Existing Form Codes */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 bg-white/5">
              <h3 className="text-lg font-semibold text-white">
                Existing Form Codes
                {!loading && (
                  <span className="ml-2 text-sm font-normal text-white/50">
                    ({formCodes.length})
                  </span>
                )}
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-white/60">Loading form codes...</p>
              </div>
            ) : formCodes.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-white/60">No form codes found. Add one above.</p>
              </div>
            ) : (
              <>
              <div className="min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] qhse-table-scroll">
                <table className="w-full min-w-[520px] text-left">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-3 py-3 text-left text-[10px] font-semibold text-white/90 uppercase tracking-wider sm:px-6 sm:py-4 sm:text-xs">
                        Code
                      </th>
                      <th className="min-w-[200px] px-3 py-3 text-left text-[10px] font-semibold text-white/90 uppercase tracking-wider sm:px-6 sm:py-4 sm:text-xs">
                        Name
                      </th>
                      <th className="w-px whitespace-nowrap px-3 py-3 text-right text-[10px] font-semibold text-white/90 uppercase tracking-wider sm:px-6 sm:py-4 sm:text-xs">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {formCodesPage.map((fc) => (
                      <tr key={fc._id} className="hover:bg-white/5 transition">
                        <td className="px-3 py-3 align-top whitespace-nowrap sm:px-6 sm:py-4">
                          <span className="text-xs font-mono text-sky-300 sm:text-sm">{fc.code}</span>
                        </td>
                        <td className="min-w-[12rem] px-3 py-3 align-top sm:min-w-0 sm:px-6 sm:py-4">
                          <span className="text-xs leading-snug text-white sm:text-sm">{fc.name}</span>
                        </td>
                        <td className="px-3 py-3 text-right align-top sm:px-6 sm:py-4">
                          <button
                            type="button"
                            onClick={() => handleDelete(fc._id, fc.code)}
                            disabled={deleting === fc._id}
                            title="Delete form code"
                            aria-label={`Delete ${fc.code}`}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
                          >
                            {deleting === fc._id ? (
                              <span className="whitespace-nowrap">…</span>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5 shrink-0 sm:h-3.5 sm:w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span className="hidden sm:inline">Delete</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <OperationsListPaginationFooter {...adminFooterProps} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
