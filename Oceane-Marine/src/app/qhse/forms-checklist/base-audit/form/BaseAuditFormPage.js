"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";

export default function BaseAuditFormPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit");
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = editId ? canEdit : canCreate;
  const fileInputRef = useRef(null);
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    year: currentYear,
    description: "",
    uploadedBy: "",
    locationId: "",
  });
  const [file, setFile] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingReport, setExistingReport] = useState(null);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch("/api/master/locations/list");
        const data = await res.json();
        if (res.ok && data.locations) {
          setLocations(data.locations);
        }
      } catch {
        // ignore
      } finally {
        setLoadingLocations(false);
      }
    };
    fetchLocations();
  }, []);

  // Fetch existing report data if editing (single-record GET — avoids relying
  // on the full list response shape / pagination and fixes flaky empty forms).
  useEffect(() => {
    if (!editId) {
      return;
    }
    const fetchReport = async () => {
      setLoading(true);
      setPageLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/qhse/form-checklist/base-audit/${editId}`);
        const responseText = await res.text();
        let payload = null;
        try {
          payload = responseText ? JSON.parse(responseText) : null;
        } catch {
          payload = null;
        }
        if (!res.ok || !payload?.success || !payload.data) {
          throw new Error(
            (payload && (payload.error || payload.message)) ||
              `Failed to load report (HTTP ${res.status}).`
          );
        }
        const report = payload.data;
        setExistingReport(report);
        const yearFromSerial = report.serialNumber
          ? Number(String(report.serialNumber).split("-")[0])
          : currentYear;
        setForm({
          year: Number.isNaN(yearFromSerial) ? currentYear : yearFromSerial,
          description: report.description || "",
          uploadedBy: report.uploadedBy?.name || "",
          locationId: report.location?.locationId
            ? String(report.location.locationId)
            : "",
        });
      } catch (err) {
        setError(err.message || "Failed to load report data");
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    };
    fetchReport();
  }, [editId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    // Reset the input so the same filename can be chosen again after Remove,
    // and so cancelling the picker does not leave the input in a bad state.
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // If the user re-opens the picker and cancels, some browsers still fire
    // onChange with no file — do NOT clear an already-selected attachment.
    if (!selectedFile) {
      return;
    }
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError("File size exceeds 25MB limit");
      return;
    }

    setFile(selectedFile);
    setError("");
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadReportBlob = async (pathSuffix, fileName) => {
    const res = await fetch(pathSuffix);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || "Download failed");
    }
    const blob = await res.blob();
    const url = globalThis.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    globalThis.URL.revokeObjectURL(url);
    a.remove();
  };

  const handleDownloadDocx = async () => {
    if (!editId) return;
    setDownloadingDocx(true);
    setError("");
    try {
      await downloadReportBlob(
        `/api/qhse/form-checklist/base-audit/${editId}/download`,
        `BaseAudit-${existingReport?.serialNumber || editId}.docx`
      );
    } catch (err) {
      setError(err.message || "Failed to download Word document");
    } finally {
      setDownloadingDocx(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!editId) return;
    setDownloadingPdf(true);
    setError("");
    try {
      await downloadReportBlob(
        `/api/qhse/form-checklist/base-audit/${editId}/download-pdf`,
        `BaseAudit-${existingReport?.serialNumber || editId}.pdf`
      );
    } catch (err) {
      setError(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.size > 25 * 1024 * 1024) {
        setError("File size exceeds 25MB limit");
        return;
      }
      setFile(droppedFile);
      setError("");
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    // For new records the file is required; for edits it's optional —
    // a metadata-only update (description / location / uploaded by) is allowed.
    if (!editId && !file) {
      setError("Please select a file to upload");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!form.uploadedBy?.trim()) {
      setError("Please enter your name");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      formData.append("year", String(form.year || currentYear));
      formData.append("description", form.description?.trim() || "");
      formData.append("uploadedBy", form.uploadedBy.trim());
      // Always send locationId (empty string clears it on update).
      formData.append("locationId", form.locationId || "");

      const endpoint = editId
        ? `/api/qhse/form-checklist/base-audit/${editId}/update`
        : `/api/qhse/form-checklist/base-audit/create`;

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const responseText = await res.text();
      let data = null;
      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(
          (data && (data.error || data.message)) ||
            (responseText && responseText.length < 320
              ? responseText
              : `Save failed (HTTP ${res.status}). Please try again.`)
        );
      }

      const versionLabel =
        data.version != null && data.version !== ""
          ? ` Version: ${data.version}`
          : data.data?.version != null
            ? ` Version: ${data.data.version}`
            : "";

      setSuccess(
        editId
          ? `Report updated successfully!${versionLabel}`
          : `File uploaded successfully!${versionLabel}`
      );

      // Only clear the file input — preserve the typed metadata so the user
      // can confirm what was saved (and so re-edits don't surprise them with
      // an empty form).
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Refresh the local copy of the existing report so subsequent edits
      // see the latest version / file path.
      if (editId && data.data) {
        setExistingReport((prev) => ({ ...(prev || {}), ...data.data }));
      }

      // First-time create: move into edit mode for this id so the next save
      // hits the update endpoint instead of creating duplicate records.
      if (!editId && data.data?._id) {
        router.replace(
          `/qhse/forms-checklist/base-audit/form?edit=${data.data._id}`,
          { scroll: false }
        );
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setUploading(false);
    }
  };

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
              QHSE / Forms & Checklist / Base Audit
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              {editId ? "Update Base Audit Report" : "STS Base Audit Report"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-004</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-004" />
            {editId && existingReport && (
              <>
                <button
                  type="button"
                  onClick={() => handleDownloadDocx()}
                  disabled={downloadingDocx || downloadingPdf}
                  className="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition disabled:opacity-50"
                  title="Download report as Word"
                >
                  {downloadingDocx ? (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
                    </svg>
                  )}
                  Word
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf()}
                  disabled={downloadingPdf || downloadingDocx}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-50"
                  title="Download report as PDF"
                >
                  {downloadingPdf ? (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-rose-300 border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
                    </svg>
                  )}
                  PDF
                </button>
              </>
            )}
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/forms-checklist/base-audit/form"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Base Audit Form
              </Link>
              <Link
                href="/qhse/forms-checklist/base-audit/list"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Base Audit List
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-200 text-sm font-medium">
            {success}
          </div>
        )}

        {loading && (
          <div className="bg-blue-950/40 border border-blue-500/40 rounded-xl px-4 py-3 text-blue-200 text-sm font-medium">
            Loading report data...
          </div>
        )}

        {!canSubmit && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm">
            You do not have permission to {editId ? "edit" : "create"} records. Form is view-only.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3">
              Basic Information
            </h2>

            {!editId && (
              <div>
                <label
                  htmlFor="year"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Year <span className="text-red-400">*</span>
                </label>
                <select
                  id="year"
                  name="year"
                  value={form.year}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      year: Number(e.target.value),
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                >
                  {Array.from({ length: 11 }, (_, i) => currentYear - 5 + i).map(
                    (y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    )
                  )}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Serial number will be generated for this year (e.g. {form.year}-001).
                </p>
              </div>
            )}

            {existingReport && (
              <div className="bg-sky-950/40 border border-sky-500/40 rounded-lg px-4 py-3 text-sm space-y-2">
                {existingReport.formCode && (
                  <p className="text-sky-200">
                    <span className="font-semibold">Form Code:</span>{" "}
                    <span className="font-mono">{existingReport.formCode}</span>
                  </p>
                )}
                {existingReport.serialNumber && (
                  <p className="text-sky-200">
                    <span className="font-semibold">Serial:</span>{" "}
                    <span className="font-mono">{existingReport.serialNumber}</span>
                  </p>
                )}
                <p className="text-sky-200">
                  <span className="font-semibold">Current Version:</span> v
                  {existingReport.version}
                </p>
                <p className="text-sky-300/80 text-xs mt-1">
                  Uploading a new file will create version{" "}
                  {(Number.parseFloat(existingReport.version) + 0.1).toFixed(1)}.
                  Leave the file empty to update only the metadata
                  (description, location, uploaded by) on the current version.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="locationId"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Location
                </label>
                <select
                  id="locationId"
                  name="locationId"
                  value={form.locationId}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  disabled={loadingLocations}
                >
                  <option value="">Select location</option>
                  {locations.map((loc) => (
                    <option key={loc._id} value={loc._id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="uploadedBy"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Uploaded By <span className="text-red-400">*</span>
                </label>
                <input
                  id="uploadedBy"
                  type="text"
                  name="uploadedBy"
                  value={form.uploadedBy}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Enter your name"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Enter description (optional)"
                />
              </div>
            </div>
          </section>

          {/* File Upload Section */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3">
              File Upload {editId && (
                <span className="ml-2 text-xs font-normal text-slate-300">
                  (optional — only attach a file to bump the version)
                </span>
              )}
            </h2>

            <div className="space-y-4">
              {!file ? (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-white/20 rounded-xl p-12 text-center hover:border-sky-500/50 transition cursor-pointer bg-white/5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-4">
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
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-slate-400">
                        Maximum file size: 25MB
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="shrink-0">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500/20 border border-sky-500/50">
                          <svg
                            className="h-6 w-6 text-sky-400"
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
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="shrink-0 ml-4 p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
                      aria-label="Remove file"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition"
                  >
                    Change File
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
              />
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-white/10">
            <Link
              href="/qhse/forms-checklist/base-audit/list"
              className="px-6 py-3 rounded-lg border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={
                !canSubmit ||
                uploading ||
                loading ||
                (!editId && !file) ||
                !form.uploadedBy?.trim()
              }
              className="px-6 py-3 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading
                ? editId
                  ? file
                    ? "Creating New Version..."
                    : "Updating..."
                  : "Uploading..."
                : editId
                ? file
                  ? "Create New Version"
                  : "Update Report"
                : "Upload File"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
