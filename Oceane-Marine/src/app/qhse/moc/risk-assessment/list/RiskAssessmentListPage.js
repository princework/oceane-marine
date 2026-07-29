"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useEffect, useState } from "react";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../../utils/archive";
import { ArchiveIconButton, DeleteIconButton, DownloadIconButton } from "../../../components/ActionIcons";
import { useQhseRole } from "@/hooks/useQhseRole";

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

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Strip date suffix from title (e.g. "MOC Risk Assessment - 2/13/2026" -> "MOC Risk Assessment"). */
function titleWithoutDate(title) {
  if (!title || typeof title !== "string") return "MOC Risk Assessment";
  const trimmed = title.trim();
  const withoutDate = trimmed.replace(/\s*-\s*[\d\/\.\-]+$/, "").trim();
  return withoutDate || "MOC Risk Assessment";
}

export default function RiskAssessmentListPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canDelete, canDownload } = useQhseRole();
  const searchParams = useSearchParams();
  const yearFromUrl = searchParams.get("year");
  const initialYear =
    yearFromUrl != null && yearFromUrl !== "" && !Number.isNaN(Number(yearFromUrl))
      ? Number(yearFromUrl)
      : "";
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(initialYear);
  const [availableYears, setAvailableYears] = useState([]);
  const [archivingId, setArchivingId] = useState(null);

  // Sync year from URL when navigating with ?year=2028
  useEffect(() => {
    const y = searchParams.get("year");
    if (y != null && y !== "" && !Number.isNaN(Number(y))) setYear(Number(y));
  }, [searchParams]);

  // Year range for dropdown: current ± 7 so past and future years (e.g. 2028) are selectable
  const currentYear = new Date().getFullYear();
  const yearRange = [];
  for (let y = currentYear + 7; y >= currentYear - 7; y--) yearRange.push(y);
  const yearOptions = [...new Set([...yearRange, ...availableYears])].sort((a, b) => b - a);

  const fetchUploads = async () => {
    setLoading(true);
    setPageLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (year !== "" && year != null) params.set("year", String(year));
      const url = `/api/qhse/moc/risk-assessment/list${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load uploads");
      }
      setUploads(data.data || []);
      if (data.years && Array.isArray(data.years)) {
        setAvailableYears(data.years);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, [year]);

  useEffect(() => {
    const loadYears = async () => {
      try {
        const res = await fetch("/api/qhse/moc/risk-assessment/list");
        const data = await res.json();
        if (res.ok && data.years && data.years.length > 0) {
          setAvailableYears(data.years);
        } else {
          setAvailableYears([new Date().getFullYear()]);
        }
      } catch {
        setAvailableYears([new Date().getFullYear()]);
      }
    };
    loadYears();
  }, []);

  const handleDownload = async (fileUrl, fileName) => {
    if (!canDownload) return;
    try {
      // Support both Cloudinary URLs (legacy) and local file paths (new)
      const url = fileUrl.startsWith("http")
        ? fileUrl
        : `/api/qhse/file/${fileUrl}`;
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || "download";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err) {
      setError("Failed to download file");
    }
  };

  const handleArchive = async (upload) => {
    if (!confirm("Archive this upload? It will be stored in QHSE Archive (MOC Risk Assessment).")) return;
    setArchivingId(upload._id);
    setError(null);
    try {
      const title = titleWithoutDate(upload.title) || [upload.formCode, upload.serialNumber].filter(Boolean).join(" - ") || "MOC Risk Assessment";
      const payload = buildArchivePayload(ARCHIVE_MODULES.MOC_RISK_ASSESSMENT, upload, title, upload.formCode || "QAF-OFD-058A");
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      setUploads((prev) => prev.filter((u) => u._id !== upload._id));
    } catch (err) {
      setError(err.message);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (uploadId) => {
    if (!canDelete) return;
    if (!confirm("Are you sure you want to delete this upload?")) return;
    try {
      const res = await fetch(`/api/qhse/moc/risk-assessment/${uploadId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete upload");
      setUploads((prev) => prev.filter((u) => u._id !== uploadId));
      alert("Upload deleted successfully!");
    } catch (err) {
      setError(err.message);
    }
  };

  const mocRaListPagination = useOperationsClientPagination(uploads, `${year}|${uploads.length}`);
  const { paginatedItems: paginatedUploads, ...mocRaListPaginationFooterProps } = mocRaListPagination;

  if (loading) return null;

  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/dashboard"
            className="flex-shrink-0 shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / MOC / Risk Assessment
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">My Uploads</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-058A</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
              <select
                value={year === null || year === undefined ? "" : year}
                onChange={(e) => setYear(e.target.value === "" ? "" : Number(e.target.value))}
                className="rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[5rem]"
              >
                <option value="">All years</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <a
              href="/templates/controlled-register/QAF-OFD-058A.docx"
              download
              className="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
              title="Download form template (QAF-OFD-058A)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
              </svg>
              Template (058A)
            </a>
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/moc/risk-assessment/form"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Risk Form
              </Link>
              <span className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 cursor-default">
                Risk List
              </span>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
            {error}
          </div>
        )}

        <main className="space-y-6">
          {uploads.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-white/10 bg-white/5">
              <p className="text-white/60 mb-2">No uploads found</p>
              <p className="text-sm text-slate-400 mb-4">
                {year ? `No uploads for ${year}. Try "All years" or upload new files.` : "Start by uploading your risk assessment files"}
              </p>
              <Link
                href="/qhse/moc/risk-assessment/form"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition"
              >
                Upload Files
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/80">
                        Form Code
                      </th>
                      <th className="hidden px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/80 md:table-cell">
                        Serial
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/80">
                        Title
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/80">
                        Uploaded
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/80">
                        Files
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-white/80">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {paginatedUploads.map((upload) => (
                      <tr key={upload._id} className="hover:bg-white/5 transition">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sky-300">
                          {upload.formCode || "—"}
                        </td>
                        <td className="hidden px-6 py-4 whitespace-nowrap font-mono text-slate-200 md:table-cell">
                          {upload.serialNumber || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-white">
                            {titleWithoutDate(upload.title)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                          {formatDateTime(upload.createdAt || upload.uploadedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {upload.files?.length ?? 0} file{(upload.files?.length ?? 0) !== 1 ? "s" : ""}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right sm:px-6 sm:py-4">
                          <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                            <ArchiveIconButton
                              onClick={() => handleArchive(upload)}
                              disabled={archivingId === upload._id}
                              loading={archivingId === upload._id}
                            />
                            {canDownload && upload.files?.length > 0 && (
                              <>
                                {upload.files.map((file, index) => (
                                  <DownloadIconButton
                                    key={file._id || index}
                                    onClick={() =>
                                      handleDownload(
                                        file.url,
                                        file.name || file.filename || `file-${index + 1}`
                                      )
                                    }
                                    title="Download attached file"
                                  />
                                ))}
                              </>
                            )}
                            {canDelete && (
                            <DeleteIconButton
                              onClick={() => handleDelete(upload._id)}
                              disabled={archivingId === upload._id}
                            />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <OperationsListPaginationFooter {...mocRaListPaginationFooterProps} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
