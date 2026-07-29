"use client";

import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { downloadFileFromUrl } from "@/lib/utils/sts-file-download";

const ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];

function CloudUploadIcon({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.25}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
      />
    </svg>
  );
}

function syncNamesFromInput(input) {
  if (!input?.files?.length) return [];
  return Array.from(input.files, (f) => f.name);
}

function mergeFilesIntoInput(input, newFiles) {
  if (!input) return;
  const dt = new DataTransfer();
  if (input.files?.length) {
    for (const f of input.files) {
      dt.items.add(f);
    }
  }
  for (const file of newFiles) {
    if (file && file.size > 0) dt.items.add(file);
  }
  input.files = dt.files;
}

/**
 * Multiple optional file attachments for STS Documentation.
 *
 * Form fields emitted:
 *   - documentationFiles[] : brand-new files to add
 *   - documentationKeepEnabled=true (sentinel telling the API to honor keep/remove markers)
 *   - documentationKeepPaths[] : MANUAL_UPLOAD existing paths still to keep
 *   - documentationReplaceFor[] + documentationReplaceFile[] : zipped pairs (old path → new file)
 *
 * @param {{ existingDocuments?: Array<{ documentType?: string; filePath: string; source?: string; uploadedAt?: string|Date }> }} props
 */
export default function StsDocumentationMultiUpload({ existingDocuments = [] }) {
  const inputRef = useRef(null);
  /** Files already on the input before opening the file dialog (so "+ Add Files" stays additive). */
  const preservedBeforePickerRef = useRef([]);
  const [selectedNames, setSelectedNames] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // ─────────── Existing manual attachments ───────────
  // Build a stable signature so the memo recomputes only when the actual list
  // of manual upload paths changes — not on every parent render that passes a
  // fresh array literal for `existingDocuments`.
  const existingSignature = useMemo(() => {
    return (existingDocuments || [])
      .filter((d) => d?.filePath && d.source === "MANUAL_UPLOAD")
      .map((d) => `${d.filePath}::${d.documentType || ""}`)
      .join("|");
  }, [existingDocuments]);

  const initialExisting = useMemo(() => {
    const list = (existingDocuments || []).filter(
      (d) => d?.filePath && d.source === "MANUAL_UPLOAD"
    );
    const seen = new Set();
    return list.filter((d) => {
      if (seen.has(d.filePath)) return false;
      seen.add(d.filePath);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingSignature]);

  /** Paths the user explicitly removed (subset of initialExisting filePaths). */
  const [removedPaths, setRemovedPaths] = useState(() => new Set());
  /** filePath → File (replacement chosen but not yet saved). */
  const [replacements, setReplacements] = useState({});
  /** filePath → object URL for replacement preview / re-download. */
  const [replacementPreviews, setReplacementPreviews] = useState({});
  /** Signature snapshot used to detect when the upstream list actually changed. */
  const lastSyncedSignatureRef = useRef(existingSignature);

  // When the upstream list of attachments truly changes (e.g. after save reload),
  // reset local edit state. Compares against a ref so the effect can't loop on
  // its own setState calls.
  useEffect(() => {
    if (lastSyncedSignatureRef.current === existingSignature) return;
    lastSyncedSignatureRef.current = existingSignature;
    setRemovedPaths(new Set());
    setReplacements({});
    setReplacementPreviews((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return {};
    });
  }, [existingSignature]);

  // Revoke any outstanding object URLs on unmount.
  useEffect(() => {
    return () => {
      Object.values(replacementPreviews).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Derived: existing docs the user still wants to keep. */
  const keptExisting = useMemo(
    () => initialExisting.filter((d) => !removedPaths.has(d.filePath)),
    [initialExisting, removedPaths]
  );

  const removeExisting = useCallback((filePath) => {
    setRemovedPaths((prev) => {
      if (prev.has(filePath)) return prev;
      const next = new Set(prev);
      next.add(filePath);
      return next;
    });
    setReplacements((prev) => {
      if (!(filePath in prev)) return prev;
      const next = { ...prev };
      delete next[filePath];
      return next;
    });
    setReplacementPreviews((prev) => {
      if (!(filePath in prev)) return prev;
      URL.revokeObjectURL(prev[filePath]);
      const next = { ...prev };
      delete next[filePath];
      return next;
    });
  }, []);

  const onPickReplacement = useCallback((filePath, file) => {
    if (!file) return;
    setReplacements((prev) => ({ ...prev, [filePath]: file }));
    setReplacementPreviews((prev) => {
      if (prev[filePath]) URL.revokeObjectURL(prev[filePath]);
      return { ...prev, [filePath]: URL.createObjectURL(file) };
    });
  }, []);

  const cancelReplacement = useCallback((filePath) => {
    setReplacements((prev) => {
      if (!(filePath in prev)) return prev;
      const next = { ...prev };
      delete next[filePath];
      return next;
    });
    setReplacementPreviews((prev) => {
      if (!(filePath in prev)) return prev;
      URL.revokeObjectURL(prev[filePath]);
      const next = { ...prev };
      delete next[filePath];
      return next;
    });
  }, []);

  // ─────────── New file picker ───────────
  const openPicker = useCallback(() => {
    const input = inputRef.current;
    preservedBeforePickerRef.current = input?.files?.length
      ? Array.from(input.files)
      : [];
    input?.click();
  }, []);

  const refreshFromInput = useCallback(() => {
    setSelectedNames(syncNamesFromInput(inputRef.current));
  }, []);

  const onInputChange = useCallback(() => {
    const input = inputRef.current;
    const incoming = Array.from(input?.files || []);
    const prior = preservedBeforePickerRef.current;
    preservedBeforePickerRef.current = [];

    if (!input) return;

    if (!incoming.length && !prior.length) {
      setSelectedNames([]);
      return;
    }

    const dt = new DataTransfer();
    for (const f of prior) dt.items.add(f);
    for (const f of incoming) dt.items.add(f);
    input.files = dt.files;
    setSelectedNames(syncNamesFromInput(input));
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer?.files || []);
      if (!dropped.length) return;
      mergeFilesIntoInput(inputRef.current, dropped);
      refreshFromInput();
    },
    [refreshFromInput]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const clear = useCallback(() => {
    const input = inputRef.current;
    if (input) {
      input.value = "";
      const dt = new DataTransfer();
      input.files = dt.files;
    }
    setSelectedNames([]);
  }, []);

  // Per-row replacement input refs (keyed by filePath).
  const replaceInputRefs = useRef({});
  const setReplaceInputRef = useCallback((filePath) => (el) => {
    if (el) replaceInputRefs.current[filePath] = el;
  }, []);

  // Build the replacement pair entries the form will submit.
  const replacementPairs = useMemo(
    () =>
      Object.entries(replacements).filter(
        ([, file]) => file instanceof File && file.size > 0
      ),
    [replacements]
  );

  const hasExistingControls = initialExisting.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-bold text-white">Attachments</h3>
        <button
          type="button"
          onClick={openPicker}
          className="shrink-0 rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/80 transition"
        >
          + Add Files
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="documentationFiles"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={onInputChange}
      />

      {/* Sentinel + keep markers: tell the API the client manages the existing-uploads list */}
      {hasExistingControls && (
        <input type="hidden" name="documentationKeepEnabled" value="true" />
      )}
      {keptExisting
        .filter((doc) => !(doc.filePath in replacements))
        .map((doc) => (
          <input
            key={`keep-${doc.filePath}`}
            type="hidden"
            name="documentationKeepPaths"
            value={doc.filePath}
          />
        ))}

      <button
        type="button"
        onClick={openPicker}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 ${
          isDragging
            ? "border-orange-400/60 bg-orange-500/10"
            : "border-white/25 bg-white/2 hover:border-white/35 hover:bg-white/4"
        }`}
      >
        <CloudUploadIcon className="mb-4 h-12 w-12 text-slate-400" />
        <p className="text-center text-sm text-white">
          Click &quot;+ Add Files&quot; to attach documents
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
        </p>
      </button>

      {selectedNames.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/3 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ready to upload ({selectedNames.length})
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline"
            >
              Clear all
            </button>
          </div>
          <ul className="max-h-36 space-y-1 overflow-y-auto text-sm text-slate-300">
            {selectedNames.map((name, idx) => (
              <li key={`${name}-${idx}`} className="truncate pl-1">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {keptExisting.length > 0 && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/3 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Previously uploaded ({keptExisting.length})
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {keptExisting.map((doc, i) => {
              const replacement = replacements[doc.filePath];
              const previewUrl = replacementPreviews[doc.filePath];
              const displayName = replacement
                ? replacement.name
                : doc.documentType || doc.filePath?.split("/").pop() || "attachment";
              const ext = (displayName.split(".").pop() || "").toLowerCase();
              const isImage = IMAGE_EXTS.includes(ext);
              const downloadName =
                doc.filePath?.split("/").pop()?.split("?")[0] || displayName;

              return (
                <div
                  key={`${doc.filePath}-${i}`}
                  className="flex flex-col overflow-hidden rounded-lg border border-white/10 bg-white/5"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl || doc.filePath}
                      alt={displayName}
                      className="h-24 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-white/5 text-[11px] font-bold uppercase tracking-wider text-white/60">
                      {ext || "file"}
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 px-2.5 py-2">
                    <p className="truncate text-[12px] font-medium text-slate-100" title={displayName}>
                      {displayName}
                    </p>
                    {replacement ? (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        Pending replacement — save to apply
                      </p>
                    ) : doc.source ? (
                      <p className="truncate text-[10px] text-slate-500">{doc.source}</p>
                    ) : null}

                    {/* Hidden inputs that submit the replacement pair */}
                    {replacement && (
                      <>
                        <input
                          type="hidden"
                          name="documentationReplaceFor"
                          value={doc.filePath}
                        />
                        <FileBridge
                          name="documentationReplaceFile"
                          file={replacement}
                          inputRef={setReplaceInputRef(doc.filePath)}
                        />
                      </>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => downloadFileFromUrl(doc.filePath, downloadName)}
                        className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/15 transition"
                        title="Download original file"
                      >
                        Download
                      </button>
                      <label className="cursor-pointer rounded-md bg-sky-500/20 px-2 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/30 transition">
                        {replacement ? "Choose another" : "Replace"}
                        <input
                          type="file"
                          accept={ACCEPT}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onPickReplacement(doc.filePath, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {replacement && (
                        <button
                          type="button"
                          onClick={() => cancelReplacement(doc.filePath)}
                          className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/15 transition"
                        >
                          Undo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeExisting(doc.filePath)}
                        className="ml-auto rounded-md bg-red-500/15 px-2 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/25 transition"
                        title="Remove this attachment"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500">
            Replace swaps the file on save. Remove deletes the entry from this operation. Linked-form
            submissions stay untouched.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Hidden file input that proxies a `File` object so it gets included in the form submission.
 * React doesn't allow setting `.files` declaratively, so we sync via DataTransfer in an effect.
 */
function FileBridge({ name, file, inputRef }) {
  const localRef = useRef(null);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    try {
      const dt = new DataTransfer();
      if (file) dt.items.add(file);
      el.files = dt.files;
    } catch {
      // Safari/older browsers: leave as-is; submit will silently drop replacement.
    }
  }, [file]);

  return (
    <input
      ref={(el) => {
        localRef.current = el;
        if (typeof inputRef === "function") inputRef(el);
      }}
      type="file"
      name={name}
      className="hidden"
      tabIndex={-1}
      aria-hidden
    />
  );
}
