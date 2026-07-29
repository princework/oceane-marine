"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { usePmsRole } from "@/hooks/usePmsRole";

export default function CertificationsFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { canCreate, canEdit } = usePmsRole();
  const canSubmit = editId ? canEdit : canCreate;

  const [locationName, setLocationName] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [testedBy, setTestedBy] = useState("");
  const [manufacturingFile, setManufacturingFile] = useState(null);
  const [testFile, setTestFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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
        /* dropdown stays empty */
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

  // Load certificate data if editing
  useEffect(() => {
    if (editId) {
      const loadData = async () => {
        try {
          setLoadingData(true);
          const res = await fetch(`/api/pms/certifications/list`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load");
          const cert = data.data?.find((c) => c._id === editId);
          if (cert) {
            setLocationName(cert.locationName || "");
            setEquipmentName(cert.equipmentName || "");
            setEquipmentType(cert.equipmentType || "");
            setTestedBy(cert.testedBy || "");
          }
        } catch (err) {
          setError(err.message);
        } finally {
          setLoadingData(false);
        }
      };
      loadData();
    }
  }, [editId]);

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
    if (!editId) {
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

      const isEditing = !!editId;
      const url = isEditing
        ? `/api/pms/certifications/${editId}/update`
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
      setTimeout(() => router.push("/pms/certifications/list"), 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 pr-4">
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-10 space-y-4 sm:space-y-6">
        <header className="mt-12 md:mt-0 mb-2 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <Link
            href="/dashboard"
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-[2px] transition flex-shrink-0"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              PMS / Certifications
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">{editId ? "Edit Certificate" : "New Certificate"}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 self-end sm:self-auto">
            {editId && (
              <button
                type="button"
                onClick={() => router.push("/pms/certifications/list")}
                className="p-2 rounded-lg bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 text-red-300 hover:text-red-200 transition shadow-lg"
                aria-label="Close edit mode"
                title="Cancel editing"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <div className="inline-flex rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/pms/certifications/form"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Certificate Form
              </Link>
              <Link
                href="/pms/certifications/list"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Certificate List
              </Link>
            </div>
          </div>
        </header>

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

        {loadingData && (
          <div className="rounded-xl border border-white/15 bg-[#0b2740]/70 backdrop-blur-[2px] px-4 py-3 text-slate-200 text-sm font-medium">
            Loading certificate data...
          </div>
        )}

        {!canSubmit && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
            You do not have permission to {editId ? "edit" : "create"} certificate records.
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0b2740]/85 backdrop-blur-[2px] p-4 sm:p-6 shadow-2xl max-w-6xl mx-auto"
        >
          <fieldset
            disabled={!canSubmit}
            className="border-0 p-0 m-0 min-w-0 space-y-6 disabled:opacity-[0.88]"
          >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="cert-location-name" className="text-sm text-slate-200">
                Location Name *
              </label>
              <select
                id="cert-location-name"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
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
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="Enter equipment name"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Equipment Type *</label>
              <input
                value={equipmentType}
                onChange={(e) => setEquipmentType(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="Enter equipment type"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Tested By *</label>
              <input
                value={testedBy}
                onChange={(e) => setTestedBy(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="Enter tester name"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-200">
                Manufacturing Certificate {!editId && "*"}
                {editId && <span className="text-xs text-slate-400">(optional - leave empty to keep existing)</span>}
              </label>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    id="manufacturing-file"
                    type="file"
                    onChange={(e) => setManufacturingFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    required={!editId}
                  />
                  <label
                    htmlFor="manufacturing-file"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 hover:border-sky-400/40 transition group"
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
              <label className="text-sm text-slate-200">
                Test Certificate {!editId && "*"}
                {editId && <span className="text-xs text-slate-400">(optional - leave empty to keep existing)</span>}
              </label>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    id="test-file"
                    type="file"
                    onChange={(e) => setTestFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    required={!editId}
                  />
                  <label
                    htmlFor="test-file"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 hover:border-sky-400/40 transition group"
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
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="px-4 py-2 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition disabled:opacity-50"
            >
              {loading ? (editId ? "Updating..." : "Saving...") : (editId ? "Update" : "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

