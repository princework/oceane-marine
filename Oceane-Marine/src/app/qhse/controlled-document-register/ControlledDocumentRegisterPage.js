"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQhseSidebar } from "../QhseSidebarContext";
import { useQhseRole } from "@/hooks/useQhseRole";
import Link from "next/link";
import {
  ActionEditIcon,
  ActionEditIconLink,
  ActionDeleteIcon,
} from "@/app/components/RecordActionIcons";
import ControlledDocumentEntriesSection from "./ControlledDocumentEntriesSection";

/** Matches RecordActionIcons ActionDownloadIcon anchor styling */
const downloadIconLinkClass =
  "inline-flex items-center justify-center rounded-lg border border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/15 min-w-[34px] min-h-[34px] p-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeEntryDocCount(value) {
  if (typeof value === "number" && !Number.isNaN(value))
    return Math.max(0, Math.floor(value));
  const n = Number.parseInt(String(value ?? "0"), 10);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

function entryRevLabel(row) {
  if (row?.revNo) return row.revNo;
  return `${row?.revMajor ?? 1}.${row?.revMinor ?? 0}`;
}

function departmentBadgeClass(department) {
  if (department === "QHSE")
    return "bg-sky-500/20 text-sky-300 border border-sky-500/40";
  if (department === "Operations")
    return "bg-amber-500/20 text-amber-300 border border-amber-500/40";
  if (department === "PMS")
    return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
  if (department === "HR")
    return "bg-violet-500/20 text-violet-300 border border-violet-500/40";
  return "bg-slate-500/20 text-slate-300 border border-slate-500/40";
}

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [
  { value: "", label: "All years" },
  ...Array.from({ length: 16 }, (_, i) => currentYear - i).map((y) => ({
    value: String(y),
    label: String(y),
  })),
];

export default function ControlledDocumentRegisterPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { canCreate, canEdit, canDelete, canDownload } = useQhseRole();
  const router = useRouter();
  const entriesSectionRef = useRef(null);
  const [createFormSignal, setCreateFormSignal] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [year, setYear] = useState("");

  const [controlledEntries, setControlledEntries] = useState([]);
  const [controlledLoading, setControlledLoading] = useState(true);
  const [controlledNotice, setControlledNotice] = useState(null);

  const loadControlledEntries = useCallback(async () => {
    setControlledLoading(true);
    try {
      const res = await fetch("/api/qhse/controlled-document-entry/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load entries");
      setControlledEntries(data.data || []);
    } catch (err) {
      setControlledNotice({
        type: "error",
        text: err.message || "Failed to load controlled document entries",
      });
      setControlledEntries([]);
    } finally {
      setControlledLoading(false);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setPageLoading(true);
    setError("");
    try {
      const url = year
        ? `/api/qhse/controlled-document-register/dynamic?year=${encodeURIComponent(year)}`
        : "/api/qhse/controlled-document-register/dynamic";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems(data.data || []);
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year]);

  useEffect(() => {
    loadControlledEntries();
  }, [loadControlledEntries]);

  useEffect(() => {
    if (!controlledNotice?.text) return;
    const t = setTimeout(() => setControlledNotice(null), 6000);
    return () => clearTimeout(t);
  }, [controlledNotice]);

  const handleCreateFormClick = () => {
    setCreateFormSignal((n) => n + 1);
  };

  const handleDeleteControlledEntry = async (row) => {
    if (!canDelete) return;
    if (
      !confirm(
        `Delete controlled document "${row.title || row.formCode}"? This cannot be undone.`
      )
    ) {
      return;
    }
    setControlledNotice(null);
    try {
      const res = await fetch(`/api/qhse/controlled-document-entry/${row._id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setControlledNotice({ type: "success", text: "Entry deleted." });
      await loadControlledEntries();
    } catch (err) {
      setControlledNotice({
        type: "error",
        text: err.message || "Delete failed",
      });
    }
  };

  const registerDocSum = items.reduce(
    (sum, r) => sum + (r.documents ?? r.documentCount ?? 0),
    0
  );
  const controlledDocSum = controlledEntries.reduce(
    (sum, r) => sum + normalizeEntryDocCount(r.documents),
    0
  );
  const totalDocuments = registerDocSum + controlledDocSum;
  const totalRowCount = items.length + controlledEntries.length;

  const tableLoading = loading && items.length === 0 && !error;

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
              QHSE
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              Controlled Document Register
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Live index across modules; use Create form to add controlled document rows with
              revisions and file archive.
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center sm:items-end justify-center gap-2 sm:w-auto sm:self-auto shrink-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-4 gap-y-1">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="theme-select rounded-full px-3 py-1.5 text-sm tracking-wide bg-slate-800 border border-white/20 text-white focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 outline-none cursor-pointer"
                  aria-label="Filter documents by year"
                >
                  {YEAR_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-300 shrink-0">
                <span>
                  <span className="text-white font-semibold">{totalRowCount}</span> rows
                </span>
                <span>
                  <span className="text-white font-semibold">{totalDocuments}</span> total documents
                </span>
              </div>
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={handleCreateFormClick}
                className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 shadow-lg shadow-sky-900/30 mt-0.5 sm:self-end"
              >
                Create form
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        {controlledNotice && (
          <div
            className={
              controlledNotice.type === "error"
                ? "rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-red-200 text-sm"
                : "rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-emerald-200 text-sm"
            }
          >
            {controlledNotice.text}
          </div>
        )}

        <ControlledDocumentEntriesSection
          ref={entriesSectionRef}
          createFormSignal={createFormSignal}
          onEntriesMutated={loadControlledEntries}
        />

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          {tableLoading ? (
            <div className="p-8 text-center text-slate-300 text-sm">
              Loading document register…
            </div>
          ) : items.length === 0 && controlledEntries.length === 0 && !controlledLoading ? (
            <div className="p-8 text-center text-slate-300 text-sm">No documents found.</div>
          ) : (
            <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="min-w-full text-sm text-left text-slate-200 border-collapse">
                <thead>
                  <tr className="bg-[#366092] text-white">
                    <th className="border border-slate-400/50 px-3 py-2.5 font-semibold uppercase tracking-wide w-12">
                      No
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 font-semibold uppercase tracking-wide min-w-[100px]">
                      Form Code
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 font-semibold uppercase tracking-wide min-w-[200px]">
                      Title
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 font-semibold uppercase tracking-wide w-24 text-center">
                      Documents
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 font-semibold uppercase tracking-wide w-28">
                      Issue Date
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 font-semibold uppercase tracking-wide w-20 text-center">
                      Rev No
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 font-semibold uppercase tracking-wide w-28">
                      Department
                    </th>
                    <th className="border border-slate-400/50 px-3 py-2.5 font-semibold uppercase tracking-wide min-w-[140px] text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((row, index) => (
                    <tr
                      key={`reg-${row.formCode || row.title}-${index}`}
                      onClick={() => row.href && router.push(row.href)}
                      className="hover:bg-sky-500/10 bg-slate-800/30 cursor-pointer transition"
                      title={row.href ? `Go to ${row.title}` : undefined}
                    >
                      <td className="border border-slate-400/40 px-3 py-2 text-slate-400">
                        {index + 1}
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2 font-mono text-sky-300">
                        {row.formCode || "—"}
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2 text-white">
                        {row.title || "—"}
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2 text-center">
                        {(row.documents ?? row.documentCount ?? 0) > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                            {row.documents ?? row.documentCount ?? 0}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">0</span>
                        )}
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2 text-slate-300 text-xs whitespace-nowrap">
                        {formatDate(row.revisionDate ?? row.issueDate)}
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2 text-center text-slate-300 text-xs">
                        {row.revno ?? "—"}
                      </td>
                      <td className="border border-slate-400/40 px-3 py-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${departmentBadgeClass(
                            row.department
                          )}`}
                        >
                          {row.department || "—"}
                        </span>
                      </td>
                      <td
                        className="border border-slate-400/40 px-3 py-2 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {canEdit && row.href ? (
                            <ActionEditIconLink
                              href={row.href}
                              title={`Open ${row.title || row.formCode} — view / edit records`}
                            />
                          ) : null}
                          {canDelete && row.href ? (
                            <ActionDeleteIcon
                              title={`Open ${row.title || row.formCode} — delete records from the module list`}
                              onClick={() => router.push(row.href)}
                            />
                          ) : null}
                          {row.templatePath ? (
                            <a
                              href={row.templatePath}
                              download
                              className={downloadIconLinkClass}
                              title={`Download template: ${row.title}`}
                              aria-label={`Download template for ${row.title}`}
                            >
                              <svg
                                className="w-4 h-4 shrink-0"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                viewBox="0 0 24 24"
                                aria-hidden
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                              </svg>
                            </a>
                          ) : (
                            <span className="inline-flex min-w-[34px] min-h-[34px] items-center justify-center text-slate-500 text-xs">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {controlledLoading && (
                    <tr className="bg-slate-800/20">
                      <td
                        colSpan={8}
                        className="border border-slate-400/40 px-3 py-3 text-center text-slate-400 text-xs"
                      >
                        Loading controlled document entries…
                      </td>
                    </tr>
                  )}

                  {!controlledLoading &&
                    controlledEntries.map((row, i) => {
                      const rowNo = items.length + i + 1;
                      const cnt = normalizeEntryDocCount(row.documents);
                      const dept = row.department?.trim() || "";
                      return (
                        <tr
                          key={row._id}
                          className="hover:bg-sky-500/10 bg-slate-800/30 cursor-default transition"
                        >
                          <td className="border border-slate-400/40 px-3 py-2 text-slate-400">
                            {rowNo}
                          </td>
                          <td className="border border-slate-400/40 px-3 py-2 font-mono text-sky-300">
                            {row.formCode || "—"}
                          </td>
                          <td className="border border-slate-400/40 px-3 py-2 text-white">
                            {row.title || "—"}
                          </td>
                          <td className="border border-slate-400/40 px-3 py-2 text-center">
                            {cnt > 0 ? (
                              <span className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                                {cnt}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">0</span>
                            )}
                          </td>
                          <td className="border border-slate-400/40 px-3 py-2 text-slate-300 text-xs whitespace-nowrap">
                            {formatDate(row.issueDate)}
                          </td>
                          <td className="border border-slate-400/40 px-3 py-2 text-center font-mono text-sky-200 text-xs">
                            {entryRevLabel(row)}
                          </td>
                          <td className="border border-slate-400/40 px-3 py-2">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${departmentBadgeClass(
                                dept
                              )}`}
                            >
                              {dept || "—"}
                            </span>
                          </td>
                          <td className="border border-slate-400/40 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {canEdit && (
                                <ActionEditIcon
                                  title={`Edit ${row.title || row.formCode || "entry"}`}
                                  onClick={() =>
                                    entriesSectionRef.current?.openEdit(row)
                                  }
                                />
                              )}
                              {canDelete && (
                                <ActionDeleteIcon
                                  title={`Delete ${row.title || row.formCode || "entry"}`}
                                  onClick={() => handleDeleteControlledEntry(row)}
                                />
                              )}
                              {canDownload && row.attachment?.filePath && (
                                <a
                                  href={`/api/qhse/controlled-document-entry/${row._id}/download/docx`}
                                  download
                                  className={downloadIconLinkClass}
                                  title="Download as Word"
                                  aria-label={`Download as Word: ${row.title || row.formCode || "document"}`}
                                >
                                  <svg
                                    className="w-4 h-4 shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    viewBox="0 0 24 24"
                                    aria-hidden
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
