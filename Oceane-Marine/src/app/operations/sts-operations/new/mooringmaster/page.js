"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { ActionDeleteIcon, ActionEditIcon } from "@/app/components/RecordActionIcons";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";

export default function MooringMasterPage() {
  const [items, setItems] = useState([]);
  const [value, setValue] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const [expandedModules, setExpandedModules] = useState(new Set());
  const sidebarRef = useRef(null);
  const pathname = usePathname();
  const { canManageMasterData, isOpsAdmin } = useOperationsRole();

  useEffect(() => {
    if (canManageMasterData) load();
  }, [canManageMasterData]);

  const mooringPag = useOperationsClientPagination(items, "mooring-master");
  const { paginatedItems: mooringPageItems, ...mooringFooterProps } = mooringPag;

  if (!canManageMasterData) {
    return (
      <div className="min-h-screen bg-transparent text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl">&#128274;</div>
          <h2 className="text-xl font-bold">Access Restricted</h2>
          <p className="text-white/60">Only administrators can access master data management.</p>
          <a href="/operations/sts-operations/new" className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition">
            Go to Documentation
          </a>
        </div>
      </div>
    );
  }

  const sidebarTabs = getSidebarTabs(isOpsAdmin);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/master/mooring-master/list");
      const data = await res.json();
      setItems(data?.mooringMasters || []);
    } catch (err) {
      setError("Failed to load mooring masters");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!value.trim()) return;
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/master/mooring-master/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      setValue("");
      setEmail("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item) => {
    setError("");
    setEditingId(item._id);
    setEditName(item.name || "");
    setEditEmail(item.email || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditEmail("");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    if (!editEmail.trim()) {
      setError("Email is required");
      return;
    }
    try {
      setEditSaving(true);
      const res = await fetch(`/api/master/mooring-master/${editingId}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this mooring master?"))
      return;
    try {
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      const res = await fetch(`/api/master/mooring-master/${id}/delete`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Match exact href for top-level tabs so /new/mooringmaster doesn't match /new (Documentation)
  const activeTab =
    sidebarTabs.find((tab) => {
      if (tab.submodules) {
        return tab.submodules.some(
          (sub) => pathname === sub.href || pathname.startsWith(sub.href + "/")
        );
      }
      if (tab.href) {
        return pathname === tab.href || pathname === tab.href + "/";
      }
      return false;
    })?.key || "mooring";

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
          <Link
            href="/operations/sts-operations/new"
            className="md:hidden inline-flex max-w-[11rem] min-w-0 shrink items-center gap-1 truncate rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-[10px] font-semibold text-white/90 shadow-md backdrop-blur-md transition hover:bg-white/10"
            title="Back to STS form"
          >
            ← STS form
          </Link>
        </div>
      )}

      {/* Main Content - fixed left margin so content stays in place when sidebar collapses */}
      <div className={`flex-1 min-w-0 pr-4 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
        <div className={`w-full mx-auto py-6 sm:py-10 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`}>
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
              <p className="text-sm uppercase tracking-[0.25em] text-sky-300">
                Master Data
              </p>
              <h1 className="text-xl sm:text-2xl font-bold">Mooring Masters</h1>
            </div>
            
            {/* Right: Action Buttons — desktop only; mobile uses top bar */}
            <div className="hidden shrink-0 md:flex md:items-center md:gap-3">
              <Link
                href="/operations/sts-operations/new"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur border border-white/10 hover:bg-white/20 transition"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to STS form
              </Link>
            </div>
          </header>

      {canManageMasterData && (
        <>
      {/* Add Mooring Master Form */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 border border-orange-400/30">
            <svg
              className="h-5 w-5 text-orange-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Add Mooring Master</h2>
            <p className="text-xs text-white/60 mt-0.5">
              Register new mooring masters for operations
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {error}
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="flex-1 relative">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter mooring master name"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none transition-all backdrop-blur-sm"
            />
          </div>
          <div className="flex-1 relative">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none transition-all backdrop-blur-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/30 transition-all hover:from-orange-600 hover:to-orange-700 hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 sm:min-w-[140px] sm:gap-2 sm:px-6 sm:py-3.5 sm:text-sm"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Adding...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Add
              </>
            )}
          </button>
        </form>
      </div>
        </>
      )}

      {/* Mooring Masters List Table */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="px-4 py-4 border-b border-white/10 bg-white/5 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 border border-sky-400/30 sm:h-10 sm:w-10">
                <svg
                  className="h-4 w-4 text-sky-400 sm:h-5 sm:w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white sm:text-xl">
                  Mooring Masters List
                </h2>
                <p className="text-[11px] text-white/60 mt-0.5 sm:text-xs">
                  Manage all mooring masters
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[11px] font-semibold text-white/80 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm">
              <svg
                className="h-3.5 w-3.5 text-white/60 sm:h-4 sm:w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="tabular-nums">
                {items.length} {items.length === 1 ? "Item" : "Items"}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Availability
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {mooringPageItems.map((item, idx) => (
                <tr
                  key={item._id || item.name}
                  className="hover:bg-white/5 transition-colors duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-sm font-semibold text-white/80">
                      {(mooringPag.page - 1) * mooringPag.pageSize + idx + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editingId === item._id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") cancelEdit();
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEdit();
                          }
                        }}
                        disabled={editSaving}
                        autoFocus
                        className="w-full max-w-md rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white placeholder:text-white/40 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/30 outline-none disabled:opacity-60"
                        aria-label="Edit mooring master name"
                      />
                    ) : (
                      <div className="font-semibold text-white">{item.name}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === item._id ? (
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") cancelEdit();
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEdit();
                          }
                        }}
                        disabled={editSaving}
                        placeholder="email@example.com"
                        className="w-full max-w-md rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/30 outline-none disabled:opacity-60"
                        aria-label="Edit mooring master email"
                      />
                    ) : item.email ? (
                      <a
                        href={`mailto:${item.email}`}
                        className="text-sky-300 hover:text-sky-200 hover:underline"
                      >
                        {item.email}
                      </a>
                    ) : (
                      <span className="text-white/40">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div
                      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                        item.availabilityStatus === "AVAILABLE"
                          ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40"
                          : "bg-red-500/15 text-red-100 border border-red-400/40"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          item.availabilityStatus === "AVAILABLE"
                            ? "bg-emerald-400"
                            : "bg-red-400"
                        }`}
                      />
                      {item.availabilityStatus === "AVAILABLE"
                        ? "Available"
                        : "Not available"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {canManageMasterData &&
                      (editingId === item._id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={editSaving || !editName.trim() || !editEmail.trim()}
                            className="rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {editSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={editSaving}
                            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <ActionEditIcon
                            onClick={() => startEdit(item)}
                            disabled={!!actionLoading[item._id] || editSaving}
                            title="Edit name"
                          />
                          <ActionDeleteIcon
                            onClick={() => handleDelete(item._id)}
                            disabled={!!actionLoading[item._id] || !!editingId}
                            loading={!!actionLoading[item._id]}
                            title="Delete"
                          />
                        </div>
                      ))}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td className="px-6 py-12 text-center" colSpan={5}>
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 border border-white/10">
                        <svg
                          className="h-8 w-8 text-white/40"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white/60">
                          No mooring masters found
                        </p>
                        <p className="text-xs text-white/40 mt-1">
                          Add your first mooring master above to get started
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <OperationsListPaginationFooter {...mooringFooterProps} />
      </div>
        </div>
      </div>
    </div>
  );
}
