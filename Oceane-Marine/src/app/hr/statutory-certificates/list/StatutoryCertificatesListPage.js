"use client";

import { useState, useEffect, useRef, useId } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useHrLoading } from "../../HrLoadingContext";
import { DownloadIconButton as QhseDownloadIconButton } from "../../../qhse/components/ActionIcons";
import { useHrRole } from "@/hooks/useHrRole";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";

/* ── Shared icon button components (matching QHSE style) ── */
const tooltipClass =
  "pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-slate-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap";
const iconClass = "w-5 h-5";

function ViewIconButton({ onClick, title = "View", disabled = false }) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        className="p-1.5 rounded text-sky-400 hover:text-sky-300 hover:bg-white/10 disabled:opacity-50 transition inline-flex"
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

function EditIconButton({ onClick, title = "Edit", disabled = false }) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        className="p-1.5 rounded text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 disabled:opacity-50 transition inline-flex"
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

/**
 * Custom listbox for long location labels: native <select> cannot limit open-menu width.
 * Panel is width-bound to the trigger (left-0 right-0); options truncate with full text in title.
 */
function LocationFilterListbox({ value, onChange, locations, buttonClassName }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();

  const options = [{ value: "", label: "All" }, ...locations.map((loc) => ({ value: loc, label: loc }))];
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        id={`${listId}-trigger`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${listId}-list` : undefined}
        title={selected.label}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
      >
        <span className="min-w-0 flex-1 truncate text-left">{selected.label}</span>
        <svg className="h-3 w-3 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          aria-labelledby={`${listId}-trigger`}
          className="absolute left-0 right-0 z-50 mt-1 max-h-48 min-w-0 overflow-x-hidden overflow-y-auto rounded-xl border border-white/25 bg-[#0b2740] py-1 shadow-lg"
        >
          {options.map((opt) => (
            <li key={opt.value || "__all__"} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === opt.value}
                title={opt.label}
                className={`flex w-full min-w-0 cursor-pointer items-center px-2 py-1 text-left text-[9px] uppercase tracking-wide text-slate-100 transition hover:bg-white/10 sm:px-2.5 sm:py-1.5 sm:text-xs ${
                  value === opt.value ? "bg-sky-600/30 text-white" : ""
                }`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 truncate">{opt.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Main list component ── */
export default function StatutoryCertificatesListPage({ onRefresh }) {
  const router = useRouter();
  const { setPageLoading } = useHrLoading();
  const { canEdit, canDelete, canDownload } = useHrRole();
  const [certificates, setCertificates] = useState([]);
  const [filteredCertificates, setFilteredCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);

  // Filters
  const [filterYear, setFilterYear] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  // Unique values for filters
  const years = [...new Set(certificates.map((c) => c.year))].sort((a, b) => String(b).localeCompare(String(a)));
  const locations = [...new Set(certificates.map((c) => c.location))].sort();

  useEffect(() => {
    fetchCertificates();
  }, []);

  useEffect(() => {
    let filtered = certificates;
    if (filterYear) filtered = filtered.filter((c) => c.year === filterYear);
    if (filterLocation) filtered = filtered.filter((c) => c.location === filterLocation);
    setFilteredCertificates(filtered);
  }, [certificates, filterYear, filterLocation]);

  const statutoryListPagination = useOperationsClientPagination(
    filteredCertificates,
    `${filterYear}|${filterLocation}|${certificates.length}`
  );
  const { paginatedItems: paginatedCertificates, ...statutoryListPaginationFooterProps } =
    statutoryListPagination;

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      setPageLoading(true);
      setError("");
      const res = await fetch("/api/hr/statutory-certificates/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to fetch certificates");
      setCertificates(data.data || []);
      setFilteredCertificates(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  const handleView = (cert) => setSelectedItem(cert);
  const closeModal = () => setSelectedItem(null);

  const handleEdit = (cert) => {
    router.push(`/hr/statutory-certificates?tab=form&edit=${cert._id}`);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this certificate? This action cannot be undone.")) return;
    try {
      setDeletingId(id);
      setError("");
      setActionMessage("");
      const res = await fetch(`/api/hr/statutory-certificates/${id}/delete`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to delete");
      setActionMessage("Certificate deleted successfully.");
      setCertificates((prev) => prev.filter((c) => c._id !== id));
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadPdf = async (cert) => {
    if (!cert._id) return;
    setDownloadingPdfId(cert._id);
    setError("");
    try {
      const res = await fetch(`/api/hr/statutory-certificates/${cert._id}/download/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Statutory-Certificate-${cert.year || "cert"}-${cert._id}.pdf`;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-w-0 max-w-full rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-6 backdrop-blur shadow-2xl space-y-4">
        {/*
          Filters: <lg = stacked full-width rows (avoids Location overflow on narrow viewports).
          lg+ = single row, compact selects (matches HR Oil Majors list pattern).
        */}
        <div className="flex w-full min-w-0 flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-row lg:w-auto lg:flex-none lg:items-center lg:justify-end lg:gap-4">
            <div className="flex min-w-0 w-full items-center gap-1.5 sm:gap-2 lg:w-36 lg:max-w-36 lg:flex-none">
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-300 sm:text-[10px]">
                Year
              </span>
              <select
                className="theme-select min-w-0 w-full max-w-full rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide sm:px-2 sm:py-1 sm:text-xs lg:min-w-0 lg:max-w-34"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="">All</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 w-full items-center gap-1.5 sm:gap-2 lg:w-36 lg:max-w-36 lg:flex-none">
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-300 sm:text-[10px]">
                <span className="lg:hidden">Loc</span>
                <span className="hidden lg:inline">Location</span>
              </span>
              <LocationFilterListbox
                value={filterLocation}
                onChange={setFilterLocation}
                locations={locations}
                buttonClassName="flex min-h-[1.75rem] min-w-0 w-full max-w-full flex-1 items-center justify-between gap-1 rounded-full border border-white/25 bg-[#0b2740] px-2 py-0.5 text-left text-[10px] font-normal uppercase tracking-wide text-slate-200 shadow-none outline-none ring-0 transition hover:border-white/35 focus:border-orange-400 focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-orange-500/50 sm:min-h-[2rem] sm:px-2.5 sm:py-1 sm:text-xs lg:min-w-0 lg:max-w-34"
              />
            </div>
          </div>
          {(filterYear || filterLocation) && (
            <button
              type="button"
              onClick={() => { setFilterYear(""); setFilterLocation(""); }}
              className="shrink-0 self-start text-[10px] text-slate-400 underline underline-offset-2 transition hover:text-white sm:text-xs lg:self-center"
            >
              Clear
            </button>
          )}
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
        {filteredCertificates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60 mb-2">
              {certificates.length === 0 ? "No certificates found" : "No certificates match the selected filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-slate-200 border-b border-white/10 bg-white/5">
                      <th className="px-3 py-3 font-semibold sm:px-6 sm:py-4">Location</th>
                      <th className="px-3 py-3 font-semibold sm:px-6 sm:py-4">Type of Document</th>
                      <th className="px-3 py-3 font-semibold sm:px-6 sm:py-4">Year</th>
                      <th className="px-3 py-3 font-semibold sm:px-6 sm:py-4">Validity</th>
                      <th className="px-3 py-3 font-semibold text-right sm:px-6 sm:py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCertificates.map((cert) => (
                      <tr key={cert._id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="px-3 py-3 font-medium text-white sm:px-6 sm:py-4">{cert.location}</td>
                        <td className="px-3 py-3 text-slate-200 sm:px-6 sm:py-4">{cert.typeOfDocs}</td>
                        <td className="px-3 py-3 font-mono text-sky-300 sm:px-6 sm:py-4">{cert.year}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-200 sm:px-6 sm:py-4">
                          {cert.validity ? new Date(cert.validity).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="px-3 py-3 text-right sm:px-6 sm:py-4">
                          <div className="flex items-center justify-end gap-1">
                            {canDownload && (
                              <QhseDownloadIconButton
                                onClick={() => handleDownloadPdf(cert)}
                                disabled={
                                  downloadingPdfId === cert._id || deletingId === cert._id
                                }
                                loading={downloadingPdfId === cert._id}
                                title="Download as PDF"
                                className="!text-rose-400 hover:!text-rose-300"
                              />
                            )}
                            <ViewIconButton
                              onClick={() => handleView(cert)}
                              disabled={downloadingPdfId === cert._id}
                            />
                            {canEdit && (
                              <EditIconButton
                                onClick={() => handleEdit(cert)}
                                disabled={downloadingPdfId === cert._id}
                              />
                            )}
                            {canDelete && (
                              <DeleteIconButton
                                onClick={() => handleDelete(cert._id)}
                                disabled={
                                  deletingId === cert._id || downloadingPdfId === cert._id
                                }
                                loading={deletingId === cert._id}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <OperationsListPaginationFooter {...statutoryListPaginationFooterProps} />
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
                <h3 className="text-xl font-bold text-white">Certificate Details</h3>
                <div className="flex items-center gap-2">
                  {canDownload && (
                    <QhseDownloadIconButton
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
                    <label className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-400">Location</label>
                    <p className="text-white font-medium">{selectedItem.location}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-400">Type of Document</label>
                    <p className="text-white font-medium">{selectedItem.typeOfDocs}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-400">Year</label>
                    <p className="text-sky-300 font-mono font-semibold">{selectedItem.year}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-400">Validity</label>
                    <p className="text-white font-medium">
                      {selectedItem.validity ? new Date(selectedItem.validity).toLocaleDateString("en-GB") : "—"}
                    </p>
                  </div>
                </div>

                {selectedItem.attachment?.fileUrl && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <label className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-400">Attachment</label>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                      <svg className="w-8 h-8 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {selectedItem.attachment.originalFileName || "File"}
                        </p>
                      </div>
                      {canDownload ? (
                        <a
                          href={selectedItem.attachment.fileUrl}
                          download={selectedItem.attachment.originalFileName || "certificate"}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 hover:bg-sky-500/20 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-white/40">Download restricted</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
