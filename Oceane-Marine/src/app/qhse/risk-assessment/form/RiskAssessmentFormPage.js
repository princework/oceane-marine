"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../../QhseSidebarContext";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQhseRole } from "@/hooks/useQhseRole";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB — matches dropzone hint

function formatBytes(bytes) {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function RiskAssessmentFormPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = canCreate;
  const router = useRouter();
  const [locations, setLocations] = useState([]);
  const [locationName, setLocationName] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [version, setVersion] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  /**
   * Defensive file-pick handler.
   *
   * The previous implementation called `setFile(e.target.files?.[0] || null)`,
   * which meant any time the change event fired without a file in the picker
   * (cancel pressed, picker re-opened, browser quirk on re-click of the label,
   * etc.) the previously attached document was wiped. We now only overwrite
   * the file when the user actually picks a new one, validate the size, and
   * always reset the input's value so the same filename can be re-picked
   * after a manual remove.
   */
  const handleFilePick = (event) => {
    const picked = event.target.files?.[0];
    // Reset the underlying input so re-picking the same file later still
    // fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!picked) return; // user cancelled — keep the existing file as-is
    if (picked.size > MAX_FILE_BYTES) {
      setError(`File "${picked.name}" exceeds the 25 MB limit.`);
      return;
    }
    setError("");
    setFile(picked);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerFilePicker = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  useEffect(() => {
    fetch("/api/master/locations/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.locations && Array.isArray(data.locations)) {
          setLocations(data.locations);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setMessage("");

    if (!locationName.trim()) {
      setError("Location is required");
      return;
    }
    if (!version.trim()) {
      setError("Version is required");
      return;
    }
    if (!file) {
      setError("Please choose a file");
      return;
    }

    try {
      setLoading(true);
      setPageLoading(true);
      const formData = new FormData();
      formData.append("locationName", locationName.trim());
      formData.append("assessmentDate", assessmentDate || "");
      formData.append("version", version.trim());
      formData.append("file", file);

      const res = await fetch("/api/qhse/risk-assessment/create", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setMessage("Saved successfully");
      setLocationName("");
      setAssessmentDate(new Date().toISOString().slice(0, 10));
      setVersion("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => router.push("/qhse/risk-assessment/list"), 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
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
              QHSE / Risk Assessment
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">New Risk Assessment</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-006</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <a
              href="/templates/controlled-register/QAF-OFD-006.xlsx"
              download
              className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
              title="Download form template (QAF-OFD-006)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
              </svg>
              Template
            </a>
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/risk-assessment/form"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Risk Form
              </Link>
              <Link
                href="/qhse/risk-assessment/list"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Risk List
              </Link>
            </div>
          </div>
        </header>

        {!canSubmit && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm">
            You do not have permission to create records. Form is view-only.
          </div>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-200 text-sm font-medium">
            {message}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6"
        >
          <fieldset disabled={!canSubmit} className="border-0 p-0 m-0 min-w-0 space-y-6 disabled:opacity-[0.88]">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Location</label>
              <select
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white focus:outline-none focus:border-sky-400"
                required
              >
                <option value="">Select location</option>
                {locationName && !locations.some((l) => l.name === locationName) && (
                  <option value={locationName}>{locationName}</option>
                )}
                {locations.map((loc) => (
                  <option key={loc._id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Date / Year</label>
              <input
                type="date"
                value={assessmentDate}
                onChange={(e) => setAssessmentDate(e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white focus:outline-none focus:border-sky-400"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Version</label>
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white focus:outline-none focus:border-sky-400"
                placeholder="e.g., 1 or 1.1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-200">Upload File</label>
            <div className="space-y-3">
              {/* Hidden input — triggered programmatically by the dropzone or
                  the "Replace file" button so the label/click area can't be
                  hit accidentally once a file is already attached. */}
              <input
                id="risk-file"
                ref={fileInputRef}
                type="file"
                onChange={handleFilePick}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              />

              {!file ? (
                // Empty state — show the big dashed dropzone.
                <button
                  type="button"
                  onClick={triggerFilePicker}
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl bg-slate-900/20 hover:bg-slate-900/30 hover:border-sky-400/40 transition group cursor-pointer"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg
                      className="w-10 h-10 mb-3 text-slate-400 group-hover:text-sky-400 transition"
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
                    <p className="mb-2 text-sm text-slate-300">
                      <span className="font-semibold">Click to upload</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      PDF, Excel (.xlsx, .xls), CSV, Word, Images (MAX. 25MB)
                    </p>
                  </div>
                </button>
              ) : (
                // File is already attached — render a compact card with
                // explicit Replace / Remove buttons. The dropzone is hidden
                // so re-clicking it can't accidentally wipe the selection.
                <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold text-emerald-100"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <p className="text-[11px] text-emerald-300/80">
                        {formatBytes(file.size)} · attached, ready to save
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={triggerFilePicker}
                      className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition"
                      title="Pick a different file"
                    >
                      Replace file
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 transition"
                      title="Remove attached file"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="px-4 py-2 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}


