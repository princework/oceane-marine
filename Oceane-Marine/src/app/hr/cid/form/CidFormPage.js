"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useHrLoading } from "../../HrLoadingContext";
import { useHrRole } from "@/hooks/useHrRole";

export default function CidFormPage({ onSuccess }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { setPageLoading } = useHrLoading();
  const { canCreate, canEdit } = useHrRole();
  const canSubmit = editId ? canEdit : canCreate;

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [validity, setValidity] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load data if editing
  useEffect(() => {
    if (editId) {
      const loadData = async () => {
        try {
          setLoadingData(true);
          setPageLoading(true);
          const res = await fetch("/api/hr/cid/list");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load");
          const record = data.data?.find((r) => r._id === editId);
          if (record) {
            setTitle(record.title || "");
            setName(record.name || "");
            setLocation(record.location || "");
            setValidity(
              record.validity
                ? new Date(record.validity).toISOString().split("T")[0]
                : ""
            );
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setMessage("");
    setLoading(true);
    setPageLoading(true);

    try {
      if (!title.trim()) throw new Error("Title is required");
      if (!name.trim()) throw new Error("Name is required");
      if (!location.trim()) throw new Error("Location is required");
      if (!validity) throw new Error("Validity is required");

      const payload = {
        title: title.trim(),
        name: name.trim(),
        location: location.trim(),
        validity,
      };

      const url = editId
        ? `/api/hr/cid/${editId}/update`
        : "/api/hr/cid/create";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || data.error || `Failed to ${editId ? "update" : "create"} record`
        );
      }

      setMessage(
        editId
          ? "CID record updated successfully!"
          : "CID record created successfully!"
      );

      // Reset form
      setTitle("");
      setName("");
      setLocation("");
      setValidity("");

      // Redirect after 2 seconds
      setTimeout(() => {
        if (onSuccess) onSuccess();
        router.push("/hr/cid?tab=list");
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
            {editId ? "Edit CID" : "CID"}
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
            You do not have permission to {editId ? "edit" : "create"} CID records.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <label
              htmlFor="cid-title"
              className="block text-sm font-semibold text-white/90"
            >
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="cid-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              readOnly={!canSubmit}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all read-only:opacity-70"
              placeholder="Enter title"
            />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label
              htmlFor="cid-name"
              className="block text-sm font-semibold text-white/90"
            >
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="cid-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              readOnly={!canSubmit}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all read-only:opacity-70"
              placeholder="Enter name"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label
              htmlFor="cid-location"
              className="block text-sm font-semibold text-white/90"
            >
              Location <span className="text-red-400">*</span>
            </label>
            <input
              id="cid-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              readOnly={!canSubmit}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all read-only:opacity-70"
              placeholder="Enter location"
            />
          </div>

          {/* Validity */}
          <div className="space-y-2">
            <label
              htmlFor="cid-validity"
              className="block text-sm font-semibold text-white/90"
            >
              Validity <span className="text-red-400">*</span>
            </label>
            <input
              id="cid-validity"
              type="date"
              value={validity}
              onChange={(e) => setValidity(e.target.value)}
              required
              readOnly={!canSubmit}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all read-only:opacity-70"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={!canSubmit || loading || loadingData}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-orange-500/40 transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? editId
                  ? "Updating..."
                  : "Creating..."
                : editId
                ? "Update Record"
                : "Create Record"}
            </button>
            <Link
              href="/hr/cid?tab=list"
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
