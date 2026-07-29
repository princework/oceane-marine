"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import QhseSidebar from "../../../components/QhseSidebar";

export default function TransferLocationQuestFormPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit");
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = editId ? canEdit : canCreate;
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    locationName: "",
    uploadedBy: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingRecord, setExistingRecord] = useState(null);

  // Fetch existing record data if editing
  useEffect(() => {
    if (editId) {
      const fetchRecord = async () => {
        setLoading(true);
        setPageLoading(true);
        try {
          const res = await fetch(
            `/api/qhse/form-checklist/transfer-location-quest/list`
          );
          const data = await res.json();
          if (res.ok && data.data) {
            const record = data.data.find((r) => String(r._id) === String(editId));
            if (record) {
              setExistingRecord(record);
              setForm({
                locationName: record.locationName || "",
                uploadedBy: record.uploadedBy?.name || "",
                date: record.date
                  ? new Date(record.date).toISOString().split("T")[0]
                  : new Date().toISOString().split("T")[0],
              });
            } else {
              setError("Record not found");
            }
          } else {
            setError("Failed to load record data");
          }
        } catch (err) {
          setError(err.message || "Failed to load record data");
        } finally {
          setLoading(false);
          setPageLoading(false);
        }
      };
      fetchRecord();
    }
  }, [editId]);

  // Auto-scroll to top on error/success
  useEffect(() => {
    if (error || success) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [error, success]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith(".docx")) {
        setError("Only Word (.docx) files are allowed");
        return;
      }

      // Validate file size (max 25MB)
      if (selectedFile.size > 25 * 1024 * 1024) {
        setError("File size exceeds 25MB limit");
        return;
      }

      setFile(selectedFile);
      setError("");
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
      if (!droppedFile.name.endsWith(".docx")) {
        setError("Only Word (.docx) files are allowed");
        return;
      }

      if (droppedFile.size > 25 * 1024 * 1024) {
        setError("File size exceeds 25MB limit");
        return;
      }

      setFile(droppedFile);
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setSuccess("");

    // Validation
    if (!file) {
      setError("Please select a file to upload");
      return;
    }

    if (!form.locationName.trim()) {
      setError("Location Name is required");
      return;
    }

    if (!form.uploadedBy.trim()) {
      setError("Uploaded By is required");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("locationName", form.locationName.trim());
      formData.append("uploadedByName", form.uploadedBy.trim());
      formData.append("uploadedByUserId", ""); // Can be updated if user auth is available
      formData.append("date", form.date || new Date().toISOString().split("T")[0]); // Drives list year filter and serialNumber

      const apiUrl = editId
        ? `/api/qhse/form-checklist/transfer-location-quest/${editId}/update`
        : `/api/qhse/form-checklist/transfer-location-quest/create`;

      const res = await fetch(apiUrl, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload file");
      }

      setSuccess(
        editId
          ? `File updated successfully! New version created: ${
              data.data?.version || ""
            }`
          : `File uploaded successfully! Version: ${data.data?.version || ""}`
      );

      // Reset form
      setForm({
        locationName: "",
        uploadedBy: "",
        date: new Date().toISOString().split("T")[0],
      });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/qhse/forms-checklist/transfer-location-quest/list");
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-transparent text-white flex">
        <QhseSidebar />

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
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                {editId ? "Update Questionnaire" : "Upload Questionnaire"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 mt-1">
                Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-049</span>
              </p>
            </div>
            <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
              <a
                href="/templates/controlled-register/QAF-OFD-049.docx"
                download
                className="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
                title="Download form template (QAF-OFD-049)"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
                </svg>
                Template
              </a>
              <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                <Link
                  href="/qhse/forms-checklist/transfer-location-quest/form"
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
                >
                  TLQ Form
                </Link>
                <Link
                  href="/qhse/forms-checklist/transfer-location-quest/list"
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
                >
                  TLQ List
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
            <div className="bg-green-950/40 border border-green-500/40 rounded-xl px-4 py-3 text-green-200 text-sm font-medium">
              {success}
            </div>
          )}

          {!canSubmit && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm">
              You do not have permission to {editId ? "edit" : "create"} records. Form is view-only.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-6">
              <h2 className="text-lg font-semibold text-white/90 border-b border-white/10 pb-3">
                Basic Information
              </h2>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="locationName"
                    className="block text-sm font-medium text-white/90 mb-2"
                  >
                    Location Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="locationName"
                    type="text"
                    name="locationName"
                    value={form.locationName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Enter location name"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="date"
                    className="block text-sm font-medium text-white/90 mb-2"
                  >
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="date"
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    required
                  />
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
              </div>
            </section>

            {/* File Upload Section */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-6">
              <h2 className="text-lg font-semibold text-white/90 border-b border-white/10 pb-3">
                File Upload
              </h2>

              {file === null ? (
                <button
                  type="button"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="w-full border-2 border-dashed border-white/20 rounded-xl p-12 text-center hover:border-sky-500/50 transition cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
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
                      <p className="text-white/90 font-medium mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-sm text-white/60">
                        Word document (.docx) only, max 25MB
                      </p>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
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
                      <div>
                        <p className="text-white/90 font-medium text-sm">
                          {file.name}
                        </p>
                        <p className="text-xs text-white/60">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-300 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {existingRecord && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-white/60 mb-2">
                    Current Version:{" "}
                    <span className="text-sky-300 font-mono">
                      v{existingRecord.version}
                    </span>
                  </p>
                  <p className="text-xs text-white/40">
                    Updating will create a new version (e.g., v
                    {existingRecord.version} → v
                    {(
                      Number.parseFloat(existingRecord.version || "1.0") + 0.1
                    ).toFixed(1)}
                    )
                  </p>
                </div>
              )}
            </section>

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-4">
              <Link
                href="/qhse/forms-checklist/transfer-location-quest/list"
                className="rounded-full border cursor-pointer border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={!canSubmit || uploading}
                className="rounded-full bg-sky-500 hover:bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {(() => {
                  if (uploading) {
                    const loadingText = editId ? "Updating..." : "Uploading...";
                    return (
                      <>
                        <svg
                          className="h-4 w-4 animate-spin"
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
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        {loadingText}
                      </>
                    );
                  }
                  return editId
                    ? "Update Questionnaire"
                    : "Upload Questionnaire";
                })()}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
