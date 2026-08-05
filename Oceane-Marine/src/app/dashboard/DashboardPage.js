"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardTabs from "./components/DashboardTabs";
import { useAuthStore } from "@/store/authStore";

const baseTabs = [
  { key: "operations", label: "Operations" },
  { key: "pms", label: "PMS" },
  { key: "qhse", label: "QHSE" },
  { key: "hr", label: "HR" },
];

const menuItems = [
  { key: "operations", label: "Operations", href: "/operations" },
  { key: "pms", label: "PMS", href: "/pms" },
  { key: "qhse", label: "QHSE", href: "/qhse/training/create/plan" },
  { key: "hr", label: "HR", href: "/hr" },
];

const BASE_VALID_TABS = ["operations", "pms", "qhse", "hr"];

/** Periodic `router.refresh` only for these dashboard module tabs (not admin — admin is `/admin`) */
const DASHBOARD_AUTO_REFRESH_TABS = new Set(BASE_VALID_TABS);

const OPERATIONS_DASHBOARD_BG = "/bg-image/operation/documentations.png";
const PMS_DASHBOARD_BG = "/bg-image/pms/pms-bg.jpeg";
const QHSE_DASHBOARD_BG = "/bg-image/qhse/bg.jpeg";
const HR_DASHBOARD_BG = "/bg-image/HR/hr-bg.jpeg";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.operationsRole === "admin";

  useEffect(() => {
    void useAuthStore.getState().fetchUser();
  }, []);

  const tabs = baseTabs;
  const VALID_TABS = BASE_VALID_TABS;

  const [activeTab, setActiveTab] = useState(() => {
    return tabFromUrl && BASE_VALID_TABS.includes(tabFromUrl) ? tabFromUrl : "operations";
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const router = useRouter();
  const menuRef = useRef(null);

  const DASHBOARD_REFRESH_MS = 60_000;

  useEffect(() => {
    if (!DASHBOARD_AUTO_REFRESH_TABS.has(activeTab)) {
      return;
    }
    const id = globalThis.setInterval(() => {
      setDataRefreshKey((k) => k + 1);
      router.refresh();
    }, DASHBOARD_REFRESH_MS);
    return () => globalThis.clearInterval(id);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tabFromUrl !== "admin") return;
    if (!currentUser) return;
    if (currentUser.operationsRole === "admin") {
      router.replace("/admin");
      return;
    }
    router.replace("/dashboard?tab=operations", { scroll: false });
  }, [tabFromUrl, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL whenever activeTab changes (keeps URL in sync so refresh works)
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    router.replace(`/dashboard?tab=${tabKey}`, { scroll: false });
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  const handleMenuClick = (item) => {
    setIsMenuOpen(false);
    router.push(item.href);
  };

  const resolvedMenuItems = useMemo(() => {
    if (!isAdmin) return menuItems;
    return [
      { key: "admin", label: "Admin Panel", href: "/admin" },
      ...menuItems,
    ];
  }, [isAdmin]);

  const cta = {
    operations: { label: "Go to Operations", href: "/operations" },
    pms: { label: "Go to PMS", href: "/pms" },
    qhse: { label: "Go to QHSE", href: "/qhse/training/create/plan" },
    hr: { label: "Go to HR", href: "/hr" },
  }[activeTab];

  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  const imageBackdrop = (imageUrl) => (
    <>
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat blur-sm"
        style={{ backgroundImage: `url('${imageUrl}')` }}
      />
      <div className="absolute inset-0 bg-slate-950/55" />
    </>
  );

  let dashboardBackdrop;
  if (activeTab === "operations") {
    dashboardBackdrop = imageBackdrop(OPERATIONS_DASHBOARD_BG);
  } else if (activeTab === "pms") {
    dashboardBackdrop = imageBackdrop(PMS_DASHBOARD_BG);
  } else if (activeTab === "qhse") {
    dashboardBackdrop = imageBackdrop(QHSE_DASHBOARD_BG);
  } else if (activeTab === "hr") {
    dashboardBackdrop = imageBackdrop(HR_DASHBOARD_BG);
  } else {
    dashboardBackdrop = <div className="absolute inset-0 bg-[#08334f]/85" />;
  }

  return (
    <div className="relative min-h-screen text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        {dashboardBackdrop}
      </div>

      <div className="relative z-10 min-h-screen">
      <header className="flex items-center justify-between px-3 sm:px-5 md:px-8 py-3 md:py-5 border-b border-white/10 bg-white/5 backdrop-blur-md relative z-40">
        <div className="flex-shrink-0 flex items-center">
          <img
            src="/image/image.png"
            alt="Helios Logo"
            className="h-10 sm:h-14 md:h-20 w-auto object-contain brightness-110 contrast-110 drop-shadow-lg"
          />
        </div>
        <h1 className="text-lg sm:text-xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight text-center flex-1 mx-2 sm:mx-4">
          DASHBOARD
        </h1>
        <div
          className="flex-shrink-0 flex items-center gap-1.5 sm:gap-2 md:gap-3 relative z-50"
          ref={menuRef}
        >
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="hidden cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:bg-white/15 sm:flex"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-sm font-semibold text-white">
                  A
                </div>
                <span className="text-sm text-white/80">Admin Panel</span>
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white sm:hidden"
                title="Admin Panel"
              >
                A
              </button>
            </>
          )}
          <button
            onClick={handleLogout}
            className="rounded-full cursor-pointer bg-white/10 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 border border-white/15 hover:bg-white/20 transition whitespace-nowrap"
          >
            Sign out
          </button>
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 border border-white/10 hover:border-white/20 hover:scale-105 shadow-lg flex-shrink-0"
            aria-label="Open menu"
          >
            <div className="space-y-1 sm:space-y-1.5">
              <span className="block h-0.5 w-4 sm:w-5 bg-white transition-all"></span>
              <span className="block h-0.5 w-4 sm:w-5 bg-white transition-all"></span>
              <span className="block h-0.5 w-4 sm:w-5 bg-white transition-all"></span>
            </div>
          </button>
        </div>
      </header>

      {/* Full right-side sidebar menu - Outside header */}
      {isMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-9998 border-0 cursor-pointer"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu"
          />
          {/* Sidebar */}
          <div
            data-sidebar
            className="fixed right-0 top-0 h-full w-64 sm:w-80 bg-slate-900/98 border-l border-white/20 shadow-2xl backdrop-blur-md z-9999"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-bold text-white">Menu</h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200"
                  aria-label="Close menu"
                >
                  <span className="text-white text-xl">×</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {resolvedMenuItems.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => handleMenuClick(item)}
                      className="w-full text-left px-6 py-4 rounded-xl text-base font-medium text-white/90 hover:bg-white/10 hover:text-white transition-all duration-150 hover:translate-x-2 border border-white/5 hover:border-white/20"
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

      <main className="px-3 sm:px-4 md:px-6 py-4 md:py-8">
        <div className="mx-auto max-w-7xl space-y-4 md:space-y-8">
          {/* CTA button */}
          <div className="flex justify-center sm:justify-end">
            {cta && (
              <Link
                href={cta.href}
                prefetch={false}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold shadow-lg shadow-orange-500/40 transition-all duration-200 hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-xl hover:shadow-orange-500/50"
              >
                {cta.label}
              </Link>
            )}
          </div>

          {/* Tabs centered with light border separator - Hidden on mobile, shown on md+ */}
          <div className="hidden md:block text-center pb-6 border-b border-white/5">
            <div className="flex items-center justify-center gap-3 lg:gap-4">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`rounded-xl px-5 lg:px-8 py-2.5 lg:py-3 text-sm font-semibold transition-all duration-200 ${
                    activeTab === tab.key
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40 scale-105"
                      : "bg-white/5 text-white/90 hover:bg-white/10 hover:text-white hover:scale-105 border border-white/5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <DashboardTabs
            key={dataRefreshKey}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </div>
      </main>
      </div>
    </div>
  );
}
