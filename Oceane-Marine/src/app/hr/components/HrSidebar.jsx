"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useHrSidebar } from "../HrSidebarContext";

const sidebarTabs = [
  {
    key: "statutory-certificates",
    label: "Statutory Certificates",
    href: "/hr/statutory-certificates",
  },
  {
    key: "oil-majors",
    label: "Oil Majors",
    href: "/hr/oil-majors",
  },
  {
    key: "poac-matrix",
    label: "POAC Matrix",
    href: "/hr/poac-matrix",
  },
  {
    key: "cid",
    label: "CID",
    href: "/hr/cid",
  },
];

export default function HrSidebar() {
  const { isSidebarOpen, setIsSidebarOpen } = useHrSidebar();
  const [activeTab, setActiveTab] = useState("statutory-certificates");
  const sidebarRef = useRef(null);
  const pathname = usePathname();
  const router = useRouter();

  // Derive active tab from current route
  useEffect(() => {
    if (pathname.startsWith("/hr/statutory-certificates")) {
      setActiveTab("statutory-certificates");
    } else if (pathname.startsWith("/hr/oil-majors")) {
      setActiveTab("oil-majors");
    } else if (pathname.startsWith("/hr/poac-matrix")) {
      setActiveTab("poac-matrix");
    } else if (pathname.startsWith("/hr/cid")) {
      setActiveTab("cid");
    }
  }, [pathname]);

  const handleNavigation = (href) => {
    if (href) {
      router.push(href);
    }
  };

  return (
    <>
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full w-[260px] sm:w-[280px] bg-slate-900/98 border-r border-white/20 shadow-2xl backdrop-blur-md z-50 transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-lg font-bold text-white">HR Navigation</h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition"
              aria-label="Close sidebar"
            >
              <span className="text-white text-lg">×</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {sidebarTabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.href}
                  onClick={() => {
                    setActiveTab(tab.key);
                    handleNavigation(tab.href);
                  }}
                  className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                    activeTab === tab.key
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40"
                      : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Toggle Button + Mobile Dashboard */}
      {!isSidebarOpen && (
        <div className="fixed left-4 top-4 z-40 flex items-center gap-2">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition border border-orange-400/30 shadow-lg shadow-orange-500/30 hover:scale-110"
            aria-label="Open sidebar"
          >
            <span className="text-white text-xl">☰</span>
          </button>
          <Link
            href="/dashboard"
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
        </div>
      )}
    </>
  );
}
