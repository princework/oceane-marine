"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useHrLoading } from "../../HrLoadingContext";
import { useHrRole } from "@/hooks/useHrRole";

export default function StatutoryCertificatesFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { setPageLoading } = useHrLoading();
  const { canCreate, canEdit } = useHrRole();
  const canSubmit = editId ? canEdit : canCreate;

  const [location, setLocation] = useState("");
  const [typeOfDocs, setTypeOfDocs] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [validity, setValidity] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [existingFile, setExistingFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load certificate data if editing
  useEffect(() => {
    if (editId) {
      const loadData = async () => {
        try {
          setLoadingData(true);
          setPageLoading(true);
          const res = await fetch(`/api/hr/statutory-certificates/list`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load");
          const cert = data.data?.find((c) => c._id === editId);
          if (cert) {
            setLocation(cert.location || "");
            setTypeOfDocs(cert.typeOfDocs || "");
            setYear(cert.year || new Date().getFullYear().toString());
            setValidity(cert.validity ? new Date(cert.validity).toISOString().split("T")[0] : "");
            if (cert.attachment) {
              setExistingFile(cert.attachment);
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
  }, [editId]);

  // Generate years: current year and 10 years forward
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear; i <= currentYear + 10; i++) {
    years.push(i.toString());
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setMessage("");
    setLoading(true);
    setPageLoading(true);

    try {
      if (!location || !location.trim()) {
        throw new Error("Location is required");
      }
      if (!typeOfDocs || !typeOfDocs.trim()) {
        throw new Error("Type of document is required");
      }
      if (!year) {
        throw new Error("Year is required");
      }
      if (!validity || !validity.trim()) {
        throw new Error("Validity is required");
      }
      
      // File is required only for new records, optional for updates
      if (!editId && (!attachment || !attachment.name)) {
        throw new Error("Attachment file is required");
      }

      const formData = new FormData();
      formData.append("location", location.trim());
      formData.append("typeOfDocs", typeOfDocs.trim());
      formData.append("year", year);
      formData.append("validity", validity.trim());
      if (attachment) formData.append("attachment", attachment);

      const isEditing = !!editId;
      const url = isEditing
        ? `/api/hr/statutory-certificates/${editId}/update`
        : "/api/hr/statutory-certificates/create";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || `Failed to ${isEditing ? "update" : "create"} certificate`);
      }

      setMessage(`Statutory certificate ${isEditing ? "updated" : "created"} successfully!`);
      
      // Reset form
      setLocation("");
      setTypeOfDocs("");
      setYear(new Date().getFullYear().toString());
      setValidity("");
      setAttachment(null);
      setExistingFile(null);
      
      // Clear file input
      const fileInput = document.getElementById("attachment");
      if (fileInput) fileInput.value = "";

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/hr/statutory-certificates?tab=list");
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {editId ? "Edit Statutory Certificate" : "Statutory Certificates"}
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
            You do not have permission to {editId ? "edit" : "create"} statutory certificates.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location */}
          <div className="space-y-2">
            <label htmlFor="location" className="block text-sm font-semibold text-white/90">
              Location <span className="text-red-400">*</span>
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              readOnly={!canSubmit}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all read-only:opacity-70"
              placeholder="Enter location"
            />
          </div>

          {/* Type of Document */}
          <div className="space-y-2">
            <label htmlFor="typeOfDocs" className="block text-sm font-semibold text-white/90">
              Type of Document <span className="text-red-400">*</span>
            </label>
            <input
              id="typeOfDocs"
              type="text"
              value={typeOfDocs}
              onChange={(e) => setTypeOfDocs(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              placeholder="Enter type of document"
            />
          </div>

          {/* Year */}
          <div className="space-y-2">
            <label htmlFor="year" className="block text-sm font-semibold text-white/90">
              Year <span className="text-red-400">*</span>
            </label>
            <select
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
              disabled={!canSubmit}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all disabled:opacity-70"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-slate-900">
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Validity */}
          <div className="space-y-2">
            <label htmlFor="validity" className="block text-sm font-semibold text-white/90">
              Validity <span className="text-red-400">*</span>
            </label>
            <input
              id="validity"
              type="date"
              value={validity}
              onChange={(e) => setValidity(e.target.value)}
              required
              readOnly={!canSubmit}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all read-only:opacity-70"
            />
          </div>

          {/* Attachment */}
          <div className="space-y-2">
            <label htmlFor="attachment" className="block text-sm font-semibold text-white/90">
              Attachment {!editId && <span className="text-red-400">*</span>}
            </label>
            <input
              id="attachment"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setAttachment(e.target.files[0])}
              required={!editId && canSubmit}
              disabled={!canSubmit}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all disabled:opacity-50"
            />
            {editId && existingFile && !attachment && (
              <p className="text-sm text-white/60 mt-2">
                Current file: {existingFile.originalFileName || "File"} (Leave empty to keep existing file)
              </p>
            )}
            {attachment && (
              <p className="text-sm text-white/60 mt-2">
                Selected: {attachment.name} ({(attachment.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
            <p className="text-xs text-white/50 mt-1">
              Accepted formats: PDF, DOC, DOCX, XLS, XLSX
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={!canSubmit || loading || loadingData}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-orange-500/40 transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (editId ? "Updating..." : "Creating...") : (editId ? "Update Certificate" : "Create Certificate")}
            </button>
            <Link
              href="/hr/statutory-certificates?tab=list"
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
