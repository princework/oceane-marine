"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

const OPS_ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer (Read Only)" },
  { value: "editor", label: "Editor (Create / Edit / Delete)" },
  { value: "approver", label: "Approver" },
  { value: "admin", label: "Admin (Master Data + User Mgmt)" },
];

const HR_ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer (read-only + download)" },
  { value: "editor", label: "Editor (create / edit / delete)" },
  { value: "approver", label: "Approver (read + download)" },
  { value: "admin", label: "Admin (read-only oversight)" },
];

const PMS_ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer (read-only + download)" },
  { value: "editor", label: "Editor (create / edit / delete)" },
  { value: "approver", label: "Approver (read + download)" },
  { value: "admin", label: "Admin (forms visible; no submit)" },
];

const QHSE_ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer (read-only + download)" },
  { value: "editor", label: "Editor (create / edit / delete)" },
  { value: "approver", label: "Approver (view + approve only)" },
  { value: "admin", label: "Admin (view all; no create/approve)" },
];

const MODULE_ROLE_OPTIONS = {
  operations: OPS_ROLE_OPTIONS,
  hr: HR_ROLE_OPTIONS,
  pms: PMS_ROLE_OPTIONS,
  qhse: QHSE_ROLE_OPTIONS,
};

const ROLE_SHORT_LABELS = { viewer: "Viewer", editor: "Editor", approver: "Approver", admin: "Admin" };

/** Compact table chip: short label; full permission text on hover (tooltip). */
function ModuleRoleChip({ moduleKey, role }) {
  const r = role || "viewer";
  const options = MODULE_ROLE_OPTIONS[moduleKey] || OPS_ROLE_OPTIONS;
  const fullLabel = options.find((o) => o.value === r)?.label || r;
  const short = ROLE_SHORT_LABELS[r] || r;

  const visual = {
    admin:
      "border-amber-400/70 bg-amber-500/35 text-amber-50 shadow-[0_0_12px_-2px_rgba(245,158,11,0.45)]",
    editor:
      "border-cyan-400/65 bg-cyan-500/30 text-cyan-50 shadow-[0_0_12px_-2px_rgba(6,182,212,0.4)]",
    approver:
      "border-fuchsia-400/65 bg-fuchsia-500/30 text-fuchsia-50 shadow-[0_0_12px_-2px_rgba(217,70,239,0.4)]",
    viewer: "border-white/15 bg-white/10 text-slate-300",
  };

  const cls = visual[r] || visual.viewer;

  return (
    <span
      title={fullLabel}
      className={`inline-flex max-w-full cursor-default rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-none tracking-tight ${cls}`}
    >
      {short}
    </span>
  );
}

function Modal({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const originalOverflow = body.style.overflow;
    const originalPosition = body.style.position;
    const originalTop = body.style.top;
    const originalWidth = body.style.width;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = originalOverflow;
      body.style.position = originalPosition;
      body.style.top = originalTop;
      body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 flex items-stretch justify-center sm:items-center sm:p-4 md:p-6"
      style={{ zIndex: 2147483647 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 border-0 bg-slate-950/85 backdrop-blur-lg backdrop-saturate-150 cursor-pointer"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden border-0 bg-gray-900 shadow-2xl shadow-black/60 sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-white/10">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 id="admin-modal-title" className="text-lg font-bold text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="sidebar-scrollbar-dark min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function ConfirmDialog({ open, onClose, onConfirm, title, message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-white/70 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition">
          {loading ? "Deleting..." : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

export default function AdminPanel({ hideShellTitles = false } = {}) {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.operationsRole === "admin";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [addForm, setAddForm] = useState({
    employeeId: "",
    employeeName: "",
    email: "",
    password: "",
    operationsRole: "viewer",
    hrRole: "viewer",
    pmsRole: "viewer",
    qhseRole: "viewer",
  });
  const [editForm, setEditForm] = useState({
    employeeName: "",
    email: "",
    employeeId: "",
    operationsRole: "viewer",
    hrRole: "viewer",
    pmsRole: "viewer",
    qhseRole: "viewer",
    isActive: true,
  });
  const [newPassword, setNewPassword] = useState("");

  const clearMessages = () => { setError(""); setSuccess(""); };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      clearMessages();
      const res = await fetch("/api/admin/users/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      clearMessages();
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setSuccess("User created successfully");
      setShowAddModal(false);
      setAddForm({
        employeeId: "",
        employeeName: "",
        email: "",
        password: "",
        operationsRole: "viewer",
        hrRole: "viewer",
        pmsRole: "viewer",
        qhseRole: "viewer",
      });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setEditForm({
      employeeName: user.employeeName || "",
      email: user.email || "",
      employeeId: user.employeeId || "",
      operationsRole: user.operationsRole || "viewer",
      hrRole: user.hrRole || "viewer",
      pmsRole: user.pmsRole || "viewer",
      qhseRole: user.qhseRole || "viewer",
      isActive: user.isActive !== false,
    });
    setShowEditModal(true);
    clearMessages();
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      setActionLoading(true);
      clearMessages();
      const res = await fetch(`/api/admin/users/${selectedUser._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      setSuccess("User updated successfully");
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openPasswordChange = (user) => {
    setSelectedUser(user);
    setNewPassword("");
    setShowPasswordModal(true);
    clearMessages();
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      setActionLoading(true);
      clearMessages();
      const res = await fetch(`/api/admin/users/${selectedUser._id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      setSuccess("Password changed successfully");
      setShowPasswordModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openDelete = (user) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
    clearMessages();
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      setActionLoading(true);
      clearMessages();
      const res = await fetch(`/api/admin/users/${selectedUser._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      setSuccess("User deleted successfully");
      setShowDeleteConfirm(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-5xl mb-4">&#128274;</div>
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-white/60">Only administrators can access user management.</p>
        </div>
      </div>
    );
  }

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.employeeName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.employeeId?.toLowerCase().includes(q) ||
      u.operationsRole?.toLowerCase().includes(q) ||
      u.hrRole?.toLowerCase().includes(q) ||
      u.pmsRole?.toLowerCase().includes(q) ||
      u.qhseRole?.toLowerCase().includes(q)
    );
  });

  const inputCls = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition";
  const labelCls = "block text-sm font-medium text-white/70 mb-1.5";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-end sm:justify-between">
        {!hideShellTitles && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Administration
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              User management
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              Assign module-specific roles for Operations, HR, PMS, and QHSE. Hover a role badge in the table
              to see the full permission description.
            </p>
          </div>
        )}
        {hideShellTitles && (
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            Assign module-specific roles for Operations, HR, PMS, and QHSE. Hover a role badge in the table to
            see the full permission description.
          </p>
        )}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          {hideShellTitles && (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span aria-hidden="true">←</span>
              <span>Dashboard</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setShowAddModal(true);
              clearMessages();
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add user
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <span>&#9888;</span> {error}
          <button onClick={() => setError("")} className="ml-auto text-red-300/60 hover:text-red-300">&times;</button>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300 flex items-center gap-2">
          <span>&#10003;</span> {success}
          <button onClick={() => setSuccess("")} className="ml-auto text-green-300/60 hover:text-green-300">&times;</button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xl">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          placeholder="Search by name, email, employee ID, or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} border-white/[0.08] bg-slate-950/40 pl-10 shadow-inner shadow-black/20`}
          aria-label="Search users"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-orange-500" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-slate-950/30 shadow-xl shadow-black/40 ring-1 ring-white/[0.04]">
          <div className="sidebar-scrollbar-dark overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-slate-900/80">
                  <th
                    scope="col"
                    className="sticky top-0 z-[1] px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm"
                  >
                    Employee ID
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-[1] px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-[1] hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm sm:table-cell"
                  >
                    Email
                  </th>
                  <th
                    scope="col"
                    colSpan={4}
                    className="sticky top-0 z-[1] border-l border-white/[0.06] px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm"
                  >
                    Module roles
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-[1] px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-[1] px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm"
                  >
                    Actions
                  </th>
                </tr>
                <tr className="border-b border-white/[0.06] bg-slate-900/60 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  <th className="px-5 py-2" colSpan={3} />
                  <th className="border-l border-white/[0.06] px-3 py-2 text-left lg:px-4">Ops</th>
                  <th className="hidden px-3 py-2 text-left lg:table-cell lg:px-4">HR</th>
                  <th className="hidden px-3 py-2 text-left xl:table-cell xl:px-4">PMS</th>
                  <th className="hidden px-3 py-2 text-left xl:table-cell xl:px-4">QHSE</th>
                  <th className="px-4 py-2" colSpan={2} />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-16 text-center text-sm text-slate-500">
                      No users match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr
                      key={u._id}
                      className="transition-colors hover:bg-white/[0.03] even:bg-white/[0.015]"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-sm tabular-nums text-slate-300">
                        {u.employeeId}
                      </td>
                      <td className="px-5 py-4 font-medium text-white">{u.employeeName}</td>
                      <td className="hidden max-w-[220px] truncate px-5 py-4 text-slate-400 sm:table-cell" title={u.email}>
                        {u.email}
                      </td>
                      <td className="border-l border-white/[0.06] px-3 py-4 lg:px-4">
                        <ModuleRoleChip moduleKey="operations" role={u.operationsRole} />
                      </td>
                      <td className="hidden px-3 py-4 lg:table-cell lg:px-4">
                        <ModuleRoleChip moduleKey="hr" role={u.hrRole} />
                      </td>
                      <td className="hidden px-3 py-4 xl:table-cell xl:px-4">
                        <ModuleRoleChip moduleKey="pms" role={u.pmsRole} />
                      </td>
                      <td className="hidden px-3 py-4 xl:table-cell xl:px-4">
                        <ModuleRoleChip moduleKey="qhse" role={u.qhseRole} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                            u.isActive !== false
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                              : "border-rose-500/25 bg-rose-500/10 text-rose-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              u.isActive !== false ? "bg-emerald-400" : "bg-rose-400"
                            }`}
                            aria-hidden
                          />
                          {u.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="rounded-md border border-white/10 bg-white/[0.03] p-2 text-slate-300 transition hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-200"
                            title="Edit user"
                            aria-label={`Edit ${u.employeeName}`}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => openPasswordChange(u)}
                            className="rounded-md border border-white/10 bg-white/[0.03] p-2 text-slate-300 transition hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-200"
                            title="Change password"
                            aria-label={`Change password for ${u.employeeName}`}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                              />
                            </svg>
                          </button>
                          {String(u._id) !== String(currentUser?._id) && (
                            <button
                              type="button"
                              onClick={() => openDelete(u)}
                              className="rounded-md border border-white/10 bg-white/[0.03] p-2 text-slate-300 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-200"
                              title="Delete user"
                              aria-label={`Delete ${u.employeeName}`}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end text-xs text-slate-500">
        <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 font-medium tabular-nums text-slate-400">
          {filtered.length} user{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Add User Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add New User">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Employee ID *</label>
              <input type="text" required value={addForm.employeeId} onChange={(e) => setAddForm((f) => ({ ...f, employeeId: e.target.value }))} className={inputCls} placeholder="e.g. EMP001" />
            </div>
            <div>
              <label className={labelCls}>Full Name *</label>
              <input type="text" required value={addForm.employeeName} onChange={(e) => setAddForm((f) => ({ ...f, employeeName: e.target.value }))} className={inputCls} placeholder="Full name" />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input type="email" required value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="user@oceanemarine.com" />
            </div>
            <div>
              <label className={labelCls}>Password *</label>
              <input type="password" required minLength={4} value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} placeholder="Min 4 characters" />
            </div>
            <div>
              <label className={labelCls}>Operations Role</label>
              <select value={addForm.operationsRole} onChange={(e) => setAddForm((f) => ({ ...f, operationsRole: e.target.value }))} className={inputCls}>
                {OPS_ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
            <div>
              <label className={labelCls}>HR Role</label>
              <select value={addForm.hrRole} onChange={(e) => setAddForm((f) => ({ ...f, hrRole: e.target.value }))} className={inputCls}>
                {HR_ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
            <div>
              <label className={labelCls}>PMS Role</label>
              <select value={addForm.pmsRole} onChange={(e) => setAddForm((f) => ({ ...f, pmsRole: e.target.value }))} className={inputCls}>
                {PMS_ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
            <div>
              <label className={labelCls}>QHSE Role</label>
              <select value={addForm.qhseRole} onChange={(e) => setAddForm((f) => ({ ...f, qhseRole: e.target.value }))} className={inputCls}>
                {QHSE_ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition">
              {actionLoading ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title={`Edit – ${selectedUser?.employeeName || ""}`}>
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Employee ID</label>
              <input type="text" value={editForm.employeeId} onChange={(e) => setEditForm((f) => ({ ...f, employeeId: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Full Name</label>
              <input type="text" value={editForm.employeeName} onChange={(e) => setEditForm((f) => ({ ...f, employeeName: e.target.value }))} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Email</label>
              <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Operations Role</label>
              <select value={editForm.operationsRole} onChange={(e) => setEditForm((f) => ({ ...f, operationsRole: e.target.value }))} className={inputCls}>
                {OPS_ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
            <div>
              <label className={labelCls}>HR Role</label>
              <select value={editForm.hrRole} onChange={(e) => setEditForm((f) => ({ ...f, hrRole: e.target.value }))} className={inputCls}>
                {HR_ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
            <div>
              <label className={labelCls}>PMS Role</label>
              <select value={editForm.pmsRole} onChange={(e) => setEditForm((f) => ({ ...f, pmsRole: e.target.value }))} className={inputCls}>
                {PMS_ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
            <div>
              <label className={labelCls}>QHSE Role</label>
              <select value={editForm.qhseRole} onChange={(e) => setEditForm((f) => ({ ...f, qhseRole: e.target.value }))} className={inputCls}>
                {QHSE_ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} className="peer sr-only" />
              <div className="h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-green-500 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition after:content-[''] peer-checked:after:translate-x-full" />
            </label>
            <span className="text-sm text-white/70">{editForm.isActive ? "Active" : "Inactive"}</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowEditModal(false)} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition">
              {actionLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} title={`Change Password – ${selectedUser?.employeeName || ""}`}>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className={labelCls}>New Password *</label>
            <input type="password" required minLength={4} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} placeholder="Enter new password" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowPasswordModal(false)} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition">
              {actionLoading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Are you sure you want to delete "${selectedUser?.employeeName}"? This action cannot be undone.`}
        loading={actionLoading}
      />
    </div>
  );
}
