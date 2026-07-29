"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePmsRole } from "@/hooks/usePmsRole";

function matchPathToSidebar(pathname) {
  if (pathname.startsWith("/pms/equipment-testing")) return { tab: "equipment-testing" };
  if (pathname.startsWith("/pms/warehouse-management")) return { tab: "warehouse-management" };
  if (pathname.startsWith("/pms/location")) return { tab: "location" };
  if (pathname.startsWith("/pms/primary-equipment")) {
    return { tab: "equipment-inventory", sub: "primary-equipment" };
  }
  if (pathname.startsWith("/pms/accessories")) {
    return { tab: "equipment-inventory", sub: "accessories" };
  }
  return null;
}

export default function PmsSidebar() {
  const { isPmsAdmin } = usePmsRole();

  const sidebarTabs = useMemo(
    () => [
      {
        key: "equipment-inventory",
        label: "Equipment Inventory",
        submodules: [
          {
            key: "primary-equipment",
            label: "Primary Equipment",
            href: "/pms/primary-equipment",
          },
          {
            key: "accessories",
            label: "Accessories",
            href: "/pms/accessories",
          },
        ],
      },
      {
        key: "equipment-testing",
        label: "Equipment Testing",
        href: "/pms/equipment-testing",
      },
      {
        key: "warehouse-management",
        label: "Warehouse Management",
        href: "/pms/warehouse-management",
      },
      ...(isPmsAdmin
        ? [
            {
              key: "location",
              label: "Location",
              href: "/pms/location",
            },
          ]
        : []),
    ],
    [isPmsAdmin]
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [uiTab, setUiTab] = useState("equipment-inventory");
  const [uiSub, setUiSub] = useState("primary-equipment");
  const sidebarRef = useRef(null);
  const pathname = usePathname();
  const router = useRouter();

  const pathMatch = useMemo(() => matchPathToSidebar(pathname), [pathname]);

  const mergedTab = pathMatch?.tab ?? uiTab;
  const activeTab =
    !isPmsAdmin && mergedTab === "location" ? "warehouse-management" : mergedTab;
  const activeSubmodule = pathMatch?.sub !== undefined ? pathMatch.sub : uiSub;

  const handleNavigation = (href) => {
    if (href) router.push(href);
  };

  return (
    <>
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full w-[260px] sm:w-[280px] bg-slate-900/98 border-r border-white/20 shadow-2xl backdrop-blur-[2px] z-50 transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-lg font-bold text-white">Navigation</h2>
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
                <div key={tab.key}>
                  {tab.href && !tab.submodules ? (
                    <Link
                      href={tab.href}
                      onClick={() => {
                        setUiTab(tab.key);
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
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setUiTab(tab.key);
                        if (tab.submodules && tab.submodules.length > 0) {
                          setUiSub(tab.submodules[0].key);
                          if (tab.submodules[0].href) {
                            handleNavigation(tab.submodules[0].href);
                          }
                        }
                      }}
                      className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                        activeTab === tab.key
                          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40"
                          : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{tab.label}</span>
                        {tab.submodules && (
                          <span
                            className={`text-xs transition-transform ${
                              activeTab === tab.key ? "rotate-90" : ""
                            }`}
                          >
                            ▶
                          </span>
                        )}
                      </div>
                    </button>
                  )}

                  {tab.submodules && activeTab === tab.key && (
                    <div className="ml-4 mt-2 space-y-1 pl-4 border-l-2 border-orange-500/30">
                      {tab.submodules.map((sub) => (
                        <Link
                          key={sub.key}
                          href={sub.href}
                          onClick={() => {
                            setUiSub(sub.key);
                            handleNavigation(sub.href);
                          }}
                          className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
                            activeSubmodule === sub.key
                              ? "bg-white/20 text-white border-orange-400/50 shadow-md"
                              : "text-white/80 hover:bg-white/10 hover:text-white border-white/5 hover:border-white/10"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-xs">▸</span>
                            {sub.label}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition border border-white/10 shadow-lg"
          aria-label="Open sidebar"
        >
          <span className="text-white text-xl">☰</span>
        </button>
      )}
    </>
  );
}
