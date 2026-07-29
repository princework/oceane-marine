"use client";

import { useQhseSidebar } from "../../QhseSidebarContext";
import { useState } from "react";
import Link from "next/link";
import { useQhseRole } from "@/hooks/useQhseRole";

export default function KpiCreatePage() {
  const { contentClassName } = useQhseSidebar();
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = canCreate;
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  function getYears() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i < currentYear; i++) years.push(i);
    for (let i = currentYear; i <= currentYear + 5; i++) years.push(i);
    return years;
  }
  const years = getYears();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
        "application/vnd.ms-excel", // .xls
        "text/csv", // .csv
        "application/msword", // .doc
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      ];

      const allowedExtensions = [
        ".pdf",
        ".xlsx",
        ".xls",
        ".csv",
        ".doc",
        ".docx",
      ];
      const fileExtension = selectedFile.name
        .substring(selectedFile.name.lastIndexOf("."))
        .toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
        setError(
          "Invalid file type. Please upload PDF, Excel (.xlsx, .xls), CSV, or Word document."
        );
        setFile(null);
        setFilePreview(null);
        return;
      }

      // Validate file size (25MB)
      if (selectedFile.size > 25 * 1024 * 1024) {
        setError("File size exceeds 25MB limit.");
        setFile(null);
        setFilePreview(null);
        return;
      }

      setFile(selectedFile);
      setFilePreview(selectedFile.name);
      setError(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFilePreview(null);
    // Reset file input
    const fileInput = document.getElementById("file");
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    if (!file) {
      setError("Please select a file to upload.");
      setSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("year", String(year));

      const res = await fetch("/api/qhse/kpi/create", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload file");
      }

      setMessage("File uploaded successfully!");
      setError(null);

      // Reset form
      setFile(null);
      setFilePreview(null);
      const fileInput = document.getElementById("file");
      if (fileInput) {
        fileInput.value = "";
      }

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Something went wrong");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
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
              QHSE / KPI
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">HSE Objectives & Targets</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">HSE-001B</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <div className="flex rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/kpi/target-kpi/form"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Target KPI
              </Link>
              <Link
                href="/qhse/kpi/create"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                KPI
              </Link>
            </div>
            <div className="flex rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/kpi/create"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Form
              </Link>
              <Link
                href="/qhse/kpi/list"
                className="flex-1 min-w-0 text-center px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                List
              </Link>
            </div>
          </div>
        </header>

        <main>
          {!canSubmit && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm mb-4">
              You do not have permission to create records. Form is view-only.
            </div>
          )}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-400/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                Status: <span className="text-amber-300">Draft</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
                <select
                  className="rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[5rem]"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <fieldset disabled={!canSubmit} className="border-0 p-0 m-0 min-w-0 space-y-5 disabled:opacity-[0.88]">
              {/* File Upload */}
              <div>
                <label
                  htmlFor="file"
                  className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5"
                >
                  Upload File <span className="text-red-400">*</span>
                </label>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      id="file"
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                      required
                    />
                    <label
                      htmlFor="file"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl bg-slate-900/20 cursor-pointer hover:bg-slate-900/30 hover:border-sky-400/40 transition group"
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
                          <span className="font-semibold">Click to upload</span>{" "}
                          or drag and drop
                        </p>
                        <p className="text-xs text-slate-400">
                          PDF, Excel (.xlsx, .xls), CSV, Word (MAX. 25MB)
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* File Preview */}
                  {filePreview && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-400/30">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
                          <svg
                            className="w-6 h-6 text-emerald-300"
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
                        <div>
                          <p className="text-sm font-medium text-emerald-200">
                            {filePreview}
                          </p>
                          <p className="text-xs text-emerald-300/70">
                            {formatFileSize(file?.size || 0)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="text-emerald-300 hover:text-emerald-200 transition"
                      >
                        <svg
                          className="w-5 h-5"
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
                  )}
                </div>
              </div>

              {/* Messages */}
              {error && (
                <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                  {error}
                </div>
              )}
              {message && (
                <div className="text-base text-emerald-300 bg-emerald-950/40 border-2 border-emerald-500/60 rounded-lg px-6 py-4 shadow-lg shadow-emerald-500/20">
                  <span className="font-semibold">{message}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setFilePreview(null);
                    const fileInput = document.getElementById("file");
                    if (fileInput) {
                      fileInput.value = "";
                    }
                    setError(null);
                  }}
                  className="rounded-full border border-white/20 bg-transparent px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
                  disabled={submitting}
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center rounded-full bg-orange-500 hover:bg-orange-400 px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] shadow disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? "Uploading..." : "Upload File"}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
