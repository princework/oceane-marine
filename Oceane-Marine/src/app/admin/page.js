"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import AdminPanel from "@/app/dashboard/components/AdminPanel";
import { useAuthStore } from "@/store/authStore";

const menuItems = [
  { key: "operations", label: "Operations", href: "/operations" },
  { key: "pms", label: "PMS", href: "/pms" },
  { key: "qhse", label: "QHSE", href: "/qhse/training/create/plan" },
  { key: "accounts", label: "Accounts", href: "/accounts" },
  { key: "hr", label: "HR", href: "/hr" },
];

export default function AdminPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.operationsRole === "admin";

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    void useAuthStore.getState().fetchUser();
  }, []);

  const resolvedMenuItems = useMemo(() => {
    if (!isAdmin) return menuItems;
    return [{ key: "admin", label: "Admin Panel", href: "/admin" }, ...menuItems];
  }, [isAdmin]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape" && isMenuOpen) setIsMenuOpen(false);
    };
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onEsc);
    }
    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", onEsc);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  const handleMenuClick = (item) => {
    setIsMenuOpen(false);
    router.push(item.href);
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "#08334f" }}
    >
      <header className="relative z-40 flex items-center justify-between border-b border-white/10 bg-white/10 px-3 py-3 backdrop-blur-sm sm:px-5 md:px-8 md:py-5">
        <div className="flex shrink-0 items-center">
          <img
            src="/image/image.png"
            alt="Helios Logo"
            className="h-10 w-auto object-contain brightness-110 contrast-110 drop-shadow-lg sm:h-14 md:h-20"
          />
        </div>
        <div className="mx-2 flex flex-1 flex-col items-center justify-center text-center sm:mx-4">
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl md:text-3xl lg:text-4xl">
            ADMIN PANEL
          </h1>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90 sm:text-xs sm:tracking-[0.25em]">
            Administration
          </p>
        </div>
        <div className="relative z-50 flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
          <button
            type="button"
            onClick={handleLogout}
            className="whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/90 transition hover:bg-white/20 sm:px-4 sm:py-2 sm:text-sm"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 shadow-lg transition-all duration-200 hover:scale-105 hover:border-white/20 hover:bg-white/20 sm:h-11 sm:w-11"
            aria-label="Open menu"
          >
            <div className="space-y-1 sm:space-y-1.5">
              <span className="block h-0.5 w-4 bg-white transition-all sm:w-5" />
              <span className="block h-0.5 w-4 bg-white transition-all sm:w-5" />
              <span className="block h-0.5 w-4 bg-white transition-all sm:w-5" />
            </div>
          </button>
        </div>
      </header>

      {isMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-9998 cursor-pointer border-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu"
          />
          <div className="fixed right-0 top-0 z-9999 h-full w-64 border-l border-white/20 bg-slate-900/98 shadow-2xl backdrop-blur-md sm:w-80">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/10 p-6">
                <h2 className="text-xl font-bold text-white">Menu</h2>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20"
                  aria-label="Close menu"
                >
                  <span className="text-xl text-white">×</span>
                </button>
              </div>
              <div className="sidebar-scrollbar-dark flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {resolvedMenuItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleMenuClick(item)}
                      className="w-full rounded-xl border border-white/5 px-6 py-4 text-left text-base font-medium text-white/90 transition hover:translate-x-2 hover:border-white/20 hover:bg-white/10 hover:text-white"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <main className="sidebar-scrollbar-dark px-3 py-4 sm:px-4 md:px-6 md:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/35 p-3 shadow-xl backdrop-blur-sm sm:rounded-3xl sm:p-4 md:bg-slate-900/50 md:p-6">
            <AdminPanel hideShellTitles />
          </div>
        </div>
      </main>
    </div>
  );
}
