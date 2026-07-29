"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useHrLoading } from "../../HrLoadingContext";
import { DownloadIconButton } from "../../../qhse/components/ActionIcons";
import { useHrRole } from "@/hooks/useHrRole";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";

/* ── Shared icon button components (matching QHSE style) ── */
const tooltipClass =
  "pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-slate-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap";
const iconClass = "w-5 h-5";

function ViewIconButton({ onClick, title = "View" }) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className="p-1.5 rounded text-sky-400 hover:text-sky-300 hover:bg-white/10 transition inline-flex"
      >
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
      <span className={tooltipClass}>{title}</span>
    </span>
  );
}

function EditIconButton({ onClick, title = "Edit" }) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className="p-1.5 rounded text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition inline-flex"
      >
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <span className={tooltipClass}>{title}</span>
    </span>
  );
}

function DeleteIconButton({ onClick, disabled, loading }) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title="Delete"
        aria-label="Delete"
        className="p-1.5 rounded text-red-300 hover:text-red-200 hover:bg-red-500/10 disabled:opacity-50 transition inline-flex"
      >
        {loading ? (
          <svg className={`${iconClass} animate-spin`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </button>
      <span className={tooltipClass}>Delete</span>
    </span>
  );
}

/* ── Main list component ── */
export default function CidListPage({ onRefresh }) {
  const router = useRouter();
  const { setPageLoading } = useHrLoading();
  const { canEdit, canDelete, canDownload } = useHrRole();
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);

  // Filters
  const [filterLocation, setFilterLocation] = useState("");
  const [filterTitle, setFilterTitle] = useState("");

  // Unique values for filters
  const locations = [...new Set(records.map((r) => r.location))].sort();
  const titles = [...new Set(records.map((r) => r.title))].sort();

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    let filtered = records;
    if (filterLocation) filtered = filtered.filter((r) => r.location === filterLocation);
    if (filterTitle) filtered = filtered.filter((r) => r.title === filterTitle);
    setFilteredRecords(filtered);
  }, [records, filterLocation, filterTitle]);

  const cidListPagination = useOperationsClientPagination(
    filteredRecords,
    `${filterTitle}|${filterLocation}|${records.length}`
  );
  const { paginatedItems: paginatedListRows, ...cidListPaginationFooterProps } = cidListPagination;

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setPageLoading(true);
      setError("");
      const res = await fetch("/api/hr/cid/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to fetch records");
      setRecords(data.data || []);
      setFilteredRecords(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  const handleView = (record) => setSelectedItem(record);
  const closeModal = () => setSelectedItem(null);

  const handleEdit = (record) => {
    router.push(`/hr/cid?tab=form&edit=${record._id}`);
  };

  const handleDownloadPdf = async (record) => {
    if (!record._id) return;
    setDownloadingPdfId(record._id);
    try {
      const res = await fetch(`/api/hr/cid/${record._id}/download/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CID-${record._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this record? This action cannot be undone.")) return;
    try {
      setDeletingId(id);
      setError("");
      setActionMessage("");
      const res = await fetch(`/api/hr/cid/${id}/delete`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to delete");
      setActionMessage("CID record deleted successfully.");
      setRecords((prev) => prev.filter((r) => r._id !== id));
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-4">
        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Title</span>
            <select
              className="theme-select rounded-full px-3 py-1 text-xs tracking-widest uppercase"
              value={filterTitle}
              onChange={(e) => setFilterTitle(e.target.value)}
            >
              <option value="">All titles</option>
              {titles.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-200 ml-2">Location</span>
            <select
              className="theme-select rounded-full px-3 py-1 text-xs tracking-widest uppercase"
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            {(filterTitle || filterLocation) && (
              <button
                onClick={() => {
                  setFilterTitle("");
                  setFilterLocation("");
                }}
                className="text-xs text-slate-400 hover:text-white transition underline underline-offset-2 ml-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
            {error}
          </div>
        )}
        {actionMessage && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-200 text-sm font-medium">
            {actionMessage}
          </div>
        )}

        {/* Table */}
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60 mb-2">
              {records.length === 0
                ? "No CID records found"
                : "No records match the selected filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-200 border-b border-white/10 bg-white/5">
                      <th className="px-6 py-4 font-semibold w-[25%]">Title</th>
                      <th className="px-6 py-4 font-semibold w-[25%]">Name</th>
                      <th className="px-6 py-4 font-semibold w-[20%]">Location</th>
                      <th className="px-6 py-4 font-semibold w-[15%]">Validity</th>
                      <th className="px-6 py-4 font-semibold text-right w-[15%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedListRows.map((record) => (
                      <tr
                        key={record._id}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="px-6 py-4 font-medium text-white">{record.title}</td>
                        <td className="px-6 py-4 text-slate-200">{record.name}</td>
                        <td className="px-6 py-4 text-slate-200">{record.location}</td>
                        <td className="px-6 py-4 text-slate-200">
                          {record.validity
                            ? new Date(record.validity).toLocaleDateString("en-GB")
                            : "—"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadPdf(record)}
                                disabled={downloadingPdfId === record._id}
                                loading={downloadingPdfId === record._id}
                                title="Download as PDF"
                                className="!text-rose-400 hover:!text-rose-300"
                              />
                            )}
                            <ViewIconButton onClick={() => handleView(record)} />
                            {canEdit && <EditIconButton onClick={() => handleEdit(record)} />}
                            {canDelete && (
                              <DeleteIconButton
                                onClick={() => handleDelete(record._id)}
                                disabled={deletingId === record._id}
                                loading={deletingId === record._id}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <OperationsListPaginationFooter {...cidListPaginationFooterProps} />
            </div>
          )}
      </div>

      {/* View Modal */}
      {selectedItem &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          >
            <div
              className="relative bg-slate-900 rounded-2xl border border-white/20 shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 px-6 py-5 flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-xl font-bold text-white">CID Details</h3>
                <div className="flex items-center gap-2">
                  {canDownload && (
                    <DownloadIconButton
                      onClick={() => handleDownloadPdf(selectedItem)}
                      disabled={downloadingPdfId === selectedItem._id}
                      loading={downloadingPdfId === selectedItem._id}
                      title="Download as PDF"
                      tooltipPlacement="below"
                      className="!text-rose-400 hover:!text-rose-300"
                    />
                  )}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
                  >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-400">
                      Title
                    </label>
                    <p className="text-white font-medium">{selectedItem.title}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-400">
                      Name
                    </label>
                    <p className="text-white font-medium">{selectedItem.name}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-400">
                      Location
                    </label>
                    <p className="text-white font-medium">{selectedItem.location}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-400">
                      Validity
                    </label>
                    <p className="text-white font-medium">
                      {selectedItem.validity
                        ? new Date(selectedItem.validity).toLocaleDateString("en-GB")
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
