"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import { ActionDeleteIcon } from "@/app/components/RecordActionIcons";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";

export default function ClientsAgentsMasterPage() {
  const [masterTab, setMasterTab] = useState("client");

  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [clientName, setClientName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const [expandedModules, setExpandedModules] = useState(new Set());
  const sidebarRef = useRef(null);
  const pathname = usePathname();
  const { canManageMasterData, isOpsAdmin } = useOperationsRole();

  const clientPag = useOperationsClientPagination(clients, "sts-clients-master");
  const { paginatedItems: clientPageItems, ...clientFooterProps } = clientPag;
  const agentPag = useOperationsClientPagination(agents, "sts-agents-master");
  const { paginatedItems: agentPageItems, ...agentFooterProps } = agentPag;

  const loadClients = async () => {
    const res = await fetch("/api/master/sts-clients/list");
    const data = await res.json();
    setClients(data?.clients || []);
  };

  const loadAgents = async () => {
    const res = await fetch("/api/master/sts-agents/list");
    const data = await res.json();
    setAgents(data?.agents || []);
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      await Promise.all([loadClients(), loadAgents()]);
    } catch {
      setError("Failed to load master data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManageMasterData) loadAll();
  }, [canManageMasterData]);

  if (!canManageMasterData) {
    return (
      <div className="min-h-screen bg-transparent text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl">&#128274;</div>
          <h2 className="text-xl font-bold">Access Restricted</h2>
          <p className="text-white/60">Only administrators can access master data management.</p>
          <a
            href="/operations/sts-operations/new"
            className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition"
          >
            Go to Documentation
          </a>
        </div>
      </div>
    );
  }

  const sidebarTabs = getSidebarTabs(isOpsAdmin);

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!clientName.trim()) return;
    try {
      setLoading(true);
      const res = await fetch("/api/master/sts-clients/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clientName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      setClientName("");
      await loadClients();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!agentName.trim()) return;
    try {
      setLoading(true);
      const res = await fetch("/api/master/sts-agents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      setAgentName("");
      await loadAgents();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (id) => {
    if (!confirm("Delete this client name?")) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/master/sts-clients/${id}/delete`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      await loadClients();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAgent = async (id) => {
    if (!confirm("Delete this agent name?")) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/master/sts-agents/${id}/delete`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      await loadAgents();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

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
    })?.key || "clientsAgents";

  const renderSidebar = () => (
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
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition hover:scale-110"
            aria-label="Close sidebar"
          >
            <span className="text-white text-lg">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 [scrollbar-width:thin]">
          <div className="space-y-1.5">
            {sidebarTabs.map((tab) => (
              <div key={tab.key} className="space-y-1">
                {tab.submodules ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedModules((prev) => {
                          const newSet = new Set(prev);
                          if (newSet.has(tab.key)) newSet.delete(tab.key);
                          else newSet.add(tab.key);
                          return newSet;
                        });
                      }}
                      className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                        activeTab === tab.key
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-[1.02]"
                          : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5"
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
                          const isActiveSub = isFormsSubmoduleSidebarActive(pathname, submodule.href);
                          return (
                            <Link
                              key={submodule.key}
                              href={submodule.href}
                              className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                                isActiveSub
                                  ? "bg-white/20 text-white border-orange-400/50"
                                  : "text-white/80 hover:bg-white/10 border-white/5"
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
                        : "text-white/90 hover:bg-white/10 border border-white/5"
                    }`}
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
  );

  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {renderSidebar()}
      {!isSidebarOpen && (
        <div className="fixed left-4 top-4 z-40 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 border border-orange-400/30 shadow-lg sm:h-10 sm:w-10"
            aria-label="Open sidebar"
          >
            <span className="text-white text-xl">☰</span>
          </button>
          <Link
            href="/dashboard"
            className="md:hidden inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-white"
          >
            ← Dashboard
          </Link>
          <Link
            href="/operations/sts-operations/new"
            className="md:hidden inline-flex max-w-[11rem] truncate rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-[10px] font-semibold text-white/90"
          >
            ← STS form
          </Link>
        </div>
      )}
      <div
        className={`flex-1 min-w-0 pr-4 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}
      >
        <div
          className={`w-full mx-auto py-6 sm:py-10 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`}
        >
          <header
            className={`${isSidebarOpen ? "mt-0" : "mt-8"} mb-4 flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between`}
          >
            <Link
              href="/dashboard"
              className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-sm font-semibold"
            >
              ← Dashboard
            </Link>
            <div className="flex w-full flex-col items-center text-center sm:flex-1">
              <p className="text-sm uppercase tracking-[0.25em] text-sky-300">Master Data</p>
              <h1 className="text-xl sm:text-2xl font-bold">Clients &amp; agents</h1>
              <p className="text-xs text-white/50 mt-1 max-w-md">
                Names appear in STS Documentation (create / edit) as Client and Agent dropdowns.
              </p>
            </div>
            <Link
              href="/operations/sts-operations/new"
              className="hidden md:inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 border border-white/10 hover:bg-white/20"
            >
              Back to STS form
            </Link>
          </header>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMasterTab("client");
                setError("");
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                masterTab === "client"
                  ? "bg-orange-500 text-white"
                  : "bg-white/10 text-white/80 hover:bg-white/15"
              }`}
            >
              Clients
            </button>
            <button
              type="button"
              onClick={() => {
                setMasterTab("agent");
                setError("");
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                masterTab === "agent"
                  ? "bg-orange-500 text-white"
                  : "bg-white/10 text-white/80 hover:bg-white/15"
              }`}
            >
              Agents
            </button>
          </div>

          <div className="max-w-5xl mx-auto w-full space-y-4 sm:space-y-6">
            {error && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            {masterTab === "client" && (
              <>
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl shadow-2xl">
                  <h2 className="text-xl font-bold text-white mb-4 text-center sm:text-left">
                    Add client
                  </h2>
                  <form
                    onSubmit={handleClientSubmit}
                    className="flex flex-col sm:flex-row gap-3 max-w-3xl mx-auto sm:max-w-none sm:mx-0"
                  >
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Client name"
                      className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-40"
                    >
                      {loading ? "…" : "Add"}
                    </button>
                  </form>
                </div>
                <div className="flex flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] shadow-2xl">
                  <div className="rounded-t-2xl px-6 py-4 border-b border-white/10 flex justify-between items-center gap-4">
                    <h2 className="text-lg font-bold">Client list</h2>
                    <span className="text-sm text-white/60 shrink-0">{clients.length} items</span>
                  </div>
                  <div className="min-w-0 overflow-x-auto overflow-hidden">
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5 text-xs uppercase text-white/70">
                          <th className="w-1/3 px-4 py-3 text-center font-semibold">#</th>
                          <th className="w-1/3 px-4 py-3 text-center font-semibold">Name</th>
                          <th className="w-1/3 px-4 py-3 text-center font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {clientPageItems.map((row, idx) => (
                          <tr key={row._id} className="hover:bg-white/5">
                            <td className="w-1/3 px-4 py-3 text-center text-white/90">
                              {(clientPag.page - 1) * clientPag.pageSize + idx + 1}
                            </td>
                            <td className="w-1/3 px-4 py-3 text-center font-medium break-words">
                              {row.name}
                            </td>
                            <td className="w-1/3 px-4 py-3">
                              <div className="flex justify-center">
                                <ActionDeleteIcon
                                  onClick={() => handleDeleteClient(row._id)}
                                  disabled={actionLoading}
                                  title="Delete"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!clients.length && (
                          <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-white/50 text-sm">
                              No clients yet. Add one above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <OperationsListPaginationFooter
                    {...clientFooterProps}
                    className="rounded-b-2xl overflow-visible"
                  />
                </div>
              </>
            )}

            {masterTab === "agent" && (
              <>
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl shadow-2xl">
                  <h2 className="text-xl font-bold text-white mb-4 text-center sm:text-left">
                    Add agent
                  </h2>
                  <form
                    onSubmit={handleAgentSubmit}
                    className="flex flex-col sm:flex-row gap-3 max-w-3xl mx-auto sm:max-w-none sm:mx-0"
                  >
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Agent name"
                      className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-40"
                    >
                      {loading ? "…" : "Add"}
                    </button>
                  </form>
                </div>
                <div className="flex flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] shadow-2xl">
                  <div className="rounded-t-2xl px-6 py-4 border-b border-white/10 flex justify-between items-center gap-4">
                    <h2 className="text-lg font-bold">Agent list</h2>
                    <span className="text-sm text-white/60 shrink-0">{agents.length} items</span>
                  </div>
                  <div className="min-w-0 overflow-x-auto overflow-hidden">
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5 text-xs uppercase text-white/70">
                          <th className="w-1/3 px-4 py-3 text-center font-semibold">#</th>
                          <th className="w-1/3 px-4 py-3 text-center font-semibold">Name</th>
                          <th className="w-1/3 px-4 py-3 text-center font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {agentPageItems.map((row, idx) => (
                          <tr key={row._id} className="hover:bg-white/5">
                            <td className="w-1/3 px-4 py-3 text-center text-white/90">
                              {(agentPag.page - 1) * agentPag.pageSize + idx + 1}
                            </td>
                            <td className="w-1/3 px-4 py-3 text-center font-medium break-words">
                              {row.name}
                            </td>
                            <td className="w-1/3 px-4 py-3">
                              <div className="flex justify-center">
                                <ActionDeleteIcon
                                  onClick={() => handleDeleteAgent(row._id)}
                                  disabled={actionLoading}
                                  title="Delete"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!agents.length && (
                          <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-white/50 text-sm">
                              No agents yet. Add one above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <OperationsListPaginationFooter
                    {...agentFooterProps}
                    className="rounded-b-2xl overflow-visible"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
