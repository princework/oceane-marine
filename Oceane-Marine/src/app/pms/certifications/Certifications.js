"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ActionViewIcon,
  ActionEditIcon,
  ActionDeleteIcon,
} from "@/app/components/RecordActionIcons";
import { usePmsRole } from "@/hooks/usePmsRole";

export default function Certifications({ view: controlledView, onViewChange }) {
  const { canCreate, canEdit, canDelete, canDownload } = usePmsRole();

  const [internalView, setInternalView] = useState("form");
  const view = controlledView ?? internalView;
  const setView = onViewChange ?? setInternalView;

  const [locationName, setLocationName] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [testedBy, setTestedBy] = useState("");
  const [manufacturingFile, setManufacturingFile] = useState(null);
  const [testFile, setTestFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const canSubmit = editingId ? canEdit : canCreate;
  const [pmsLocations, setPmsLocations] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/pms/locations/list");
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data.locations)) {
          setPmsLocations(data.locations);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const certificationLocationNames = useMemo(() => {
    const names = (pmsLocations || [])
      .map((l) => (typeof l?.name === "string" ? l.name.trim() : ""))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    const set = new Set(names);
    const cur = locationName.trim();
    if (cur && !set.has(cur)) {
      names.push(cur);
      names.sort((a, b) => a.localeCompare(b));
    }
    return names;
  }, [pmsLocations, locationName]);

  // Fetch list
  const fetchList = async () => {
    try {
      setListLoading(true);
      setListError("");
      const res = await fetch("/api/pms/certifications/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems(data.data || []);
    } catch (err) {
      setListError(err.message);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (view === "list") {
      fetchList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setMessage("");

    if (!locationName.trim()) {
      setError("Location name is required");
      return;
    }
    if (!equipmentName.trim()) {
      setError("Equipment name is required");
      return;
    }
    if (!equipmentType.trim()) {
      setError("Equipment type is required");
      return;
    }
    if (!testedBy.trim()) {
      setError("Tested by is required");
      return;
    }
    // Files are required only for new records, optional for updates
    if (!editingId) {
      if (!manufacturingFile) {
        setError("Please upload Manufacturing Certificate");
        return;
      }
      if (!testFile) {
        setError("Please upload Test Certificate");
        return;
      }
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("locationName", locationName.trim());
      formData.append("equipmentName", equipmentName.trim());
      formData.append("equipmentType", equipmentType.trim());
      formData.append("testedBy", testedBy.trim());
      if (manufacturingFile) formData.append("manufacturingFile", manufacturingFile);
      if (testFile) formData.append("testFile", testFile);

      const isEditing = !!editingId;
      const url = isEditing
        ? `/api/pms/certifications/${editingId}/update`
        : "/api/pms/certifications/create";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || `Failed to ${isEditing ? "update" : "save"}`);

      setMessage(isEditing ? "Updated successfully" : "Saved successfully");
      setLocationName("");
      setEquipmentName("");
      setEquipmentType("");
      setTestedBy("");
      setManufacturingFile(null);
      setTestFile(null);
      setEditingId(null);
      setTimeout(() => {
        setView("list");
        setMessage("");
        fetchList();
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    if (!canEdit) return;
    setEditingId(item._id);
    setLocationName(item.locationName || "");
    setEquipmentName(item.equipmentName || "");
    setEquipmentType(item.equipmentType || "");
    setTestedBy(item.testedBy || "");
    setManufacturingFile(null);
    setTestFile(null);
    setError("");
    setMessage("");
    setView("form");
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    if (!confirm("Are you sure you want to delete this certificate? This action cannot be undone.")) {
      return;
    }

    try {
      setDeletingId(id);
      setListError("");
      const res = await fetch(`/api/pms/certifications/${id}/delete`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to delete");

      setMessage("Certificate deleted successfully");
      setTimeout(() => {
        setMessage("");
        fetchList();
      }, 800);
    } catch (err) {
      setListError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setLocationName("");
    setEquipmentName("");
    setEquipmentType("");
    setTestedBy("");
    setManufacturingFile(null);
    setTestFile(null);
    setError("");
    setMessage("");
    setView("list");
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="relative">
        <div className="text-center">
          <p className="text-xs tracking-widest text-sky-300">
            PMS / Certifications
          </p>
          <h2 className="text-xl font-bold text-white">
            Certifications
          </h2>
        </div>
        {/* Close button when editing - aligned with header */}
        {editingId && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="absolute top-0 right-0 p-2.5 rounded-lg bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 text-red-300 hover:text-red-200 transition shadow-lg"
            aria-label="Close edit mode"
            title="Cancel editing"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* MESSAGES */}
      {error && (
        <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-200 text-sm font-medium">
          {message}
        </div>
      )}

      {/* FORM VIEW */}
      {view === "form" && (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6"
        >
          {!canSubmit && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
              You do not have permission to {editingId ? "edit" : "create"} certificate records.
            </div>
          )}
          <fieldset
            disabled={!canSubmit}
            className="border-0 p-0 m-0 min-w-0 space-y-6 disabled:opacity-[0.88]"
          >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="cert-location-name-inline" className="text-sm text-slate-200">
                Location Name *
              </label>
              <select
                id="cert-location-name-inline"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white focus:outline-none focus:border-sky-400"
                required
              >
                <option value="">Select location</option>
                {certificationLocationNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {certificationLocationNames.length === 0 && (
                <p className="text-xs text-amber-200/90">
                  No locations yet. Ask a PMS admin to add them under PMS → Location.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Equipment Name *</label>
              <input
                value={equipmentName}
                onChange={(e) => setEquipmentName(e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white focus:outline-none focus:border-sky-400"
                placeholder="Enter equipment name"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Equipment Type *</label>
              <input
                value={equipmentType}
                onChange={(e) => setEquipmentType(e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white focus:outline-none focus:border-sky-400"
                placeholder="Enter equipment type"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Tested By *</label>
              <input
                value={testedBy}
                onChange={(e) => setTestedBy(e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-white focus:outline-none focus:border-sky-400"
                placeholder="Enter tester name"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Manufacturing Certificate *</label>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    id="manufacturing-file"
                    type="file"
                    onChange={(e) => setManufacturingFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    required
                  />
                  <label
                    htmlFor="manufacturing-file"
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
                        <span className="font-semibold">Click to upload</span> Manufacturing Certificate
                      </p>
                      <p className="text-xs text-slate-400">
                        PDF, Excel, Word, Images (MAX. 25MB)
                      </p>
                    </div>
                  </label>
                </div>
                {manufacturingFile && (
                  <div className="text-xs text-emerald-200 bg-emerald-900/30 border border-emerald-500/30 rounded-lg px-3 py-2">
                    Selected: {manufacturingFile.name}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-200">Test Certificate *</label>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    id="test-file"
                    type="file"
                    onChange={(e) => setTestFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    required
                  />
                  <label
                    htmlFor="test-file"
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
                        <span className="font-semibold">Click to upload</span> Test Certificate
                      </p>
                      <p className="text-xs text-slate-400">
                        PDF, Excel, Word, Images (MAX. 25MB)
                      </p>
                    </div>
                  </label>
                </div>
                {testFile && (
                  <div className="text-xs text-emerald-200 bg-emerald-900/30 border border-emerald-500/30 rounded-lg px-3 py-2">
                    Selected: {testFile.name}
                  </div>
                )}
              </div>
            </div>
          </div>
          </fieldset>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setLocationName("");
                setEquipmentName("");
                setEquipmentType("");
                setTestedBy("");
                setManufacturingFile(null);
                setTestFile(null);
                setError("");
                setEditingId(null);
              }}
              className="px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 transition"
            >
              {editingId ? "Cancel" : "Clear"}
            </button>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="px-4 py-2 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition disabled:opacity-50"
            >
              {loading ? (editingId ? "Updating..." : "Saving...") : (editingId ? "Update" : "Save")}
            </button>
          </div>
        </form>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="space-y-4">
          {listError && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
              {listError}
            </div>
          )}

          <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5">
            <div className="grid grid-cols-6 rounded-t-2xl text-xs uppercase tracking-wide text-slate-300 bg-white/5 px-4 py-3">
              <div>Location</div>
              <div>Equipment Name</div>
              <div>Equipment Type</div>
              <div>Tested By</div>
              <div>Date</div>
              <div className="text-right">Action</div>
            </div>

            {listLoading ? (
              <div className="p-6 text-sm text-slate-300">Loading...</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-sm text-slate-300">No records found.</div>
            ) : (
              <div className="min-w-0 divide-y divide-white/10">
                {items.map((item) => (
                  <div
                    key={item._id}
                    className="grid grid-cols-6 items-center px-4 py-3 text-sm"
                  >
                    <div className="font-medium text-white">{item.locationName}</div>
                    <div className="text-slate-200">{item.equipmentName || "—"}</div>
                    <div className="text-slate-200">{item.equipmentType || "—"}</div>
                    <div className="text-slate-200">{item.testedBy || "—"}</div>
                    <div className="text-slate-400">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : "-"}
                    </div>
                    <div className="text-right flex items-center justify-end gap-2">
                      <ActionViewIcon
                        onClick={() => setSelectedItem(item)}
                        disabled={deletingId === item._id}
                        title="View certificate"
                      />
                      {canEdit && (
                        <ActionEditIcon
                          onClick={() => handleEdit(item)}
                          disabled={deletingId === item._id}
                          title="Edit certificate"
                        />
                      )}
                      {canDelete && (
                        <ActionDeleteIcon
                          onClick={() => handleDelete(item._id)}
                          disabled={deletingId === item._id || !!deletingId}
                          loading={deletingId === item._id}
                          title="Delete certificate"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODAL - rendered via Portal to document.body so it's truly centered on viewport */}
      {selectedItem && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedItem(null);
            }
          }}
        >
          <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 rounded-2xl border border-white/20 shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-slate-800 border-b border-white/10 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 shadow-lg shadow-sky-500/30">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Certificate Details</h3>
                  <p className="text-xs text-slate-300 mt-0.5">View complete certificate information</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Location</p>
                  </div>
                  <p className="text-base font-semibold text-white">{selectedItem.locationName}</p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Equipment Name</p>
                  </div>
                  <p className="text-base font-semibold text-white">{selectedItem.equipmentName || "—"}</p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Equipment Type</p>
                  </div>
                  <p className="text-base font-semibold text-white">{selectedItem.equipmentType || "—"}</p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Tested By</p>
                  </div>
                  <p className="text-base font-semibold text-white">{selectedItem.testedBy || "—"}</p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Date</p>
                  </div>
                  <p className="text-base font-semibold text-white">
                    {selectedItem.createdAt
                      ? new Date(selectedItem.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Certificates Section */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Certificates</h4>
                </div>
                <div className="space-y-3">
                  {selectedItem.manufacturingCertificate?.fileUrl && (
                    <div className="group p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 hover:border-emerald-500/50 transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex-shrink-0">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white mb-1">Manufacturing Certificate</p>
                            <p className="text-xs text-slate-300 truncate">
                              {selectedItem.manufacturingCertificate.originalFileName || "—"}
                            </p>
                          </div>
                        </div>
                        {canDownload ? (
                        <a
                          href={`/api/pms/certifications/${selectedItem._id}/download?type=manufacturing`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download"
                          aria-label="Download manufacturing certificate"
                          className="inline-flex items-center justify-center rounded-lg border border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/15 p-2 transition flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                        ) : (
                          <span className="text-[10px] text-white/35">No download</span>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedItem.testCertificate?.fileUrl && (
                    <div className="group p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-blue-500/5 border border-blue-500/30 hover:border-blue-500/50 transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-500/30 flex-shrink-0">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white mb-1">Test Certificate</p>
                            <p className="text-xs text-slate-300 truncate">
                              {selectedItem.testCertificate.originalFileName || "—"}
                            </p>
                          </div>
                        </div>
                        {canDownload ? (
                        <a
                          href={`/api/pms/certifications/${selectedItem._id}/download?type=test`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download"
                          aria-label="Download test certificate"
                          className="inline-flex items-center justify-center rounded-lg border border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/15 p-2 transition flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                        ) : (
                          <span className="text-[10px] text-white/35">No download</span>
                        )}
                      </div>
                    </div>
                  )}
                  {!selectedItem.manufacturingCertificate?.fileUrl && !selectedItem.testCertificate?.fileUrl && (
                    <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
                      <svg className="w-12 h-12 text-slate-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm text-slate-400">No certificates available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
