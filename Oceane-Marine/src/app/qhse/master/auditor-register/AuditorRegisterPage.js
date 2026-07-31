"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";
import { useQhseSidebar } from "../../QhseSidebarContext";
import { ActionEditIcon, ActionDeleteIcon } from "@/app/components/RecordActionIcons";

export default function AuditorRegisterPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const { isQhseAdmin } = useQhseRole();

  const [auditors, setAuditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPageLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/master/auditors/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load auditors");
      setAuditors(data.auditors || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, [setPageLoading]);

  useEffect(() => {
    if (isQhseAdmin) load();
  }, [isQhseAdmin, load]);

  if (loading && isQhseAdmin) return null;

  if (!isQhseAdmin) {
    return (
      <div className={`${contentClassName} w-full min-w-0 pr-4`}>
        <div className="mx-auto max-w-2xl py-16 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-white">Access Restricted</h2>
          <p className="text-white/60 mt-2">Only administrators can access master data management.</p>
          <Link
            href="/qhse/due-diligence-subconstructor/vendors"
            className="inline-block mt-6 px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition"
          >
            Back to Vendor Onboarding
          </Link>
        </div>
      </div>
    );
  }

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/master/auditors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add auditor");
      setName("");
      setEmail("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (a) => {
    setError(null);
    setEditingId(a._id);
    setEditName(a.name || "");
    setEditEmail(a.email || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditEmail("");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim() || !editEmail.trim()) return;
    setEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/master/auditors/${editingId}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update auditor");
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this auditor?")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/master/auditors/${id}/delete`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete auditor");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-10 space-y-4 sm:space-y-6">
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/dashboard"
            className="flex-shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / Master Database
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Auditor Register</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Internal staff who visit vendors on-site to fill the Sub-Contractor Audit
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <Link
              href="/qhse/master/vendor-register"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs sm:text-sm font-semibold text-white/80 hover:bg-white/10 transition"
            >
              Vendor Register
            </Link>
            <Link
              href="/qhse/due-diligence-subconstructor/vendors"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs sm:text-sm font-semibold text-white/80 hover:bg-white/10 transition"
            >
              Vendor Onboarding
            </Link>
          </div>
        </header>

        {error && (
          <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">{error}</div>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-white border-b border-white/10 pb-3">Add Auditor</h2>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auditor name"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-sky-500/50"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Auditor email"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-sky-500/50"
            />
            <button
              type="submit"
              disabled={adding}
              className="shrink-0 rounded-xl bg-sky-500 hover:bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add Auditor"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-white border-b border-white/10 pb-3">
            Auditors ({auditors.length})
          </h2>
          {auditors.length === 0 ? (
            <p className="text-sm text-slate-400">No auditors yet. Add one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-200 border-b border-white/10">
                    <th className="py-3 pr-4 font-semibold">Name</th>
                    <th className="py-3 pr-4 font-semibold">Email</th>
                    <th className="py-3 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {auditors.map((a) => (
                    <tr key={a._id} className="border-b border-white/5 hover:bg-white/5 transition align-top">
                      <td className="py-3 pr-4">
                        {editingId === a._id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={editSaving}
                            autoFocus
                            className="w-full max-w-xs rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-sky-500/30"
                          />
                        ) : (
                          <span className="text-white font-medium">{a.name}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {editingId === a._id ? (
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            disabled={editSaving}
                            className="w-full max-w-xs rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-sky-500/30"
                          />
                        ) : (
                          <span className="text-slate-300">{a.email}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {editingId === a._id ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={editSaving || !editName.trim() || !editEmail.trim()}
                              className="rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                              {editSaving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={editSaving}
                              className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <ActionEditIcon onClick={() => startEdit(a)} title="Edit auditor" />
                            <ActionDeleteIcon
                              onClick={() => handleDelete(a._id)}
                              disabled={!!editingId}
                              loading={deletingId === a._id}
                              title="Delete auditor"
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
