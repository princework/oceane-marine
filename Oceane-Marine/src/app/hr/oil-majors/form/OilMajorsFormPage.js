"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useHrLoading } from "../../HrLoadingContext";
import { useHrRole } from "@/hooks/useHrRole";

export default function OilMajorsFormPage({ onSuccess }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { setPageLoading } = useHrLoading();
  const { canCreate, canEdit } = useHrRole();
  const canSubmit = editId ? canEdit : canCreate;
  const fileInputRef = useRef(null);

  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState("Approved");

  // Multiple attachments: new files to upload + existing files from server
  const [newFiles, setNewFiles] = useState([]); // File objects to upload
  const [existingAttachments, setExistingAttachments] = useState([]); // { fileUrl, originalFileName }

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const statusOptions = [
    "Approved",
    "Counterparty STS service provider",
    "In Progress",
  ];

  // Load data if editing
  useEffect(() => {
    if (editId) {
      const loadData = async () => {
        try {
          setLoadingData(true);
          setPageLoading(true);
          const res = await fetch("/api/hr/oil-majors/list");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load");
          const record = data.data?.find((r) => r._id === editId);
          if (record) {
            setCompanyName(record.companyName || "");
            setStatus(record.status || "Approved");
            // Load existing attachments (support both old single and new array format)
            if (record.attachments?.length > 0) {
              setExistingAttachments(record.attachments.filter((a) => a.fileUrl));
            } else if (record.attachment?.fileUrl) {
              // Backward compat for old single-file records
              setExistingAttachments([record.attachment]);
            }
          }
        } catch (err) {
          setError(err.message);
        } finally {
          setLoadingData(false);
          setPageLoading(false);
        }
      };
      loadData();
    }
  }, [editId, setPageLoading]);

  const handleAddFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setNewFiles((prev) => [...prev, ...files]);
    }
    // Reset input so user can re-select same file
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeNewFile = (index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingFile = (index) => {
    setExistingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setMessage("");
    setLoading(true);
    setPageLoading(true);

    try {
      if (!companyName.trim()) throw new Error("Company Name is required");
      if (!status) throw new Error("Status is required");

      const formData = new FormData();
      formData.append("companyName", companyName.trim());
      formData.append("status", status);

      // Append new files
      for (const file of newFiles) {
        formData.append("attachments", file);
      }

      // For edit mode — tell server which existing files to keep
      if (editId) {
        const keepUrls = existingAttachments.map((a) => a.fileUrl);
        formData.append("keepAttachments", JSON.stringify(keepUrls));
      }

      const url = editId ? `/api/hr/oil-majors/${editId}/update` : "/api/hr/oil-majors/create";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, { method, body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || data.error || `Failed to ${editId ? "update" : "create"} record`);

      setMessage(editId ? "Oil Major record updated successfully!" : "Oil Major record created successfully!");
      setCompanyName("");
      setStatus("Approved");
      setNewFiles([]);
      setExistingAttachments([]);

      setTimeout(() => {
        if (onSuccess) onSuccess();
        router.push("/hr/oil-majors?tab=list");
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  const totalFiles = existingAttachments.length + newFiles.length;

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {editId ? "Edit Oil Major" : "Oil Major"}
          </h2>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 bg-green-500/20 border border-green-500/50 text-green-200 px-4 py-3 rounded-xl text-sm">
            {message}
          </div>
        )}

        {!canSubmit && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
            You do not have permission to {editId ? "edit" : "create"} oil major records.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <label htmlFor="om-company" className="block text-sm font-semibold text-white/90">
              Company Name <span className="text-red-400">*</span>
            </label>
            <input
              id="om-company"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              readOnly={!canSubmit}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all read-only:opacity-70"
              placeholder="e.g., CHEVRON, SHELL, BP"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label htmlFor="om-status" className="block text-sm font-semibold text-white/90">
              Status <span className="text-red-400">*</span>
            </label>
            <select
              id="om-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
              disabled={!canSubmit}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all disabled:opacity-70"
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-slate-900">{opt}</option>
              ))}
            </select>
          </div>

          {/* Multiple File Uploads */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-white/90">
                Attachments
                {totalFiles > 0 && (
                  <span className="ml-2 text-xs font-bold text-orange-300 bg-orange-500/20 px-2 py-0.5 rounded-full">
                    {totalFiles} file{totalFiles !== 1 ? "s" : ""}
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canSubmit}
                className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg text-xs font-semibold transition border border-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Files
              </button>
            </div>

            {/* Hidden file input (multiple) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              multiple
              onChange={handleAddFiles}
              className="hidden"
            />

            {/* Existing files (edit mode) */}
            {existingAttachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-emerald-400/80 font-medium">Existing files:</p>
                {existingAttachments.map((att, i) => (
                  <div key={`existing-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-emerald-300 flex-1 truncate">{att.originalFileName || "File"}</span>
                    {canSubmit && (
                      <button
                        type="button"
                        onClick={() => removeExistingFile(i)}
                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/15 transition"
                        title="Remove file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* New files to upload */}
            {newFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-orange-400/80 font-medium">New files to upload:</p>
                {newFiles.map((file, i) => (
                  <div key={`new-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-orange-300 flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-orange-400/60">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    {canSubmit && (
                      <button
                        type="button"
                        onClick={() => removeNewFile(i)}
                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/15 transition"
                        title="Remove file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {totalFiles === 0 && (
              <div className="border-2 border-dashed border-white/15 rounded-xl p-6 text-center">
                <svg className="w-8 h-8 text-white/30 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-white/40">Click &quot;+ Add Files&quot; to attach documents</p>
                <p className="text-xs text-white/30 mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG</p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={!canSubmit || loading || loadingData}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-orange-500/40 transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (editId ? "Updating..." : "Creating...") : (editId ? "Update Record" : "Create Record")}
            </button>
            <Link
              href="/hr/oil-majors?tab=list"
              className="px-6 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white font-semibold transition duration-200"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
