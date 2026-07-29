"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ActionEditIcon,
  ActionDeleteIcon,
} from "@/app/components/RecordActionIcons";
import { usePmsRole } from "@/hooks/usePmsRole";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";

/**
 * PMS Location — top-level admin module (same idea as Operations → Locations).
 * Form and list on one screen.
 */
export default function PmsLocationMaster() {
  const { isPmsAdmin } = usePmsRole();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const pag = useOperationsClientPagination(items, "pms-locations");
  const { paginatedItems: pageItems, ...footerProps } = pag;

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/pms/locations/list");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to load locations");
      }
      setItems(Array.isArray(data.locations) ? data.locations : []);
    } catch (e) {
      setListError(e.message || "Failed to load locations");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPmsAdmin) return;
    load();
  }, [isPmsAdmin, load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isPmsAdmin) return;
    const name = nameInput.trim();
    if (!name) return;

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const res = await fetch("/api/pms/locations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to save location");
      }
      setNameInput("");
      setFormSuccess("Location saved.");
      await load();
    } catch (err) {
      setFormError(err.message || "Failed to save location");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (row) => {
    setEditingId(row._id);
    setEditName(row.name || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async (id) => {
    const name = editName.trim();
    if (!name) return;
    setActionLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/pms/locations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to update location");
      }
      cancelEdit();
      await load();
    } catch (e) {
      setListError(e.message || "Failed to update location");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (row) => {
    if (!row?._id) return;
    if (!confirm(`Delete location "${row.name}"? This cannot be undone.`)) return;
    setActionLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/pms/locations/${row._id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete location");
      }
      if (editingId === row._id) cancelEdit();
      await load();
    } catch (e) {
      setListError(e.message || "Failed to delete location");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isPmsAdmin) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#0b2740]/60 px-6 py-12 text-center">
        <div className="text-4xl" aria-hidden>
          &#128274;
        </div>
        <h2 className="text-lg font-bold text-white">Access restricted</h2>
        <p className="max-w-md text-sm text-white/70">
          The Location master list is only available to PMS administrators.
        </p>
        <Link
          href="/dashboard"
          className="mt-2 inline-flex items-center rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          ← Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-sky-300">PMS / Location</p>
        <h2 className="mt-1 text-xl font-bold text-white">Location</h2>
        <p className="mt-1 text-xs text-slate-200">
          Maintain PMS location names (admin only).
        </p>
      </div>

      {(formError || formSuccess) && (
        <div>
          {formError && (
            <div className="mb-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
              {formSuccess}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-3xl border border-white/10 bg-[#0b2740]/75 p-6 shadow-2xl backdrop-blur-[2px]"
      >
        <div className="space-y-2">
          <label htmlFor="pms-location-name" className="text-sm text-slate-200">
            Enter Location name <span className="text-red-400">*</span>
          </label>
          <input
            id="pms-location-name"
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Enter Location name"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-orange-500/50"
            autoComplete="off"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !nameInput.trim()}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0b2740]/75 p-6 shadow-2xl backdrop-blur-[2px]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">Location list</h3>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-sky-400/40 px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {listError && (
          <div className="mb-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
            {listError}
          </div>
        )}

        <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5">
          <div className="rounded-t-2xl border-b border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200">
            Locations
          </div>
          <div className="min-h-0 min-w-0 overflow-auto styled-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-left text-slate-300">
                  <th className="px-4 py-2 font-semibold">S.No</th>
                  <th className="px-4 py-2 font-semibold">Location Name</th>
                  <th className="px-4 py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {!loading && pageItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                      No locations yet. Add one using the form above.
                    </td>
                  </tr>
                )}
                {pageItems.map((row, idx) => (
                  <tr
                    key={row._id}
                    className="border-b border-white/5 transition hover:bg-white/5"
                  >
                    <td className="px-4 py-2 text-slate-300">
                      {(pag.page - 1) * pag.pageSize + idx + 1}
                    </td>
                    <td className="px-4 py-2 text-slate-100">
                      {editingId === row._id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full min-w-[8rem] rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-orange-500"
                          aria-label="Edit location name"
                        />
                      ) : (
                        row.name
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {editingId === row._id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(row._id)}
                              disabled={actionLoading || !editName.trim()}
                              className="rounded-lg border border-green-400/40 bg-green-500/10 px-3 py-1 text-[11px] font-semibold text-green-200 hover:bg-green-500/20 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70 hover:bg-white/10"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <ActionEditIcon
                              onClick={() => startEdit(row)}
                              title="Edit location"
                            />
                            <ActionDeleteIcon
                              onClick={() => handleDelete(row)}
                              disabled={actionLoading}
                              title="Delete location"
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <OperationsListPaginationFooter {...footerProps} />
      </div>
    </div>
  );
}
