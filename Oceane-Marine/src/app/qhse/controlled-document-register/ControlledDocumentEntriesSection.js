"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useQhseRole } from "@/hooks/useQhseRole";

function revLabel(row) {
  if (row?.revNo) return row.revNo;
  return `${row?.revMajor ?? 1}.${row?.revMinor ?? 0}`;
}

function normalizeDocumentCount(value) {
  if (typeof value === "number" && !Number.isNaN(value))
    return Math.max(0, Math.floor(value));
  const n = Number.parseInt(String(value ?? "0"), 10);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

const ControlledDocumentEntriesSection = forwardRef(function ControlledDocumentEntriesSection(
  { createFormSignal = 0, onEntriesMutated },
  ref
) {
  const { canCreate, canEdit } = useQhseRole();

  const [portalTarget, setPortalTarget] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [mode, setMode] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [archivingFile, setArchivingFile] = useState(false);
  const archiveRequestInFlightRef = useRef(false);

  const [formCode, setFormCode] = useState("");
  const [title, setTitle] = useState("");
  const [documentsCount, setDocumentsCount] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [department, setDepartment] = useState("");
  const [revDisplay, setRevDisplay] = useState("1.0");
  const [documentFile, setDocumentFile] = useState(null);
  const [existingFileName, setExistingFileName] = useState("");

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormCode("");
    setTitle("");
    setDocumentsCount("");
    setIssueDate("");
    setDepartment("");
    setRevDisplay("1.0");
    setDocumentFile(null);
    setExistingFileName("");
  }, []);

  useEffect(() => {
    setPortalTarget(typeof document !== "undefined" ? document.body : null);
  }, []);

  useEffect(() => {
    if (mode !== "form") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") {
        resetForm();
        setMode("list");
        setError("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [mode, resetForm]);

  const closeFormModal = useCallback(() => {
    resetForm();
    setMode("list");
    setError("");
  }, [resetForm]);

  const openCreate = useCallback(() => {
    resetForm();
    setRevDisplay("1.0");
    setMode("form");
    setError("");
    setMessage("");
  }, [resetForm]);

  const openEdit = useCallback(
    (row) => {
      if (!canEdit || !row?._id) return;
      setEditingId(row._id);
      setFormCode(row.formCode || "");
      setTitle(row.title || "");
      setDocumentsCount(String(normalizeDocumentCount(row.documents)));
      setIssueDate(
        row.issueDate ? new Date(row.issueDate).toISOString().slice(0, 10) : ""
      );
      setDepartment(row.department || "");
      setRevDisplay(revLabel(row));
      setDocumentFile(null);
      setExistingFileName(row.attachment?.originalFileName || "");
      setMode("form");
      setError("");
      setMessage("");
    },
    [canEdit]
  );

  useImperativeHandle(
    ref,
    () => ({
      openCreate,
      openEdit,
    }),
    [openCreate, openEdit]
  );

  const notifyMutated = useCallback(async () => {
    if (typeof onEntriesMutated === "function") {
      await onEntriesMutated();
    }
  }, [onEntriesMutated]);

  useEffect(() => {
    if (createFormSignal > 0 && canCreate) {
      openCreate();
    }
  }, [createFormSignal, canCreate, openCreate]);

  const handleArchiveCurrentFile = async () => {
    if (!editingId || !canEdit) return;
    if (archiveRequestInFlightRef.current) return;
    archiveRequestInFlightRef.current = true;
    setArchivingFile(true);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/controlled-document-entry/${editingId}/archive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            archiveReason:
              "Manual archive — controlled document file (Controlled Document Register)",
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Archive failed");
      setMessage(data.message || "Archived.");
      setTimeout(() => setMessage(""), 5000);
    } catch (err) {
      setError(err.message || "Archive failed");
    } finally {
      archiveRequestInFlightRef.current = false;
      setArchivingFile(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId ? !canEdit : !canCreate) return;
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (!editingId && !documentFile) {
        setError("Please attach a document file.");
        setSubmitting(false);
        return;
      }

      const revTrimmed = revDisplay.trim();
      if (!/^\d{1,4}\.\d{1,4}$/.test(revTrimmed)) {
        setError("Rev No must be major.minor (e.g. 1.0 or 2.15).");
        setSubmitting(false);
        return;
      }

      const fd = new FormData();
      fd.append("formCode", formCode.trim());
      fd.append("title", title.trim());
      fd.append(
        "documents",
        String(
          normalizeDocumentCount(documentsCount === "" ? 0 : documentsCount)
        )
      );
      fd.append("department", department.trim());
      fd.append("revNo", revTrimmed);
      if (issueDate) fd.append("issueDate", issueDate);
      if (documentFile) fd.append("document", documentFile);

      const url = editingId
        ? `/api/qhse/controlled-document-entry/${editingId}`
        : "/api/qhse/controlled-document-entry/create";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, { method, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);

      setMessage(data.message || "Saved.");
      closeFormModal();
      await notifyMutated();
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const formModal =
    mode === "form" && portalTarget
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex flex-col bg-slate-950/80 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="controlled-doc-form-title"
          >
            <div
              className="absolute inset-0 z-0"
              aria-hidden="true"
              onClick={() => {
                if (!submitting && !archivingFile) closeFormModal();
              }}
            />
            <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 flex justify-center">
                <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#0b2740]/95 shadow-2xl shadow-black/60 backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <h2
                      id="controlled-doc-form-title"
                      className="text-lg font-semibold text-white"
                    >
                      {editingId ? "Edit Form" : "Create Form"}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        if (!submitting && !archivingFile) closeFormModal();
                      }}
                      className="rounded-lg border border-white/20 bg-white/5 p-2 text-slate-200 hover:bg-white/10 hover:text-white"
                      aria-label="Close"
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

                  <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
                    {error && (
                      <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-red-200 text-sm">
                        {error}
                      </div>
                    )}
                    {message && (
                      <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-emerald-200 text-sm">
                        {message}
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label
                          htmlFor="cdf-form-code"
                          className="text-xs font-medium uppercase tracking-wide text-slate-300"
                        >
                          Form Code <span className="text-red-400">*</span>
                        </label>
                        <input
                          id="cdf-form-code"
                          required
                          value={formCode}
                          onChange={(e) => setFormCode(e.target.value)}
                          className="w-full rounded-lg border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/40 outline-none"
                          placeholder="e.g. QAF-OFD-021"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="cdf-title"
                          className="text-xs font-medium uppercase tracking-wide text-slate-300"
                        >
                          Title <span className="text-red-400">*</span>
                        </label>
                        <input
                          id="cdf-title"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full rounded-lg border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/40 outline-none"
                          placeholder="Document title"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="cdf-documents-count"
                        className="text-xs font-medium uppercase tracking-wide text-slate-300"
                      >
                        Documents{" "}
                        <span className="text-slate-500 normal-case">(count)</span>
                      </label>
                      <input
                        id="cdf-documents-count"
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={documentsCount}
                        onChange={(e) => setDocumentsCount(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/40 outline-none max-w-xs"
                        placeholder="0"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label
                          htmlFor="cdf-issue-date"
                          className="text-xs font-medium uppercase tracking-wide text-slate-300"
                        >
                          Issue Date
                        </label>
                        <input
                          id="cdf-issue-date"
                          type="date"
                          value={issueDate}
                          onChange={(e) => setIssueDate(e.target.value)}
                          className="w-full rounded-lg border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/40 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="cdf-rev-no"
                          className="text-xs font-medium uppercase tracking-wide text-slate-300"
                        >
                          Rev No <span className="text-red-400">*</span>
                        </label>
                        <input
                          id="cdf-rev-no"
                          required
                          value={revDisplay}
                          onChange={(e) => setRevDisplay(e.target.value)}
                          className="w-full rounded-lg border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-sky-500/40 outline-none max-w-xs"
                          placeholder="e.g. 1.0"
                          pattern="\d{1,4}\.\d{1,4}"
                          title="Major.minor (e.g. 1.0)"
                        />
                        <p className="text-[10px] text-slate-500">
                          Enter revision manually (major.minor). Not auto-incremented on save.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="cdf-department"
                        className="text-xs font-medium uppercase tracking-wide text-slate-300"
                      >
                        Department
                      </label>
                      <input
                        id="cdf-department"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/40 outline-none"
                        placeholder="e.g. QHSE"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="cdf-file"
                        className="text-xs font-medium uppercase tracking-wide text-slate-300"
                      >
                        Upload document{" "}
                        {!editingId && <span className="text-red-400">*</span>}
                      </label>
                      {editingId && existingFileName && !documentFile && (
                        <>
                          <p className="text-[11px] text-slate-400 mb-2">
                            Current file:{" "}
                            <span className="text-sky-200">{existingFileName}</span>.
                            Upload a new file below to replace it; the previous file is archived
                            automatically before replacement.
                          </p>
                          {canEdit && (
                            <div className="mb-2 flex justify-end">
                              <button
                                type="button"
                                onClick={handleArchiveCurrentFile}
                                disabled={archivingFile || submitting}
                                className="rounded-lg border border-amber-400/45 bg-amber-500/15 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                {archivingFile ? "Archiving…" : "Archive current file"}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      <input
                        id="cdf-file"
                        type="file"
                        onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                        disabled={archivingFile}
                        className="w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-white"
                      />
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={
                          submitting ||
                          archivingFile ||
                          (editingId ? !canEdit : !canCreate)
                        }
                        className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {submitting ? "Saving…" : editingId ? "Save changes" : "Create"}
                      </button>
                      <button
                        type="button"
                        disabled={submitting || archivingFile}
                        onClick={() => closeFormModal()}
                        className="inline-flex items-center rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>,
          portalTarget
        )
      : null;

  return <>{formModal}</>;
});

ControlledDocumentEntriesSection.displayName = "ControlledDocumentEntriesSection";

export default ControlledDocumentEntriesSection;
