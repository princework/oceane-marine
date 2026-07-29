"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useHrLoading } from "../../HrLoadingContext";
import { useHrRole } from "@/hooks/useHrRole";

/* ── Yes/No option fields that can have conditional file upload ── */
const YES_NO_OPTIONS = [
  { key: "validPassport", label: "Valid Passport", required: true },
  { key: "validMastersCOC", label: "Valid Master's COC", required: true },
  { key: "dangerousCargoEndorsementOil", label: "Dangerous cargo endorsement (Oil)", required: false },
  { key: "dangerousCargoEndorsementChem", label: "Dangerous cargo endorsement (Chem)", required: false },
  { key: "dangerousCargoEndorsementGas", label: "Dangerous cargo endorsements (Gas)", required: false },
  { key: "oilSpillResponseTraining", label: "Oil spill response training", required: false },
  { key: "stsSimulatorTraining", label: "STS Simulator training", required: false },
  { key: "vesselSizeLimitations", label: "Vessel Size Limitations", required: false },
  { key: "underwayOperations", label: "Underway operations", required: false },
  { key: "validMedicals", label: "Valid Medicals", required: false },
];

/** No expiry date field when "Yes" — certificate-only items */
const NO_EXPIRY_WHEN_YES_KEYS = new Set([
  "dangerousCargoEndorsementOil",
  "dangerousCargoEndorsementChem",
  "dangerousCargoEndorsementGas",
  "oilSpillResponseTraining",
  "stsSimulatorTraining",
  "vesselSizeLimitations",
  "underwayOperations",
]);

/** Migrate legacy visaLocation + visaValidity into per-location entries */
function normalizeVisaEntriesFromRow(row) {
  if (Array.isArray(row.visaEntries) && row.visaEntries.length > 0) {
    return row.visaEntries.map((e) => ({
      location: e.location || "",
      validity: e.validity || "",
    }));
  }
  const locs = Array.isArray(row.visaLocation) ? row.visaLocation : row.visaLocation ? [row.visaLocation] : [];
  const legacyValidity = row.visaValidity || "";
  return locs.map((location) => ({
    location,
    validity: locs.length === 1 ? legacyValidity : "",
  }));
}

/* ── Default row factory ── */
const createEmptyRow = (stsServiceProvider = "") => {
  const row = {
    stsServiceProvider,
    poacName: "",
    experienceWithOceane: "",
    visaEntries: [],
    remarks: "",
    newFiles: [],
    existingAttachments: [],
  };
  YES_NO_OPTIONS.forEach(({ key }) => {
    row[key] = "No";
    row[`${key}Expiry`] = "";
    row[`${key}File`] = null;
  });
  return row;
};

export default function PoacMatrixFormPage({ onSuccess }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { setPageLoading } = useHrLoading();
  const { canCreate, canEdit } = useHrRole();
  const canSubmit = editId ? canEdit : canCreate;

  const [rows, setRows] = useState([createEmptyRow()]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [existingFiles, setExistingFiles] = useState([]);
  const fileInputRefs = useRef({});
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    fetch("/api/master/locations/list")
      .then((res) => res.json())
      .then((data) => setLocations(data.locations || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (editId) {
      const loadData = async () => {
        try {
          setLoadingData(true);
          setPageLoading(true);
          const res = await fetch(`/api/hr/poac-matrix/list`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load");
          const record = data.data?.find((r) => r._id === editId);
          if (record && record.rows && record.rows.length > 0) {
            const loadedRows = record.rows.map((row) => {
              // Build existing attachments list (support both new array + legacy single)
              let existingAtts = [];
              if (row.attachments?.length > 0) {
                existingAtts = row.attachments.filter((a) => a.fileUrl);
              } else if (row.attachment?.fileUrl) {
                existingAtts = [row.attachment];
              }
              const r = {
                stsServiceProvider: row.stsServiceProvider || "",
                poacName: row.poacName || "",
                experienceWithOceane: row.experienceWithOceane || "",
                visaEntries: normalizeVisaEntriesFromRow(row),
                remarks: row.remarks || "",
                newFiles: [],
                existingAttachments: existingAtts,
              };
              YES_NO_OPTIONS.forEach(({ key }) => {
                r[key] = row[key] || "No";
                r[`${key}Expiry`] = row[`${key}Expiry`] || "";
                r[`${key}File`] = null;
              });
              return r;
            });
            setRows(loadedRows);

            // Store existing file info (main + per-option) for each row
            const files = record.rows.map((row) => {
              const obj = { attachment: row.attachment || null };
              YES_NO_OPTIONS.forEach(({ key }) => {
                obj[`${key}File`] = row[`${key}File`] || null;
              });
              return obj;
            });
            setExistingFiles(files);
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

  const addRow = () => {
    const firstProvider = rows.length > 0 ? rows[0].stsServiceProvider : "";
    setRows([...rows, createEmptyRow(firstProvider)]);
  };

  const removeRow = (index) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
      setExistingFiles((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };

    if (YES_NO_OPTIONS.some((o) => o.key === field)) {
      if (value === "No") {
        newRows[index][`${field}File`] = null;
        newRows[index][`${field}Expiry`] = "";
      } else if (value === "Yes" && NO_EXPIRY_WHEN_YES_KEYS.has(field)) {
        newRows[index][`${field}Expiry`] = "";
      }
    }
    setRows(newRows);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setMessage("");
    setLoading(true);
    setPageLoading(true);

    try {
      // Validate all rows
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.stsServiceProvider?.trim()) throw new Error(`Row ${i + 1}: STS Service Provider is required`);
        if (!row.poacName?.trim()) throw new Error(`Row ${i + 1}: POAC's Name is required`);
        if (!row.experienceWithOceane?.trim()) throw new Error(`Row ${i + 1}: Experience with Oceane is required`);
      }

      const formData = new FormData();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        formData.append(`row_${i}_stsServiceProvider`, (row.stsServiceProvider || "").trim());
        formData.append(`row_${i}_poacName`, (row.poacName || "").trim());
        formData.append(`row_${i}_experienceWithOceane`, (row.experienceWithOceane || "").trim());
        formData.append(`row_${i}_visaEntries`, JSON.stringify(row.visaEntries || []));
        formData.append(`row_${i}_remarks`, (row.remarks || "").trim());

        YES_NO_OPTIONS.forEach(({ key }) => {
          formData.append(`row_${i}_${key}`, row[key] || "No");
          const expiryVal = NO_EXPIRY_WHEN_YES_KEYS.has(key) ? "" : (row[`${key}Expiry`] || "").trim();
          formData.append(`row_${i}_${key}Expiry`, expiryVal);
          const file = row[`${key}File`];
          if (file) formData.append(`row_${i}_${key}File`, file);
        });

        // Multiple main attachments — new files
        for (const file of row.newFiles || []) {
          formData.append(`row_${i}_attachments`, file);
        }

        // For edit mode — tell server which existing attachments to keep
        if (editId) {
          const keepUrls = (row.existingAttachments || []).map((a) => a.fileUrl);
          formData.append(`row_${i}_keepAttachments`, JSON.stringify(keepUrls));
        }
      }

      const url = editId ? `/api/hr/poac-matrix/${editId}/update` : "/api/hr/poac-matrix/create";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, { method, body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || data.error || `Failed to ${editId ? "update" : "create"} record`);

      setMessage(editId ? "POAC Certification Matrix record updated successfully!" : "POAC Certification Matrix records created successfully!");
      setRows([createEmptyRow()]);
      setExistingFiles([]);

      setTimeout(() => {
        if (onSuccess) onSuccess();
        router.push("/hr/poac-matrix?tab=list");
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  /* ── Multi-file helpers per row ── */
  const handleAddFiles = (rowIndex, e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newRows = [...rows];
      newRows[rowIndex] = {
        ...newRows[rowIndex],
        newFiles: [...(newRows[rowIndex].newFiles || []), ...files],
      };
      setRows(newRows);
    }
    // Reset input so user can re-select same file
    if (fileInputRefs.current[rowIndex]) fileInputRefs.current[rowIndex].value = "";
  };

  const removeNewFile = (rowIndex, fileIndex) => {
    const newRows = [...rows];
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      newFiles: (newRows[rowIndex].newFiles || []).filter((_, i) => i !== fileIndex),
    };
    setRows(newRows);
  };

  const removeExistingAttachment = (rowIndex, attIndex) => {
    const newRows = [...rows];
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      existingAttachments: (newRows[rowIndex].existingAttachments || []).filter((_, i) => i !== attIndex),
    };
    setRows(newRows);
  };

  /* ── Reusable: Select field with conditional file upload ── */
  const SelectWithUpload = ({ rowIndex, option }) => {
    const { key, label, required: isRequired } = option;
    const row = rows[rowIndex];
    const value = row[key];
    const fileKey = `${key}File`;
    const existingFileInfo = existingFiles[rowIndex]?.[fileKey];
    const newFile = row[fileKey];

    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-white/90">
          {label} {isRequired && <span className="text-red-400">*</span>}
        </label>
        <select
          value={value}
          onChange={(e) => updateRow(rowIndex, key, e.target.value)}
          required={isRequired}
          className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
        >
          <option value="Yes" className="bg-slate-900">Yes</option>
          <option value="No" className="bg-slate-900">No</option>
        </select>

        {value === "Yes" && (
          <div className="mt-2 pl-3 border-l-2 border-orange-500/30 space-y-2">
            {/* Expiry date (not used for NO_EXPIRY_WHEN_YES_KEYS) */}
            {!NO_EXPIRY_WHEN_YES_KEYS.has(key) && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-orange-300/80">
                  Date of Expiry
                </label>
                <input
                  type="date"
                  value={row[`${key}Expiry`] || ""}
                  onChange={(e) => updateRow(rowIndex, `${key}Expiry`, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all [color-scheme:dark]"
                />
              </div>
            )}

            {/* Attachment */}
            <label className="block text-xs font-medium text-orange-300/80">
              Upload certificate / document for {label}
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              onChange={(e) => updateRow(rowIndex, fileKey, e.target.files[0])}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-500/80 file:text-white hover:file:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
            />
            {editId && existingFileInfo?.fileUrl && !newFile && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-emerald-300">
                  Current: <span className="font-medium text-emerald-200">{existingFileInfo.originalFileName || "File"}</span>
                  <span className="text-emerald-400/60 ml-1">(keep if empty)</span>
                </p>
              </div>
            )}
            {newFile && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <svg className="w-3.5 h-3.5 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-xs text-orange-300">
                  New: <span className="font-medium text-orange-200">{newFile.name}</span>
                  <span className="text-orange-400/60 ml-1">({(newFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  {existingFileInfo?.fileUrl && <span className="text-red-300/60 ml-1">— replaces existing</span>}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {editId ? "Edit POAC Certification Matrix" : "POAC Certification Matrix"}
            </h2>
            <p className="text-xs sm:text-sm text-white/60 mt-1">Form No: QAF-OFD-046</p>
          </div>
          <button
            type="button"
            onClick={addRow}
            disabled={!canSubmit}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Row
          </button>
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
            You do not have permission to {editId ? "edit" : "create"} POAC matrix records.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset disabled={!canSubmit} className="border-0 p-0 m-0 min-w-0 space-y-6 disabled:opacity-[0.85]">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="border border-white/10 rounded-xl p-6 space-y-4 bg-white/5">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">
                  Row {rowIndex + 1}
                </h3>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* STS Service Provider */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white/90">
                    STS Service Provider <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={row.stsServiceProvider}
                    onChange={(e) => updateRow(rowIndex, "stsServiceProvider", e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                    placeholder="Enter STS Service Provider"
                  />
                </div>

                {/* POAC's Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white/90">
                    POAC&apos;s Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={row.poacName}
                    onChange={(e) => updateRow(rowIndex, "poacName", e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                    placeholder="Enter POAC's Name"
                  />
                </div>

                {/* ── Yes/No option fields with conditional upload ── */}
                {YES_NO_OPTIONS.map((option) => (
                  <SelectWithUpload key={option.key} rowIndex={rowIndex} option={option} />
                ))}

                {/* Experience with Oceane */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white/90">
                    Experience with Oceane <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={row.experienceWithOceane}
                    onChange={(e) => updateRow(rowIndex, "experienceWithOceane", e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                    placeholder="e.g., > 1year, < 1 year"
                  />
                </div>

                {/* Visa – each location has its own expiry */}
                <div className="md:col-span-2 space-y-3">
                  <label className="block text-sm font-semibold text-white/90">
                    Visa – Location &amp; validity (per location)
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !(row.visaEntries || []).some((en) => en.location === val)) {
                        updateRow(rowIndex, "visaEntries", [...(row.visaEntries || []), { location: val, validity: "" }]);
                      }
                      e.target.value = "";
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all max-w-md"
                  >
                    <option value="" className="bg-slate-900">Add location...</option>
                    {locations
                      .filter((loc) => !(row.visaEntries || []).some((en) => en.location === loc.name))
                      .map((loc) => (
                        <option key={loc._id} value={loc.name} className="bg-slate-900">
                          {loc.name}
                        </option>
                      ))}
                  </select>
                  {(row.visaEntries || []).length > 0 && (
                    <div className="space-y-2">
                      {(row.visaEntries || []).map((entry, vi) => (
                        <div
                          key={`${entry.location}-${vi}`}
                          className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-white/50 block mb-1">Location</span>
                            <span className="text-sm font-medium text-orange-200">{entry.location}</span>
                          </div>
                          <div className="flex-1 sm:max-w-[220px]">
                            <label className="text-xs text-white/50 block mb-1">Date of expiry</label>
                            <input
                              type="date"
                              value={entry.validity || ""}
                              onChange={(e) => {
                                const next = [...(row.visaEntries || [])];
                                next[vi] = { ...next[vi], validity: e.target.value };
                                updateRow(rowIndex, "visaEntries", next);
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 [color-scheme:dark]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(
                                rowIndex,
                                "visaEntries",
                                (row.visaEntries || []).filter((_, idx) => idx !== vi)
                              )
                            }
                            className="shrink-0 px-3 py-2 rounded-lg text-red-300 hover:bg-red-500/15 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Remarks */}
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-white/90">
                    Remarks: Locations / etc
                  </label>
                  <textarea
                    value={row.remarks}
                    onChange={(e) => updateRow(rowIndex, "remarks", e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                    placeholder="Enter remarks, locations, etc."
                  />
                </div>

                {/* Multiple Attachments (Oil-Majors style) */}
                <div className="space-y-3 md:col-span-2">
                  {(() => {
                    const totalFiles = (row.existingAttachments || []).length + (row.newFiles || []).length;
                    return (
                      <>
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
                            onClick={() => fileInputRefs.current[rowIndex]?.click()}
                            className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg text-xs font-semibold transition border border-orange-500/30"
                          >
                            + Add Files
                          </button>
                        </div>

                        {/* Hidden file input (multiple) */}
                        <input
                          ref={(el) => (fileInputRefs.current[rowIndex] = el)}
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                          multiple
                          onChange={(e) => handleAddFiles(rowIndex, e)}
                          className="hidden"
                        />

                        {/* Existing files (edit mode) */}
                        {(row.existingAttachments || []).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-emerald-400/80 font-medium">Existing files:</p>
                            {row.existingAttachments.map((att, i) => (
                              <div key={`existing-${rowIndex}-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-emerald-300 flex-1 truncate">{att.originalFileName || "File"}</span>
                                <button
                                  type="button"
                                  onClick={() => removeExistingAttachment(rowIndex, i)}
                                  className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/15 transition"
                                  title="Remove file"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* New files to upload */}
                        {(row.newFiles || []).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-orange-400/80 font-medium">New files to upload:</p>
                            {row.newFiles.map((file, i) => (
                              <div key={`new-${rowIndex}-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <span className="text-sm text-orange-300 flex-1 truncate">{file.name}</span>
                                <span className="text-xs text-orange-400/60">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                <button
                                  type="button"
                                  onClick={() => removeNewFile(rowIndex, i)}
                                  className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/15 transition"
                                  title="Remove file"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
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
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
          </fieldset>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={!canSubmit || loading || loadingData}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-orange-500/40 transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (editId ? "Updating..." : "Creating...") : (editId ? "Update Record" : "Create Records")}
            </button>
            <Link
              href="/hr/poac-matrix?tab=list"
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
