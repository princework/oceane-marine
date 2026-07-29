"use client";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQhseRole } from "@/hooks/useQhseRole";

const currentYear = new Date().getFullYear();
const yearOptions = [];
for (let y = currentYear + 5; y >= currentYear - 7; y--) {
  yearOptions.push(y);
}

export default function RiskAssessmentFormPage() {
  const { contentClassName } = useQhseSidebar();
  const router = useRouter();
  const fileInputRef = useRef(null);
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = canCreate;
  const [year, setYear] = useState(currentYear);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // Validate file types and sizes
    const validFiles = selectedFiles.filter((file) => {
      // Check file size (max 10MB per file)
      if (file.size > 10 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 10MB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      // Add unique ID to each file
      const filesWithId = validFiles.map((file) => ({
        file,
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      }));
      setFiles((prev) => [...prev, ...filesWithId]);
      setError("");
    }
  };

  const handleRemoveFile = (id) => {
    setFiles((prev) => prev.filter((fileObj) => fileObj.id !== id));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFiles = Array.from(e.dataTransfer.files);
    
    // Validate file types and sizes
    const validFiles = droppedFiles.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 10MB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      // Add unique ID to each file
      const filesWithId = validFiles.map((file) => ({
        file,
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      }));
      setFiles((prev) => [...prev, ...filesWithId]);
      setError("");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (files.length === 0) {
      setError("Please select at least one file to upload");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("year", String(year));
      files.forEach((fileObj) => {
        formData.append(`files`, fileObj.file);
      });

      const res = await fetch("/api/qhse/moc/risk-assessment/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload files");
      }

      setSuccess("Files uploaded successfully!");
      setFiles([]);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Redirect to list with the selected year so the new upload is visible
      const listUrl = `/qhse/moc/risk-assessment/list?year=${year}`;
      setTimeout(() => {
        router.push(listUrl);
      }, 2000);
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setUploading(false);
    }
  };

  const handleClearAll = () => {
    setFiles([]);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Risk Assessment Upload</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-058A</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[5rem]"
              >
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
              <button
                type="button"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition cursor-default"
              >
                Risk Form
              </button>
              <Link
                href="/qhse/moc/risk-assessment/list"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Risk List
              </Link>
            </div>
          </div>
        </header>

        {!canSubmit && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm">
            You do not have permission to upload risk assessment files.
          </div>
        )}

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

        <div className="space-y-6">
          {/* File Upload Section */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3">
              Upload Files
            </h2>

            {/* Drag and Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="relative border-2 border-dashed border-white/20 rounded-xl p-12 text-center transition-all hover:border-sky-500/50 hover:bg-white/5 cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif"
              />
              <div className="space-y-4">
                <div className="flex justify-center">
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
                </div>
                <div>
                  <p className="text-base font-medium text-white mb-1">
                    Drag and drop files here, or click to select
                  </p>
                  <p className="text-xs text-slate-400">
                    Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, JPG, PNG, GIF
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Maximum file size: 10MB per file
                  </p>
                </div>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Selected Files ({files.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-red-400 hover:text-red-300 font-medium"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {files.map((fileObj) => (
                    <div
                      key={fileObj.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="shrink-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 border border-sky-500/50">
                            <svg
                              className="h-5 w-5 text-sky-400"
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
                            {fileObj.file.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatFileSize(fileObj.file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(fileObj.id)}
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
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Upload Instructions */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3">
              Upload Guidelines
            </h2>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-sky-400 mt-1">•</span>
                <span>
                  Only upload risk assessment related documents and files
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 mt-1">•</span>
                <span>
                  Maximum file size per file: 10MB
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 mt-1">•</span>
                <span>
                  Supported file formats: PDF, Word, Excel, PowerPoint, Text, Images
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 mt-1">•</span>
                <span>
                  You can upload multiple files at once
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 mt-1">•</span>
                <span>
                  Ensure all files are properly named and contain relevant information
                </span>
              </li>
            </ul>
          </section>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={uploading}
              className="px-6 py-3 rounded-lg border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || uploading || files.length === 0}
              className="px-6 py-3 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
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
                  Uploading...
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
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  Upload Files
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


