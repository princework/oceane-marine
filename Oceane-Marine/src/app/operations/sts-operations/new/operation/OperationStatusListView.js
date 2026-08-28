"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { getExportColumns, buildExportHeaders, buildExportRow } from "../sts-export-columns";
import {
  ActionViewIcon,
  ActionEditIcon,
  ActionDeleteIcon,
  ActionDownloadIcon,
} from "@/app/components/RecordActionIcons";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import { useOperationsLoading } from "@/app/operations/OperationsLoadingContext";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";

const statusTone = {
  DRAFT: {
    pill: "bg-slate-500/80 border-slate-400/40 text-slate-100",
  },
  INPROGRESS: {
    pill: "bg-sky-500/80 border-sky-400/40 text-sky-100",
  },
  COMPLETED: {
    pill: "bg-emerald-500/80 border-emerald-400/40 text-emerald-100",
  },
  "Lined Up": {
    pill: "bg-amber-500/80 border-amber-400/40 text-amber-100",
  },
  CANCELED: {
    pill: "bg-red-500/80 border-red-400/40 text-red-100",
  },
};

/**
 * Read-mostly table for one fixed `operationStatus` value — the shared shell behind
 * every Operation submodule (Lined Up / In Progress / Completed / Cancelled).
 *
 * @param {{
 *   status: string,           // exact operationStatus value to fetch, e.g. "Lined Up"
 *   title: string,            // page heading
 *   emptyMessage?: string,
 *   extraRowActions?: (operation: object, refetch: () => void) => React.ReactNode,
 * }} props
 */
export default function OperationStatusListView({
  status,
  title,
  emptyMessage = "No operations found.",
  extraRowActions,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const returnTo = encodeURIComponent(pathname);
  const { setPageLoading } = useOperationsLoading();
  const { canEditForm, canDeleteForm } = useOperationsRole();

  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOperations, setFilteredOperations] = useState([]);

  const fetchOperations = async () => {
    try {
      setLoading(true);
      setPageLoading(true);
      const params = new URLSearchParams();
      params.set("status", status);
      const response = await fetch(`/api/operations/sts/list?${params.toString()}`);
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

  useEffect(() => {
    fetchOperations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredOperations(operations);
      return;
    }
    const query = searchQuery.toLowerCase();
    setFilteredOperations(
      operations.filter((op) => {
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
      })
    );
  }, [searchQuery, operations]);

  const pagination = useOperationsClientPagination(filteredOperations, searchQuery);
  const { paginatedItems: paginatedOperations, ...paginationFooterProps } = pagination;

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this operation?")) return;
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
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
          <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-slate-200 font-semibold">
            STS Management System
          </p>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{title}</h1>
        </div>
      </header>

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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-white/60">Loading operations...</p>
        </div>
      ) : filteredOperations.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <p className="text-white/60">
            {searchQuery ? "No operations found matching your search." : emptyMessage}
          </p>
        </div>
      ) : (
        <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full min-w-[760px]">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                    Operation Ref
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                    VSL Name
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                    Barrels
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-[10px] sm:text-xs font-semibold text-white/90 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {paginatedOperations.map((op) => (
                  <tr key={op._id} className="hover:bg-white/5 transition">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className="text-xs sm:text-sm font-mono text-orange-400 font-semibold">
                        {op.Operation_Ref_No || "—"}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className="text-xs sm:text-sm text-white/90">
                        {formatDateTime(op.operationStartTime)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm text-white/90">
                        {op.location?.name || "—"}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm text-white/90">
                        {op.chs || op.ms || "—"}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm text-white/90">{op.client || "—"}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className="text-xs sm:text-sm text-white/90">
                        {calculateBarrels(op.quantity)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                        <ActionViewIcon
                          onClick={() =>
                            router.push(`/operations/sts-operations/new/view/${op._id}?returnTo=${returnTo}`)
                          }
                          title="View operation"
                        />
                        {canEditForm && (
                          <ActionEditIcon
                            onClick={() =>
                              router.push(`/operations/sts-operations/new/edit/${op._id}?returnTo=${returnTo}`)
                            }
                            title="Edit operation"
                          />
                        )}
                        {canDeleteForm && (
                          <ActionDeleteIcon onClick={() => handleDelete(op._id)} title="Delete operation" />
                        )}
                        {extraRowActions?.(op, fetchOperations)}
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
  );
}

export { statusTone };
