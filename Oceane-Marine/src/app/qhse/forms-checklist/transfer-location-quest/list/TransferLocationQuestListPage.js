"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../../utils/archive";
import { ArchiveIconButton, DeleteIconButton, DownloadIconButton, EditIconButton } from "../../../components/ActionIcons";
import { QhseListPageContainer } from "../../../components/QhseListPageContainer";
import { useEffect, useMemo, useState } from "react";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import Link from "next/link";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";
import { useQhseRole } from "@/hooks/useQhseRole";
import { useRouter } from "next/navigation";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Generate dynamic years
function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i < currentYear; i++) years.push(i);
  for (let i = currentYear; i <= currentYear + 5; i++) years.push(i);
  return years;
}

export default function TransferLocationQuestListPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const router = useRouter();
  const { canCreate, canEdit, canDelete, canApprove, canDownload } = useQhseRole();
  const currentYear = new Date().getFullYear();
  const initialYears = getYears();
  
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [availableYears, setAvailableYears] = useState(initialYears);
  const [loadingYears, setLoadingYears] = useState(true);
  const [year, setYear] = useState("");
  const [locations, setLocations] = useState([]);
  const [locationName, setLocationName] = useState("");
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch("/api/master/locations/list");
        const data = await res.json();
        if (res.ok && data.locations) {
          setLocations(data.locations);
        }
      } finally {
        setLoadingLocations(false);
      }
    };
    fetchLocations();
  }, []);

  // Fetch available years
  useEffect(() => {
    const loadYears = async () => {
      setLoadingYears(true);
      try {
        const res = await fetch("/api/qhse/form-checklist/transfer-location-quest/list");
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.years)) {
          const merged = Array.from(
            new Set([...initialYears, ...data.years])
          ).sort((a, b) => b - a);
          setAvailableYears(merged);
        }
      } finally {
        setLoadingYears(false);
      }
    };
    loadYears();
  }, []);

  const fetchForms = async () => {
    setLoading(true);
    setPageLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (year !== "" && year != null) params.set("year", year);
      if (locationName) params.set("location", locationName);
      const url = params.toString()
        ? `/api/qhse/form-checklist/transfer-location-quest/list?${params}`
        : "/api/qhse/form-checklist/transfer-location-quest/list";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load forms");
      }
      setForms(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, [year, locationName]);

  const handleDownloadDocx = async (form) => {
    if (!canDownload) return;
    setDownloading(form._id);
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/transfer-location-quest/${form._id}/download`
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to download document");
      }

      // Get blob and create download
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TransferLocationQuest-${form.serialNumber || form._id}.docx`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download document");
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadPdf = async (form) => {
    if (!canDownload) return;
    setDownloadingPdf(form._id);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/transfer-location-quest/${form._id}/download/pdf`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download PDF");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TransferLocationQuest-${form.serialNumber || form._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleDownloadFile = async (form) => {
    if (!canDownload) return;
    setDownloadingFile(form._id);
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/transfer-location-quest/${form._id}/download-file`
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to download file");
      }

      // Get blob and create download
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const contentDisposition = res.headers.get("Content-Disposition");
      let fileName = `TransferLocationQuest-file-${form._id}.docx`;
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^";]+)/i) || contentDisposition.match(/filename="?([^"]+)"?/i);
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = fileNameMatch[1].trim().replace(/"$/g, "");
        }
      }
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download file");
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleEdit = (form) => {
    if (!canEdit) return;
    router.push(
      `/qhse/forms-checklist/transfer-location-quest/form?edit=${form._id}`
    );
  };

  const handleArchive = async (form) => {
    if (!confirm("Archive this record? It will be stored in QHSE Archive (Transfer Location Questionnaire).")) return;
    setArchivingId(form._id);
    setError(null);
    try {
      const payload = buildArchivePayload(ARCHIVE_MODULES.TRANSFER_LOCATION_QUEST, form, form.formCode || form.serialNumber, form.formCode);
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setForms((prev) => prev.filter((f) => f._id !== form._id));
    } catch (err) {
      setError(err.message || "Failed to archive");
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (form) => {
    if (!canDelete) return;
    if (!confirm("Are you sure you want to delete this record? This cannot be undone.")) return;
    setDeleting(form._id);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/form-checklist/transfer-location-quest/${form._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setForms((prev) => prev.filter((f) => f._id !== form._id));
    } catch (err) {
      setError(err.message || "Failed to delete record");
    } finally {
      setDeleting(null);
    }
  };

  const filteredTransferQuestItems = useMemo(() => {
    if (!searchTerm.trim()) return forms;
    const s = searchTerm.toLowerCase();
    return forms.filter(
      (f) =>
        (f.serialNumber || "").toLowerCase().includes(s) ||
        (f.locationName || "").toLowerCase().includes(s) ||
        (f.formCode || "").toLowerCase().includes(s)
    );
  }, [forms, searchTerm]);

  const transferQuestListPagination = useOperationsClientPagination(
    filteredTransferQuestItems,
    `${searchTerm}|${year}|${locationName}|${forms.length}`
  );
  const { paginatedItems: paginatedTransferQuestRows, ...transferQuestListPaginationFooterProps } =
    transferQuestListPagination;

  if (loading) return null;

  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/dashboard"
            className="flex-shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / Forms & Checklist / Transfer Location Questionnaire
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Transfer Location Questionnaires</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-049</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-049" />
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/forms-checklist/transfer-location-quest/form"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                TLQ Form
              </Link>
              <Link
                href="/qhse/forms-checklist/transfer-location-quest/list"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                TLQ List
              </Link>
            </div>
          </div>
        </header>

        <main>
          <QhseListPageContainer
            searchPlaceholder="Search by Serial, Location..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterChildren={
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
                  <select
                    className="theme-select rounded-full px-3 py-1 text-xs tracking-widest uppercase"
                    value={year === null || year === undefined ? "" : year}
                    onChange={(e) => {
                      const v = e.target.value;
                      setYear(v === "" ? "" : Number(v));
                    }}
                    disabled={loadingYears}
                  >
                    <option value="">All years</option>
                    {loadingYears ? (
                      <option disabled>Loading…</option>
                    ) : (
                      availableYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))
                    )}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Location</span>
                  <select
                    className="theme-select rounded-full px-3 py-1 text-xs tracking-widest uppercase"
                    value={locationName || ""}
                    onChange={(e) => setLocationName(e.target.value)}
                    disabled={loadingLocations}
                  >
                    <option value="">All</option>
                    {locations.map((loc) => (
                      <option key={loc._id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            }
          >
            {error && (
              <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            {forms.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-white/10 bg-white/5">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/20 border border-sky-500/50">
                  <svg
                    className="h-8 w-8 text-sky-400"
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
                </div>
              </div>
              <p className="text-white/60 mb-2">
                {year ? `No questionnaires found for ${year}` : "No questionnaires found"}
              </p>
              <p className="text-sm text-slate-400 mb-4">
                {year
                  ? "Try selecting a different year or upload a new questionnaire"
                  : "Start by uploading your first transfer location questionnaire"}
              </p>
              <Link
                href="/qhse/forms-checklist/transfer-location-quest/form"
                className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Upload Questionnaire
              </Link>
            </div>
          ) : filteredTransferQuestItems.length === 0 ? (
              <div className="text-center py-12 rounded-2xl border border-white/10 bg-white/5">
                <p className="text-white/60">No questionnaires matching search.</p>
              </div>
            ) : (
            <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-200 border-b border-white/10 bg-white/5">
                      <th className="px-6 py-4 font-semibold">Form Code</th>
                      <th className="hidden px-6 py-4 font-semibold md:table-cell">Serial</th>
                      <th className="px-6 py-4 font-semibold">
                        Location Name
                      </th>
                      <th className="hidden px-6 py-4 font-semibold md:table-cell">Version</th>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Uploaded By</th>
                      <th className="px-6 py-4 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransferQuestRows.map((form) => (
                      <tr
                        key={form._id}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sky-300">
                            {form.formCode || "—"}
                          </span>
                        </td>
                        <td className="hidden px-6 py-4 md:table-cell">
                          <span className="font-mono text-slate-200">
                            {form.serialNumber || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-200">
                            {form.locationName || "—"}
                          </span>
                        </td>
                        <td className="hidden px-6 py-4 md:table-cell">
                          <span className="font-mono text-sky-300">
                            v{form.version || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">{formatDate(form.date)}</td>
                        <td className="px-6 py-4">
                          <span className="text-slate-200">
                            {form.uploadedBy?.name || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right sm:px-6 sm:py-4">
                          <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                            {canDownload && (
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(form)}
                                disabled={downloadingFile === form._id}
                                className="px-2 py-1 rounded border border-purple-400/30 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-purple-200 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                title="Download attached file"
                              >
                                {downloadingFile === form._id ? (
                                  <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                  </svg>
                                )}
                              </button>
                            )}
                            {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadDocx(form)}
                                disabled={
                                  downloading === form._id || downloadingPdf === form._id
                                }
                                loading={downloading === form._id}
                                title="Download as Word"
                              />
                            )}
                            {canDownload && (
                              <DownloadIconButton
                                onClick={() => handleDownloadPdf(form)}
                                disabled={
                                  downloadingPdf === form._id || downloading === form._id
                                }
                                loading={downloadingPdf === form._id}
                                title="Download as PDF"
                                className="!text-rose-400 hover:!text-rose-300"
                              />
                            )}
                            <ArchiveIconButton
                              onClick={() => handleArchive(form)}
                              disabled={archivingId === form._id || deleting === form._id}
                              loading={archivingId === form._id}
                            />
                            {canEdit && (
                              <EditIconButton onClick={() => handleEdit(form)} />
                            )}
                            {canDelete && (
                              <DeleteIconButton
                                onClick={() => handleDelete(form)}
                                disabled={archivingId === form._id || deleting === form._id}
                                loading={deleting === form._id}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <OperationsListPaginationFooter {...transferQuestListPaginationFooterProps} />
              </div>
            )}
          </QhseListPageContainer>
        </main>
      </div>
    </div>
  );
}


