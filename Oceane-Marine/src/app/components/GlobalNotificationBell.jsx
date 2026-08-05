"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

/** Keep in sync with @/lib/notifications/moduleNotify NOTIFICATION_MODULES */
const M = {
  Operations: "Operations",
  PMS: "PMS",
  QHSE: "QHSE",
  HR: "HR",
};

const TABS = [
  { key: M.Operations, label: "Operations", accent: "from-cyan-500 to-blue-600" },
  { key: M.PMS, label: "PMS", accent: "from-emerald-500 to-teal-700" },
  { key: M.QHSE, label: "QHSE", accent: "from-violet-500 to-fuchsia-700" },
  { key: M.HR, label: "HR", accent: "from-rose-500 to-orange-600" },
];

function timeAgo(date) {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function GlobalNotificationBell() {
  const pathname = usePathname();
  /** Notification summary polling only on main dashboard — not on /admin or module pages */
  const pollUnreadSummaryOnDashboard = pathname === "/dashboard";

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  /** Wait for /api/auth/me so we never flash the bell from stale persisted Zustand before session is verified */
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await useAuthStore.getState().fetchUser();
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(M.Operations);
  const [items, setItems] = useState([]);
  const [tabUnread, setTabUnread] = useState({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const isAdmin = useMemo(
    () =>
      Boolean(
        user?.roles?.includes("ADMIN") ||
          user?.operationsRole === "admin" ||
          user?.hrRole === "admin" ||
          user?.pmsRole === "admin" ||
          user?.qhseRole === "admin"
      ),
    [user]
  );

  const fetchSummary = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/notifications/unread-summary");
      const data = await res.json();
      if (data.success) {
        setTabUnread(data.byModule || {});
        setTotalUnread(data.total ?? 0);
      }
    } catch {
      /* silent */
    }
  }, [isAdmin]);

  const fetchList = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notifications?module=${encodeURIComponent(tab)}&limit=25`
      );
      const data = await res.json();
      if (data.success) {
        setItems(data.data ?? []);
        setTabUnread((prev) => ({
          ...prev,
          [tab]: data.unreadCount ?? 0,
        }));
      }
    } catch {
      /* silent */
    }
    setLoading(false);
  }, [isAdmin, tab]);

  useEffect(() => {
    if (!sessionReady) return;
    fetchSummary();
    if (!pollUnreadSummaryOnDashboard) {
      return;
    }
    const t = setInterval(fetchSummary, 25000);
    return () => clearInterval(t);
  }, [fetchSummary, pollUnreadSummaryOnDashboard, sessionReady]);

  useEffect(() => {
    if (open) fetchList();
  }, [open, tab, fetchList]);

  useEffect(() => {
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const markOneRead = async (id) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      fetchSummary();
    } catch {
      /* silent */
    }
  };

  const [deletingId, setDeletingId] = useState(null);
  const deleteOne = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((n) => n._id !== id));
        fetchSummary();
      }
    } catch {
      /* silent */
    } finally {
      setDeletingId(null);
    }
  };

  const markTabRead = async () => {
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: tab }),
      });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      fetchSummary();
    } catch {
      /* silent */
    }
  };

  const markAllModulesRead = async () => {
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "all" }),
      });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      fetchSummary();
    } catch {
      /* silent */
    }
  };

  if (!sessionReady || !isAuthenticated || !user || !isAdmin) {
    return null;
  }

  const activeAccent =
    TABS.find((t) => t.key === tab)?.accent ?? "from-slate-500 to-slate-700";

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-[9990] font-sans">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${activeAccent} text-white shadow-2xl shadow-black/40 ring-2 ring-white/10 transition hover:scale-[1.03] hover:ring-white/25`}
        title="Notifications"
        aria-label="Open notifications"
      >
        <svg
          className="h-7 w-7 drop-shadow-md"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.102V7.5a6 6 0 10-12 0v2.25a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg ring-2 ring-slate-950">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed bottom-24 left-3 right-3 z-[9991] flex max-h-[min(70vh,560px)] w-auto flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1222] shadow-[0_25px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:absolute sm:inset-x-auto sm:bottom-[4.5rem] sm:left-auto sm:right-0 sm:z-auto sm:max-h-[min(70vh,560px)] sm:w-[min(100vw-1.5rem,420px)]"
          role="dialog"
          aria-label="Activity feed"
        >
          <div
            className={`shrink-0 bg-gradient-to-r px-4 py-3.5 ${activeAccent} bg-[length:200%_100%]`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold tracking-tight text-white drop-shadow-sm">
                  Activity feed
                </h3>
                <p className="text-[11px] font-medium text-white/85">
                  Edits &amp; deletions by module
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {totalUnread > 0 && (
                  <button
                    type="button"
                    onClick={markAllModulesRead}
                    className="rounded-lg bg-black/20 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm transition hover:bg-black/35"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-white/90 transition hover:bg-black/20"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-b border-white/10 bg-[#0a0f1a] px-2 py-2">
            <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
              {TABS.map((t) => {
                const u = tabUnread[t.key] ?? 0;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "bg-white/12 text-white shadow-inner ring-1 ring-white/15"
                        : "text-white/55 hover:bg-white/5 hover:text-white/90"
                    }`}
                  >
                    {t.label}
                    {u > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-md bg-red-500/90 px-1 text-[9px] font-bold text-white">
                        {u > 9 ? "9+" : u}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/35">
              {tab}
            </span>
            {(tabUnread[tab] ?? 0) > 0 && (
              <button
                type="button"
                onClick={markTabRead}
                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300"
              >
                Mark tab read
              </button>
            )}
          </div>

          {/* ~3 notification rows visible; list scrolls inside fixed height */}
          <div className="h-[min(288px,45vh)] shrink-0 overflow-y-auto overscroll-y-contain">
            {loading ? (
              <div className="flex h-[min(288px,45vh)] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-[min(288px,45vh)] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm text-white/50">No activity in this module yet</p>
                <p className="mt-1 text-xs text-white/30">
                  Record changes will appear here automatically
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/6">
                {items.map((n) => (
                  <li key={n._id} className="group relative">
                    <button
                      type="button"
                      onClick={() => !n.isRead && markOneRead(n._id)}
                      className={`w-full px-4 py-3.5 pr-11 text-left transition hover:bg-white/[0.04] ${
                        !n.isRead ? "bg-sky-500/[0.06]" : ""
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            n.action === "DELETE"
                              ? "bg-red-500/20 text-red-200 ring-1 ring-red-500/25"
                              : n.action === "CREATE"
                                ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/25"
                                : "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/25"
                          }`}
                        >
                          {n.action}
                        </span>
                        <span className="text-xs font-semibold text-white">{n.userName}</span>
                        <span className="ml-auto text-[10px] text-white/35">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-[13px] leading-snug text-white/85">{n.message}</p>
                      {n.submodule ? (
                        <p className="mt-1.5 text-[10px] text-white/40">{n.submodule}</p>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteOne(n._id);
                      }}
                      disabled={deletingId === n._id}
                      className="absolute right-2.5 top-3 rounded-lg p-1.5 text-white/30 transition hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40"
                      aria-label="Delete notification"
                      title="Delete notification"
                    >
                      {deletingId === n._id ? (
                        <span className="block h-4 w-4 animate-spin rounded-full border-2 border-red-300/40 border-t-red-300" />
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
