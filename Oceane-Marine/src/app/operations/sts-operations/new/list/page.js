"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useOperationsLoading } from "@/app/operations/OperationsLoadingContext";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { getExportColumns, buildExportHeaders, buildExportRow } from "../sts-export-columns";
import {
  ActionViewIcon,
  ActionEditIcon,
  ActionDeleteIcon,
  ActionDownloadIcon,
} from "@/app/components/RecordActionIcons";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";

const statusTone = {
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

export default function STSListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const [activeTab, setActiveTab] = useState("documentation");
  const [expandedModules, setExpandedModules] = useState(new Set());
  const sidebarRef = useRef(null);
  
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOperations, setFilteredOperations] = useState([]);
  const { setPageLoading } = useOperationsLoading();
  const { canEditForm, canDeleteForm, isOpsAdmin } = useOperationsRole();
  const sidebarTabs = useMemo(() => getSidebarTabs(isOpsAdmin), [isOpsAdmin]);

  useEffect(() => {
    if (pathname === "/operations/sts-operations/new/list") {
      setActiveTab("documentation");
    } else if (pathname.startsWith("/operations/sts-operations/new/compatibility")) {
      setActiveTab("compatibility");
    } else if (pathname.startsWith("/operations/sts-operations/new/form-checklist")) {
      setActiveTab("forms");
      setExpandedModules((prev) => new Set([...prev, "forms"]));
    }
  }, [pathname]);

  useEffect(() => {
    fetchOperations();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredOperations(operations);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = operations.filter((op) => {
        const opRef = op.Operation_Ref_No?.toLowerCase() || "";
        const type = op.typeOfOperation?.toLowerCase() || "";
        const location = op.location?.name?.toLowerCase() || "";
        const client = op.client?.toLowerCase() || "";
        const agent = op.agent?.toLowerCase() || "";
        const chs = op.chs?.toLowerCase() || "";
        const ms = op.ms?.toLowerCase() || "";
        return (
          opRef.includes(query) ||
          type.includes(query) ||
          location.includes(query) ||
          client.includes(query) ||
          agent.includes(query) ||
          chs.includes(query) ||
          ms.includes(query)
        );
      });
      setFilteredOperations(filtered);
    }
  }, [searchQuery, operations]);

  const pagination = useOperationsClientPagination(filteredOperations, searchQuery);
  const { paginatedItems: paginatedOperations, ...paginationFooterProps } = pagination;

  const fetchOperations = async () => {
    try {
      setLoading(true);
      setPageLoading(true);
      const response = await fetch("/api/operations/sts/list");
      const data = await response.json();
      
      if (data.success) {
        setOperations(data.data || []);
        setFilteredOperations(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching operations:", error);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this operation?")) {
      return;
    }

    try {
      const response = await fetch(`/api/operations/sts/${id}/delete`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        fetchOperations();
      } else {
        alert(data.error || "Failed to delete operation");
      }
    } catch (error) {
      console.error("Error deleting operation:", error);
      alert("Failed to delete operation");
    }
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateBarrels = (mt) => {
    if (!mt || isNaN(mt)) return "—";
    return (mt * 7.33).toFixed(2);
  };

  const downloadExcel = () => {
    const columns = getExportColumns();
    const headers = buildExportHeaders(columns);
    const escapeCsv = (val) => {
      const s = val == null ? "" : String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = filteredOperations.map((op) => buildExportRow(op, columns));
    const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `STS-Operations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className={`mx-auto py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-7xl px-3 sm:px-4 md:px-6" : "px-3 sm:px-4 md:px-6"}`}>
          <header className={`${isSidebarOpen ? "mt-0" : "mt-8"} mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4`}>
            {/* Left: Dashboard */}
            <Link
              href="/dashboard"
              className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
            >
              ← Dashboard
            </Link>

            {/* Center: Heading */}
            <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-slate-200 font-semibold">
                STS Management System
              </p>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">All STS Operations</h1>
            </div>
            
            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 self-end sm:self-auto">
              <Link
                href="/operations/sts-operations/new"
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-lg text-white text-xs sm:text-sm font-medium transition shadow-lg shadow-orange-500/30"
              >
                + New Operation
              </Link>
            </div>
          </header>

          {/* Search Bar + Download */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <input
                type="text"
                placeholder="Search by Ref No, Type, Location, Client, Agent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg sm:rounded-xl border border-white/10 bg-white/5 px-3 sm:px-4 py-2 sm:py-3 pl-8 sm:pl-10 text-xs sm:text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <ActionDownloadIcon
              onClick={downloadExcel}
              disabled={filteredOperations.length === 0}
              title="Download Excel"
              className="!rounded-lg sm:!rounded-xl !p-2.5"
            />
          </div>

          {/* Operations Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-white/60">Loading operations...</p>
            </div>
          ) : filteredOperations.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
              <p className="text-white/60">
                {searchQuery ? "No operations found matching your search." : "No operations found."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="overflow-x-auto scrollbar-none">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Type of Operation
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                        VSL Name
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Agent
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Barrels
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider w-28 sm:w-32">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {paginatedOperations.map((op) => (
                      <tr key={op._id} className="hover:bg-white/5 transition">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <span className="text-xs sm:text-sm text-white/90">
                            {formatDateTime(op.operationStartTime)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className="text-xs sm:text-sm text-white/90">
                            {op.typeOfOperation || "—"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className="text-xs sm:text-sm text-white/90">
                            {op.location?.name || "—"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded text-[10px] sm:text-xs font-medium ${
                              statusTone[op.operationStatus]?.pill ||
                              "bg-white/10 text-white"
                            }`}
                          >
                            {op.operationStatus || "—"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className="text-xs sm:text-sm text-white/90">
                            {op.chs || op.ms || "—"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className="text-xs sm:text-sm text-white/90">
                            {op.client || "—"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className="text-xs sm:text-sm text-white/90">
                            {op.agent || "—"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <span className="text-xs sm:text-sm text-white/90">
                            {calculateBarrels(op.quantity)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex gap-1.5 sm:gap-2 justify-center">
                            <ActionViewIcon
                              onClick={() => router.push(`/operations/sts-operations/new/view/${op._id}`)}
                              title="View operation"
                            />
                            {canEditForm && (
                              <ActionEditIcon
                                onClick={() => router.push(`/operations/sts-operations/new/edit/${op._id}`)}
                                title="Edit operation"
                              />
                            )}
                            {canDeleteForm && (
                              <ActionDeleteIcon onClick={() => handleDelete(op._id)} title="Delete operation" />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <OperationsListPaginationFooter {...paginationFooterProps} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
