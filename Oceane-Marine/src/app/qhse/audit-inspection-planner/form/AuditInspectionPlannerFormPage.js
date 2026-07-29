"use client";

import { useQhseSidebar } from "../../QhseSidebarContext";
import { useQhseRole } from "@/hooks/useQhseRole";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TemplateDownloadLink } from "../../components/TemplateDownloadLink";
import { ActionEditIcon, ActionDeleteIcon } from "@/app/components/RecordActionIcons";

function auditPlannerDescInputId(catKey, rowId) {
  return `audit-planner-${catKey}-${rowId}-desc`;
}

const defaultCategories = [
  { key: "stsBaseAudit", title: "STS Base Audit" },
  { key: "stsTransferAudit", title: "STS Transfer Audit" },
  { key: "poacCrossCompetency", title: "POAC Cross Competency Evaluation" },
  { key: "supportCraftInspection", title: "STS Support Craft Inspection" },
  { key: "officeInternalAudit", title: "Office Internal Audit" },
];

const columns = [
  { key: "description", label: "Audit / Inspection Description" },
  { key: "frequency", label: "Frequency" },
  { key: "dueBy", label: "Due by" },
  { key: "status", label: "Status" },
  { key: "auditorName", label: "Auditor Name" },
  { key: "auditDate", label: "Audit Date" },
  { key: "remarks", label: "Remarks" },
  { key: "actions", label: "Actions" },
  { key: "file", label: "File Upload" },
];

function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 7; i <= currentYear + 5; i++) years.push(i);
  return years;
}

export default function AuditInspectionPlannerFormPage() {
  const { contentClassName } = useQhseSidebar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyEditId = searchParams.get("edit") || null;
  const { canCreate, canEdit, canDownload, canView } = useQhseRole();
  const canSubmit = canCreate || canEdit;

  const [formMeta, setFormMeta] = useState({
    issueDate: new Date().toISOString().split("T")[0],
    approvedBy: "JS",
  });
  const [formCode, setFormCode] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [version, setVersion] = useState("1.0");
  const [year, setYear] = useState(new Date().getFullYear());
  const [status, setStatus] = useState("Draft");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingLegacyEdit, setLoadingLegacyEdit] = useState(!!legacyEditId);
  /** Mongo _id of the single tracker document for this year (for row attachment downloads) */
  const [trackerDocumentId, setTrackerDocumentId] = useState(null);
  // True while we're fetching the existing tracker for the chosen year.
  const [loadingTracker, setLoadingTracker] = useState(false);
  // Existing rows count per category at the moment the tracker was loaded —
  // used to render the small "previously saved" hint.
  const [trackerSnapshotCount, setTrackerSnapshotCount] = useState(0);
  const [rowsByCategory, setRowsByCategory] = useState(() =>
    Object.fromEntries(defaultCategories.map((c) => [c.key, []]))
  );
  const [filesByRowId, setFilesByRowId] = useState({});

  const categories = useMemo(
    () =>
      defaultCategories.map((cat) => ({
        ...cat,
        rows: rowsByCategory[cat.key] || [],
      })),
    [rowsByCategory]
  );

  useEffect(() => {
    const fetchCode = async () => {
      try {
        const res = await fetch("/api/qhse/audit-inspection-planner/code");
        const data = await res.json();
        if (res.ok && data.formCode) {
          setFormCode(data.formCode);
          setVersion(data.version || "1.0");
        } else {
          setError(data.error || "Failed to generate form code");
        }
      } catch (err) {
        setError(err.message || "Failed to generate form code");
      }
    };
    fetchCode();
  }, []);

  // Hydrates the row state + form meta from a planner document returned by the
  // API. Used by both the edit-by-id loader and the tracker (load-by-year)
  // flow so they stay consistent.
  const hydrateFromPlanner = (p) => {
    setFormMeta({
      issueDate: p.issueDate
        ? new Date(p.issueDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      approvedBy: p.approvedBy || "JS",
    });
    if (p.formCode) setFormCode(p.formCode);
    if (p.serialNumber) setSerialNumber(p.serialNumber);
    if (p.version) setVersion(p.version);
    if (p.year != null) setYear(Number(p.year));
    if (p.status) setStatus(p.status);
    setTrackerDocumentId(p._id ? String(p._id) : null);
    if (Array.isArray(p.categories) && p.categories.length > 0) {
      const next = {};
      let totalRows = 0;
      defaultCategories.forEach((cat) => {
        const found = p.categories.find((c) => c.key === cat.key);
        const rows = (found?.rows || []).map((r) => {
          const rowId = r.rowId || r.id || crypto.randomUUID();
          let auditDateVal = r.auditDate;
          if (auditDateVal) {
            const d = new Date(auditDateVal);
            auditDateVal = Number.isNaN(d.getTime())
              ? ""
              : d.toISOString().split("T")[0];
          } else {
            auditDateVal = "";
          }
          return {
            ...r,
            id: rowId,
            rowId,
            auditDate: auditDateVal,
          };
        });
        next[cat.key] = rows;
        totalRows += rows.length;
      });
      setRowsByCategory(next);
      setTrackerSnapshotCount(totalRows);
    } else {
      setRowsByCategory(
        Object.fromEntries(defaultCategories.map((c) => [c.key, []]))
      );
      setTrackerSnapshotCount(0);
    }
  };

  /** Old bookmarks: ?edit=id → hydrate that doc then continue as year tracker */
  useEffect(() => {
    if (!legacyEditId) {
      setLoadingLegacyEdit(false);
      return;
    }
    let cancelled = false;
    const loadPlanner = async () => {
      setLoadingLegacyEdit(true);
      setError("");
      try {
        const res = await fetch(`/api/qhse/audit-inspection-planner/${legacyEditId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load planner");
        if (cancelled) return;
        hydrateFromPlanner(data.data);
        router.replace("/qhse/audit-inspection-planner/form", { scroll: false });
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load planner");
      } finally {
        if (!cancelled) setLoadingLegacyEdit(false);
      }
    };
    loadPlanner();
    return () => {
      cancelled = true;
    };
  }, [legacyEditId, router]);

  // Year drives the tracker: fetch that year's document or show an empty form.
  useEffect(() => {
    if (legacyEditId) return;
    let cancelled = false;
    const loadTracker = async () => {
      setLoadingTracker(true);
      setError("");
      try {
        const res = await fetch(
          `/api/qhse/audit-inspection-planner/by-year/${year}`
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || data.success === false) {
          throw new Error(data?.error || "Failed to load tracker for year");
        }
        if (data.data) {
          hydrateFromPlanner(data.data);
        } else {
          setTrackerDocumentId(null);
          setRowsByCategory(
            Object.fromEntries(defaultCategories.map((c) => [c.key, []]))
          );
          setSerialNumber("");
          setStatus("Draft");
          setTrackerSnapshotCount(0);
        }
        setFilesByRowId({});
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load tracker");
      } finally {
        if (!cancelled) setLoadingTracker(false);
      }
    };
    loadTracker();
    return () => {
      cancelled = true;
    };
  }, [year, legacyEditId]);

  const addRow = (catKey) => {
    const rowId = crypto.randomUUID();
    setRowsByCategory((prev) => ({
      ...prev,
      [catKey]: [
        ...(prev[catKey] || []),
        {
          id: rowId,
          rowId: rowId,
          description: "",
          frequency: "",
          dueBy: "",
          status: "",
          auditorName: "",
          auditDate: "",
          remarks: "",
        },
      ],
    }));
  };

  const updateCell = (catKey, rowId, field, value) => {
    setRowsByCategory((prev) => ({
      ...prev,
      [catKey]: (prev[catKey] || []).map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      ),
    }));
  };

  const removeRow = (catKey, rowId) => {
    if (!canSubmit) return;
    if (!confirm("Remove this row from the planner?")) return;
    setRowsByCategory((prev) => ({
      ...prev,
      [catKey]: (prev[catKey] || []).filter((row) => row.id !== rowId),
    }));
    setFilesByRowId((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const handleFileChange = (rowId, file) => {
    if (file) {
      // Validate file size (25MB max)
      if (file.size > 25 * 1024 * 1024) {
        setError(`File size exceeds 25MB limit for this row`);
        return;
      }

      // Validate file type
      const allowedExts = [".pdf", ".xlsx", ".xls", ".csv", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
      const ext = "." + file.name.split(".").pop().toLowerCase();
      if (!allowedExts.includes(ext)) {
        setError(`Invalid file type. Allowed: ${allowedExts.join(", ")}`);
        return;
      }

      setFilesByRowId((prev) => ({
        ...prev,
        [rowId]: file,
      }));
      setError("");
    }
  };

  const handleRemoveFile = (rowId) => {
    setFilesByRowId((prev) => {
      const newFiles = { ...prev };
      delete newFiles[rowId];
      return newFiles;
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      // Prepare form data
      const formData = new FormData();

      // Prepare categories with rowId
      const categoriesData = categories.map((cat) => ({
        key: cat.key,
        title: cat.title,
        rows: (cat.rows || []).map(({ id, ...rest }) => ({
          ...rest,
          rowId: rest.rowId || id, // Ensure rowId is present
        })),
      }));

      // Add JSON data
      const payload = {
        issueDate: formMeta.issueDate,
        approvedBy: formMeta.approvedBy,
        categories: categoriesData,
        year,
      };

      formData.append("data", JSON.stringify(payload));

      // Add files
      Object.entries(filesByRowId).forEach(([rowId, file]) => {
        if (file) {
          formData.append(`file_${rowId}`, file);
        }
      });

      const res = await fetch("/api/qhse/audit-inspection-planner/create", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save planner");

      const savedCode = data?.data?.formCode || "—";
      const savedSerial = data?.data?.serialNumber || "—";
      const mode = data?.mode;
      setSuccess(
        mode === "updated"
          ? `Saved planner for ${year} (Serial: ${savedSerial}).`
          : savedSerial !== "—"
            ? `Planner started for ${year}. Form code: ${savedCode} • Serial: ${savedSerial}`
            : `Planner started for ${year}. Form code: ${savedCode}`
      );
      if (data?.data?.formCode) setFormCode(data.data.formCode);
      if (data?.data?.serialNumber) setSerialNumber(data.data.serialNumber);
      if (data?.data?.version) setVersion(data.data.version);
      if (data?.data?.categories) {
        // After saving, refresh the local snapshot count so the
        // "previously saved" hint and row data reflect what the server now
        // holds (including freshly persisted file URLs).
        hydrateFromPlanner(data.data);
      }

      setFilesByRowId({});

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Failed to save planner");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingLegacyEdit) {
    return (
      <div className={`${contentClassName} w-full min-w-0 pr-4 flex items-center justify-center py-20`}>
        <p className="text-slate-300">Loading planner…</p>
      </div>
    );
  }

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
              QHSE / Audit & Inspection Planner
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Audit & Inspection Planner</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-048</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-048" />
          </div>
        </header>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400 min-w-[100px]"
              >
                {getYears().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {(error || success) && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium border ${
                error
                  ? "bg-red-950/40 border-red-500/40 text-red-200"
                  : "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
              }`}
            >
              {error || success}
            </div>
          )}

          <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            {loadingTracker ? (
              <span className="text-sky-200">Loading {year}…</span>
            ) : (
              <>
                <span className="font-semibold">Year {year}.</span>{" "}
                {trackerSnapshotCount > 0 ? (
                  <>
                    <span className="font-semibold">{trackerSnapshotCount}</span>{" "}
                    {trackerSnapshotCount === 1 ? "row" : "rows"} loaded — edit, delete
                    rows, attach files, then save. Change year above to load another year
                    (empty form if none saved yet).
                  </>
                ) : (
                  <>
                    No saved planner for {year} yet. Add rows below and save to create
                    one. Switch year anytime to work on a different year.
                  </>
                )}
              </>
            )}
          </div>

          {!canSubmit && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm">
              You do not have permission to edit this planner. Form is view-only.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
          {categories.map((cat) => (
            <section
              key={cat.key}
              className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
            >
              <div className="bg-white/10 px-6 py-3 font-semibold text-white">
                {cat.title}
              </div>
              <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-200 border-b border-white/10 bg-white/5">
                      {columns.map((col) => (
                        <th key={col.key} className="px-4 py-3 font-semibold">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(cat.rows || []).map((row) => {
                      const rowId = row.rowId || row.id;
                      const file = filesByRowId[rowId];
                      return (
                        <tr key={row.id} className="border-b border-white/5 align-middle">
                          {columns.map((col) => {
                            if (col.key === "actions") {
                              return (
                                <td
                                  key={col.key}
                                  className="px-4 py-2 align-middle whitespace-nowrap w-[1%]"
                                >
                                  {canSubmit ? (
                                    <div className="flex items-center justify-center gap-1 min-h-[42px]">
                                      <ActionEditIcon
                                        title="Focus description field"
                                        onClick={() => {
                                          const el = document.getElementById(
                                            auditPlannerDescInputId(cat.key, row.id)
                                          );
                                          el?.focus?.();
                                          el?.scrollIntoView?.({
                                            block: "nearest",
                                            behavior: "smooth",
                                          });
                                        }}
                                      />
                                      <ActionDeleteIcon
                                        title="Delete row"
                                        onClick={() => removeRow(cat.key, row.id)}
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center min-h-[42px]">
                                      <span className="text-white/30 text-xs">—</span>
                                    </div>
                                  )}
                                </td>
                              );
                            }
                            if (col.key === "file") {
                              const hasSavedFile = Boolean(row.fileUrl && row.fileName);
                              const downloadHref =
                                trackerDocumentId && row.fileUrl
                                  ? `/api/qhse/audit-inspection-planner/${trackerDocumentId}/row-attachment?rowId=${encodeURIComponent(rowId)}`
                                  : null;
                              return (
                                <td key={col.key} className="px-4 py-2 min-w-[200px] align-middle">
                                  <div className="space-y-2">
                                    {file ? (
                                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
                                        <div className="shrink-0">
                                          <svg
                                            className="h-5 w-5 text-emerald-400"
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
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-white truncate font-medium">
                                            {file.name}
                                          </p>
                                          <p className="text-[10px] text-slate-400">
                                            {formatFileSize(file.size)} · replaces file on save
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveFile(rowId)}
                                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded border border-red-400/40 bg-red-500/10 hover:bg-red-500/20 transition shrink-0"
                                          title="Remove new upload"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        {hasSavedFile && (
                                          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 space-y-1.5">
                                            <p className="text-[11px] text-white/80 truncate" title={row.fileName}>
                                              {row.fileName}
                                            </p>
                                            {(canView || canDownload) && downloadHref ? (
                                              <a
                                                href={downloadHref}
                                                download={row.fileName || "attachment"}
                                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-sky-200 underline"
                                              >
                                                Download
                                              </a>
                                            ) : (
                                              <span className="text-[10px] text-white/40">
                                                Save planner once to enable download
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        {canSubmit ? (
                                          <label className={`block ${hasSavedFile ? "mt-1" : ""}`}>
                                            <input
                                              type="file"
                                              onChange={(e) =>
                                                handleFileChange(rowId, e.target.files?.[0] || null)
                                              }
                                              accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.jpg,.jpeg,.png"
                                              className="hidden"
                                            />
                                            <div className="cursor-pointer px-3 py-2 rounded-lg bg-white/5 border border-dashed border-white/20 hover:bg-white/10 hover:border-white/30 transition text-xs text-white text-center flex items-center justify-center gap-1.5">
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
                                              {hasSavedFile ? "Replace file" : "Upload file"}
                                            </div>
                                          </label>
                                        ) : null}
                                      </>
                                    )}
                                  </div>
                                </td>
                              );
                            }
                            return (
                              <td key={col.key} className="px-4 py-2 align-middle">
                                <input
                                  id={
                                    col.key === "description"
                                      ? auditPlannerDescInputId(cat.key, row.id)
                                      : undefined
                                  }
                                  type={col.key === "auditDate" ? "date" : "text"}
                                  value={row[col.key] ?? ""}
                                  onChange={(e) =>
                                    updateCell(cat.key, row.id, col.key, e.target.value)
                                  }
                                  disabled={!canSubmit}
                                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4">
                <button
                  type="button"
                  onClick={() => addRow(cat.key)}
                  className="px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition"
                >
                  + Add Row
                </button>
              </div>
            </section>
          ))}

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/10">
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-lg border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition"
            >
              Back to dashboard
            </Link>
            <button
              type="submit"
              disabled={!canSubmit || submitting || loadingTracker}
              className="px-6 py-3 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving…" : "Save planner"}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

