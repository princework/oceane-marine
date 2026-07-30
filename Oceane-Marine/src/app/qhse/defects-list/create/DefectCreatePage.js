"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../QhseSidebarContext";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { TemplateDownloadLink } from "../../components/TemplateDownloadLink";
import { useSearchParams } from "next/navigation";
import {
  BaseSelect,
  EquipmentSelect,
  buildEquipmentSnapshot,
  equipmentKeyOf,
  storedEquipmentLabel,
  useDefectEquipmentOptions,
} from "../DefectEquipmentFields";

// Limit per-file size to keep the upload responsive. Matches the inline
// guidance shown beneath the picker.
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes) {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isImageName(name) {
  const ext = (name?.split(".").pop() || "").toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext);
}

export default function DefectCreatePage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit");
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = editId ? canEdit : canCreate;

  const [form, setForm] = useState({
    equipmentKey: "",
    equipmentDefect: "",
    base: "",
    actionRequired: "",
    targetDate: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  /** Label for a saved unit that's no longer in the PMS dropdown */
  const [storedEquipment, setStoredEquipment] = useState("");
  const [baseAutoFilled, setBaseAutoFilled] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [removingAttachmentIdx, setRemovingAttachmentIdx] = useState(null);
  const [displayFormCode, setDisplayFormCode] = useState(null);
  const [displaySerialNumber, setDisplaySerialNumber] = useState(null);
  const fileInputRef = useRef(null);

  const {
    equipment,
    accessories,
    locations,
    optionsByKey,
    loading: optionsLoading,
    loadError: optionsError,
  } = useDefectEquipmentOptions();

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoading(true);
    setPageLoading(true);
    setError(null);
    fetch(`/api/qhse/defects-list/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success || !data.data) return;
        const d = data.data;
        setForm({
          equipmentKey: equipmentKeyOf(d.equipmentSource, d.equipmentId),
          equipmentDefect: d.equipmentDefect || "",
          base: d.base || "",
          actionRequired: d.actionRequired || "",
          targetDate: d.targetDate
            ? new Date(d.targetDate).toISOString().slice(0, 10)
            : "",
        });
        setStoredEquipment(storedEquipmentLabel(d));
        setExistingAttachments(d.attachments || []);
        setDisplayFormCode(d.formCode || null);
        setDisplaySerialNumber(d.serialNumber || null);
      })
      .catch(() => setError("Failed to load defect"))
      .finally(() => { setLoading(false); setPageLoading(false); });
    return () => { cancelled = true; };
  }, [editId]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /** Selecting equipment pulls its PMS location across; the user can still override. */
  const handleEquipmentChange = (equipmentKey) => {
    const option = optionsByKey.get(equipmentKey);
    setForm((prev) => ({
      ...prev,
      equipmentKey,
      base: option?.locationName ? option.locationName : prev.base,
    }));
    setBaseAutoFilled(Boolean(option?.locationName));
  };

  const handleBaseChange = (value) => {
    setBaseAutoFilled(false);
    handleChange("base", value);
  };

  const emptyForm = {
    equipmentKey: "",
    equipmentDefect: "",
    base: "",
    actionRequired: "",
    targetDate: "",
  };

  const resetForm = () => {
    setForm(emptyForm);
    setBaseAutoFilled(false);
  };

  const handleFilePick = (event) => {
    const incoming = Array.from(event.target.files || []);
    // Reset the underlying input so the user can re-pick the same file later
    // after removing it from the selection.
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!incoming.length) return;

    setError(null);
    setSelectedFiles((prev) => {
      // Keep an append-style picker so users can build the list across
      // multiple "Choose files" clicks instead of being forced to select
      // everything at once.
      const merged = [...prev];
      const seen = new Set(prev.map((f) => `${f.name}|${f.size}`));
      let rejectedTooLarge = 0;
      for (const file of incoming) {
        if (file.size > MAX_FILE_BYTES) {
          rejectedTooLarge += 1;
          continue;
        }
        const key = `${file.name}|${file.size}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(file);
      }
      if (rejectedTooLarge > 0) {
        setError(
          `${rejectedTooLarge} file${rejectedTooLarge === 1 ? "" : "s"} skipped (over 10 MB limit).`
        );
      }
      return merged;
    });
  };

  const handleRemoveSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingAttachment = async (index) => {
    if (!editId) return;
    if (!confirm("Remove this attachment? This cannot be undone.")) return;
    setRemovingAttachmentIdx(index);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/defects-list/${editId}/attachments/${index}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Failed to remove attachment");
      }
      setExistingAttachments((prev) => prev.filter((_, i) => i !== index));
    } catch (err) {
      setError(err.message || "Failed to remove attachment");
    } finally {
      setRemovingAttachmentIdx(null);
    }
  };

  const uploadFiles = async (defectId) => {
    if (!selectedFiles.length) return;
    const fd = new FormData();
    selectedFiles.forEach((file) => fd.append("files", file));
    const res = await fetch(`/api/qhse/defects-list/${defectId}/upload`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to upload files");
    }
    const data = await res.json().catch(() => ({}));
    return data?.data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const url = editId
        ? `/api/qhse/defects-list/${editId}/update`
        : "/api/qhse/defects-list/create";
      const method = editId ? "PUT" : "POST";

      // Snapshot the chosen PMS unit. When editing a defect whose equipment has
      // left the list, `optionsByKey` has no entry — keep the saved snapshot
      // rather than blanking the link.
      const selectedOption = optionsByKey.get(form.equipmentKey);
      const equipmentFields = selectedOption
        ? buildEquipmentSnapshot(selectedOption)
        : null;

      const body = JSON.stringify({
        ...(equipmentFields || {}),
        equipmentDefect: form.equipmentDefect,
        base: form.base,
        actionRequired: form.actionRequired,
        targetDate: form.targetDate,
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || (editId ? "Failed to update defect" : "Failed to create equipment defect"));
      }

      const defectId = data.data?._id || data.data?.id || editId;
      let uploadedRecord = null;
      if (defectId && selectedFiles.length > 0) {
        uploadedRecord = await uploadFiles(defectId);
      }

      if (data.data?.formCode) setDisplayFormCode(data.data.formCode);
      if (data.data?.serialNumber) setDisplaySerialNumber(data.data.serialNumber);
      setMessage(editId ? "Defect updated successfully!" : "Equipment defect created successfully with status OPEN!");
      setError(null);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Reflect freshly uploaded attachments in the edit form so the user can
      // see exactly what's now attached without needing a page refresh.
      if (editId) {
        const latestAttachments =
          uploadedRecord?.attachments || data?.data?.attachments;
        if (Array.isArray(latestAttachments)) {
          setExistingAttachments(latestAttachments);
        }
      }

      if (!editId) {
        resetForm();
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Something went wrong");
      setMessage(null);
    } finally {
      setSubmitting(false);
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
              QHSE / Defects List
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              {editId ? "Edit Equipment Defect" : "Create Equipment Defect"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-025</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-025" />
            <Link
              href="/qhse/defects-list/create/list"
              className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
            >
              View Defects List
            </Link>
          </div>
        </header>

        <main>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-6">
            {!canSubmit && (
              <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
                You do not have permission to {editId ? "edit" : "create"} records. Form is view-only.
              </div>
            )}

            {loading ? (
              <p className="text-sm text-slate-300">Loading defect...</p>
            ) : (
              <>
            {!editId && (
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-400/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                Status: <span className="text-emerald-300">Open</span>
              </span>
            </div>
            )}

            {(displayFormCode || displaySerialNumber || editId) && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-6">
                  {displayFormCode && (
                    <div>
                      <span className="text-slate-400 uppercase tracking-wider text-xs">Form Code</span>
                      <p className="font-mono font-semibold text-sky-300">{displayFormCode}</p>
                    </div>
                  )}
                  {displaySerialNumber && (
                    <div>
                      <span className="text-slate-400 uppercase tracking-wider text-xs">Serial</span>
                      <p className="font-mono font-semibold text-slate-200">{displaySerialNumber}</p>
                    </div>
                  )}
                </div>
                {editId && (
                  <Link
                    href="/qhse/defects-list/create/list"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-slate-200 hover:border-rose-400/60 hover:bg-rose-500/15 hover:text-rose-200 transition"
                    title="Cancel editing"
                    aria-label="Cancel editing and return to defect list"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Link>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {optionsError && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {optionsError}
                </div>
              )}

              {/* Equipment — from PMS inventory */}
              <EquipmentSelect
                value={form.equipmentKey}
                onChange={handleEquipmentChange}
                equipment={equipment}
                accessories={accessories}
                loading={optionsLoading}
                fallbackLabel={
                  form.equipmentKey && !optionsByKey.get(form.equipmentKey)
                    ? storedEquipment
                    : ""
                }
                disabled={!canSubmit}
              />

              {/* Defect description */}
              <div>
                <label
                  htmlFor="equipmentDefect"
                  className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5"
                >
                  Defect Description
                </label>
                <textarea
                  id="equipmentDefect"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  rows={3}
                  value={form.equipmentDefect}
                  onChange={(e) =>
                    handleChange("equipmentDefect", e.target.value)
                  }
                  placeholder="Describe what is wrong with the equipment"
                  required
                />
              </div>

              {/* Base + Target Date */}
              <div className="grid gap-4 md:grid-cols-2">
                <BaseSelect
                  value={form.base}
                  onChange={handleBaseChange}
                  locations={locations}
                  loading={optionsLoading}
                  disabled={!canSubmit}
                  autoFilled={baseAutoFilled}
                />

                <div>
                  <label
                    htmlFor="targetDate"
                    className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5"
                  >
                    Target Date
                  </label>
                  <input
                    id="targetDate"
                    type="date"
                    className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                    value={form.targetDate}
                    onChange={(e) =>
                      handleChange("targetDate", e.target.value)
                    }
                    required
                  />
                </div>
              </div>

              {/* Photos / Files — supports multiple uploads */}
              <div>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <label
                    htmlFor="files"
                    className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100"
                  >
                    Photos / Files (optional)
                  </label>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">
                    Multiple files allowed · max 10 MB each
                  </span>
                </div>

                <input
                  id="files"
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white file:mr-3 file:py-1.5 file:rounded-full file:border-0 file:bg-sky-500/20 file:text-sky-200 file:text-xs"
                  onChange={handleFilePick}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Tip: hold Ctrl / Cmd (or Shift) while picking to select multiple
                  files at once. You can also click &ldquo;Choose files&rdquo; again
                  to add more &mdash; they&apos;ll be appended to the list below.
                </p>

                {/* Already-saved attachments (edit mode) */}
                {editId && existingAttachments.length > 0 && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                        Already attached ({existingAttachments.length})
                      </p>
                    </div>
                    <ul className="flex flex-wrap gap-2">
                      {existingAttachments.map((att, idx) => (
                        <li
                          key={`${att.path || att.originalName}-${idx}`}
                          className="inline-flex max-w-full items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-100"
                        >
                          <span aria-hidden className="text-[10px]">
                            {isImageName(att.originalName) ? "🖼" : "📎"}
                          </span>
                          <span
                            className="max-w-[18ch] truncate"
                            title={att.originalName}
                          >
                            {att.originalName || `attachment-${idx + 1}`}
                          </span>
                          {canSubmit && (
                            <button
                              type="button"
                              onClick={() => handleRemoveExistingAttachment(idx)}
                              disabled={removingAttachmentIdx === idx}
                              className="ml-1 rounded-full p-0.5 text-sky-200 hover:bg-sky-500/30 hover:text-white disabled:opacity-50"
                              title="Remove this attachment"
                              aria-label={`Remove ${att.originalName || `attachment ${idx + 1}`}`}
                            >
                              {removingAttachmentIdx === idx ? (
                                <span className="px-1 text-[10px]">…</span>
                              ) : (
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              )}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Files staged for the next upload */}
                {selectedFiles.length > 0 && (
                  <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                        Ready to upload ({selectedFiles.length})
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedFiles([])}
                        className="text-[11px] text-slate-300 hover:text-white"
                      >
                        Clear all
                      </button>
                    </div>
                    <ul className="flex flex-wrap gap-2">
                      {selectedFiles.map((file, idx) => (
                        <li
                          key={`${file.name}-${file.size}-${idx}`}
                          className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white"
                        >
                          <span aria-hidden className="text-[10px]">
                            {isImageName(file.name) ? "🖼" : "📎"}
                          </span>
                          <span
                            className="max-w-[18ch] truncate"
                            title={file.name}
                          >
                            {file.name}
                          </span>
                          <span className="text-[10px] text-slate-300">
                            {formatBytes(file.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedFile(idx)}
                            className="ml-1 rounded-full p-0.5 text-slate-200 hover:bg-white/20 hover:text-white"
                            title="Remove from upload list"
                            aria-label={`Remove ${file.name}`}
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Required */}
              <div>
                <label
                  htmlFor="actionRequired"
                  className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5"
                >
                  Action Required
                </label>
                <textarea
                  id="actionRequired"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  rows={3}
                  value={form.actionRequired}
                  onChange={(e) =>
                    handleChange("actionRequired", e.target.value)
                  }
                  placeholder="Describe the corrective action required"
                  required
                />
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
                  onClick={resetForm}
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
                  {submitting ? "Saving..." : editId ? "Update Defect" : "Save Defect"}
                </button>
              </div>
            </form>
            </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

