"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQhseSidebar } from "../QhseSidebarContext";
import { useQhseRole } from "@/hooks/useQhseRole";

const sidebarTabs = [
  {
    key: "controlled-document-register",
    label: "Controlled document register",
    href: "/qhse/controlled-document-register",
  },
  {
    key: "training",
    label: "Training",
    href: "/qhse/training/create/plan",
    
  },
  {
    key: "drills",
    label: "Drills",
    href: "/qhse/drills/create/plan",
  },
  {
    key: "forms",
    label: "Forms & checklist",
    submodules: [
      {
        key: "base-audit",
        label: "STS Base Audit Report",
        href: "/qhse/forms-checklist/base-audit/form",
      },
      {
        key: "transfer-audit",
        label: "Transfer Audit",
        href: "/qhse/forms-checklist/transfer-audit/list",
      },
      {
        key: "hse-induction-checklist",
        label: "HSE Induction Checklist",
        href: "/qhse/forms-checklist/hse-induction-checklist/list",
      },
      {
        key: "vendor-supply",
        label: "Vendor / Supplier /Contractor Approval",
        href: "/qhse/forms-checklist/vendor-supply/form",
      },
      {
        key: "equipment-base-stock-level",
        label: "STS Equipment Base Stock Level",
        href: "/qhse/forms-checklist/equipment-base-stock-level/form",
      },
      {
        key: "transfer-location-quest",
        label: "Transfer Location Questionnaire",
        href: "/qhse/forms-checklist/transfer-location-quest/list",
      },
      {
        key: "new-base-setup-checklist",
        label: "New Base Setup Checklist",
        href: "/qhse/forms-checklist/new-base-setup-checklist/form",
      },
    ],
  },
  {
    key: "defects",
    label: "Defects list",
    href: "/qhse/defects-list/create/plan",
  },
  {
    key: "best-practices",
    label: "Best practices",
    href: "/qhse/best-practice/create",
  },
  {
    key: "near-miss",
    label: "Near-miss reporting",
    href: "/qhse/near-miss",
  },
  {
    key: "moc",
    label: "MOC",
    href: "/qhse/moc/management-change/form",
  },
  {
    key: "due-diligence",
    label: "Due diligence / subcontractor audits",
    submodules: [
      {
        key: "vendor-onboarding",
        label: "Vendor Onboarding",
        href: "/qhse/due-diligence-subconstructor/vendors",
      },
      {
        key: "audit-sub-contractor",
        label: "Audit Form - Sub Contractor",
        href: "/qhse/due-diligence-subconstructor/audit-sub-contractor/list-admin",
      },
      {
        key: "due-diligence-questionnaire",
        label: "Supplier Due Diligence Questionnaire",
        href: "/qhse/due-diligence-subconstructor/due-diligence-questionnaire/questionnaire-list-admin",
      },
    ],
  },
  {
    key: "master",
    label: "Master Database",
    adminOnly: true,
    submodules: [
      {
        key: "vendor-register",
        label: "Vendor Register",
        href: "/qhse/master/vendor-register",
      },
      {
        key: "auditor-register",
        label: "Auditor Register",
        href: "/qhse/master/auditor-register",
      },
    ],
  },
  {
    key: "audits",
    label: "Audits & inspection planner",
    href: "/qhse/audit-inspection-planner/form",
  },
  {
    key: "poac",
    label: "POAC cross competency",
    href: "/qhse/poac/cross-competency/list",
  },
  {
    key: "risk-assessment-main",
    label: "Risk Assessment",
    href: "/qhse/risk-assessment/form",
  },
  {
    key: "archive",
    label: "Archive",
    href: "/qhse/archive",
  },
];

export default function QhseSidebar() {
  const { isSidebarOpen, setIsSidebarOpen } = useQhseSidebar();
  const { isQhseAdmin } = useQhseRole();
  const visibleSidebarTabs = sidebarTabs.filter((tab) => !tab.adminOnly || isQhseAdmin);
  const [activeTab, setActiveTab] = useState("training");
  const [expandedNestedSubmodules, setExpandedNestedSubmodules] = useState(
    new Set()
  );
  const sidebarRef = useRef(null);
  const navScrollRef = useRef(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive active tab from current route, auto-expand nested submodules, and
  // scroll it into view — all in one effect. Splitting the scroll into a
  // second effect keyed on `activeTab` caused a race on every navigation:
  // since this sidebar remounts fresh per page (it's not in the shared
  // layout), that second effect fired once with the stale initial "training"
  // tab before this effect's setState had flushed, smooth-scrolling there,
  // then immediately again to the real tab — two competing smooth-scrolls
  // that left the sidebar stuck showing the wrong tabs. Deriving the tab
  // into a local variable and scrolling to it directly here avoids the
  // stale intermediate scroll entirely.
  useEffect(() => {
    let nextTab = null;

    if (pathname.startsWith("/qhse/controlled-document-register")) {
      nextTab = "controlled-document-register";
    } else if (pathname.startsWith("/qhse/defects-list")) {
      nextTab = "defects";
    } else if (pathname.startsWith("/qhse/training")) {
      nextTab = "training";
    } else if (pathname.startsWith("/qhse/near-miss")) {
      nextTab = "near-miss";
    } else if (pathname.startsWith("/qhse/moc")) {
      nextTab = "moc";
    } else if (pathname.startsWith("/qhse/due-diligence-subconstructor")) {
      nextTab = "due-diligence";
      // Auto-expand the nested submodule if we're on one of its pages
      if (
        pathname.startsWith("/qhse/due-diligence-subconstructor/vendors")
      ) {
        setExpandedNestedSubmodules(
          (prev) => new Set([...prev, "vendor-onboarding"])
        );
      } else if (
        pathname.startsWith(
          "/qhse/due-diligence-subconstructor/audit-sub-contractor"
        )
      ) {
        setExpandedNestedSubmodules(
          (prev) => new Set([...prev, "audit-sub-contractor"])
        );
      } else if (
        pathname.startsWith(
          "/qhse/due-diligence-subconstructor/due-diligence-questionnaire"
        )
      ) {
        setExpandedNestedSubmodules(
          (prev) => new Set([...prev, "due-diligence-questionnaire"])
        );
      }
    } else if (pathname.startsWith("/qhse/drills")) {
      nextTab = "drills";
    } else if (pathname.startsWith("/qhse/best-practice")) {
      nextTab = "best-practices";
    } else if (pathname.startsWith("/qhse/poac/cross-competency")) {
      nextTab = "poac";
    } else if (pathname.startsWith("/qhse/forms-checklist")) {
      nextTab = "forms";
      // Auto-expand the nested submodule if we're on one of its pages
      if (pathname.startsWith("/qhse/forms-checklist/base-audit")) {
        setExpandedNestedSubmodules(
          (prev) => new Set([...prev, "base-audit"])
        );
      } else if (pathname.startsWith("/qhse/forms-checklist/transfer-audit")) {
        setExpandedNestedSubmodules(
          (prev) => new Set([...prev, "transfer-audit"])
        );
      } else if (
        pathname.startsWith("/qhse/forms-checklist/hse-induction-checklist")
      ) {
        setExpandedNestedSubmodules(
          (prev) => new Set([...prev, "hse-induction-checklist"])
        );
      } else if (pathname.startsWith("/qhse/forms-checklist/vendor-supply")) {
        setExpandedNestedSubmodules(
          (prev) => new Set([...prev, "vendor-supply"])
        );
      } else if (
        pathname.startsWith(
          "/qhse/forms-checklist/equipment-base-stock-level"
        )
      ) {
        setExpandedNestedSubmodules(
          (prev) => new Set([...prev, "equipment-base-stock-level"])
        );
      } else if (
        pathname.startsWith("/qhse/forms-checklist/transfer-location-quest")
      ) {
        setExpandedNestedSubmodules(
          (prev) => new Set([...prev, "transfer-location-quest"])
        );
      } else if (
        pathname.startsWith("/qhse/forms-checklist/new-base-setup-checklist")
      ) {
        setExpandedNestedSubmodules(
          (prev) => new Set([...prev, "new-base-setup-checklist"])
        );
      }
    } else if (pathname.startsWith("/qhse/master")) {
      nextTab = "master";
    } else if (pathname.startsWith("/qhse/audit-inspection-planner")) {
      nextTab = "audits";
    } else if (pathname.startsWith("/qhse/risk-assessment")) {
      nextTab = "risk-assessment-main";
    } else if (pathname.startsWith("/qhse/archive")) {
      nextTab = "archive";
    }

    if (!nextTab) return;
    setActiveTab(nextTab);

    const frame = requestAnimationFrame(() => {
      const container = navScrollRef.current;
      if (!container) return;
      // Prefer the specific active submodule/leaf marker over the parent
      // tab's own container — for tabs with submodules (e.g. Due diligence),
      // scrolling the whole expanded cluster into view can leave the actual
      // active submodule cut off below the fold if the cluster is taller
      // than the visible sidebar area.
      const target =
        container.querySelector('[data-sidebar-active="true"]') ||
        container.querySelector(`[data-sidebar-tab="${nextTab}"]`);
      target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  const handleModuleClick = (tab) => {
    setActiveTab(tab.key);
    // If we're on the main QHSE page, use query params to show form inline
    if (pathname === "/qhse" || pathname === "/qhse/") {
      setActiveTab(tab.key);
      // Navigate to first submodule using query params
      if (tab.submodules && tab.submodules.length > 0) {
        const firstSub = tab.submodules[0];
        if (firstSub.href) {
          // Extract module and submodule from href
          const hrefParts = firstSub.href.split("/");
          const moduleIndex = hrefParts.findIndex(
            (part) => part === "training" || part === "drills"
          );
          if (moduleIndex !== -1) {
            const module = hrefParts[moduleIndex];
            const submodule = hrefParts[moduleIndex + 2] || "plan"; // e.g., "plan" or "record"
            router.push(`/qhse?module=${module}&submodule=${submodule}`);
            return;
          }
        }
      }
      return;
    }

    // If module has submodules, navigate to first submodule
    if (tab.submodules && tab.submodules.length > 0) {
      const firstSub = tab.submodules[0];
      if (firstSub.nestedSubmodules && firstSub.nestedSubmodules.length > 0) {
        router.push(firstSub.nestedSubmodules[0].href);
      } else if (firstSub.href) {
        router.push(firstSub.href);
      }
    } else if (tab.href) {
      router.push(tab.href);
    } else {
      setActiveTab(tab.key);
    }
  };

  const handleNestedSubmoduleClick = (subKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedNestedSubmodules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subKey)) {
        newSet.delete(subKey);
      } else {
        newSet.add(subKey);
      }
      return newSet;
    });
  };

  return (
    <>
      {/* Left Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full w-[260px] sm:w-[300px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-white/20 shadow-2xl backdrop-blur-md z-50 transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-orange-500/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30">
                <span className="text-white text-xl">⚡</span>
              </div>
              <h2 className="text-lg font-bold text-white">QHSE Modules</h2>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition hover:scale-110"
              aria-label="Close sidebar"
            >
              <span className="text-white text-lg">×</span>
            </button>
          </div>

          {/* Navigation Items */}
          <div
            ref={navScrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden p-4 [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent transition-all duration-200"
          >
            <div className="space-y-1.5">
              {visibleSidebarTabs.map((tab) => (
                <div
                  key={tab.key}
                  className="space-y-1"
                  data-sidebar-tab={tab.key}
                >
                  {tab.href ? (
                    <Link
                      href={tab.href}
                      data-sidebar-tab={tab.key}
                      data-sidebar-active={activeTab === tab.key ? "true" : undefined}
                      className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                        activeTab === tab.key
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-[1.02]"
                          : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 hover:scale-[1.01]"
                      }`}
                    >
                      {tab.icon && (
                        <span className="text-lg transition-transform group-hover:scale-110">
                          {tab.icon}
                        </span>
                      )}
                      <span className="flex-1">{tab.label}</span>
                      {activeTab === tab.key && (
                        <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                      )}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      data-sidebar-tab={tab.key}
                      onClick={() => handleModuleClick(tab)}
                      className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                        activeTab === tab.key
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-[1.02]"
                          : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 hover:scale-[1.01]"
                      }`}
                    >
                      {tab.icon && (
                        <span className="text-lg transition-transform group-hover:scale-110">
                          {tab.icon}
                        </span>
                      )}
                      <span className="flex-1">{tab.label}</span>
                      {tab.submodules && (
                        <span
                          className={`text-sm transition-transform ${
                            activeTab === tab.key ? "rotate-90" : ""
                          }`}
                        >
                          ▶
                        </span>
                      )}
                      {activeTab === tab.key && (
                        <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                      )}
                    </button>
                  )}
                  {tab.submodules && activeTab === tab.key && (
                    <div className="ml-4 space-y-1 mt-1.5 pl-4 border-l-2 border-orange-500/30">
                      {tab.submodules.map((sub) => {
                        const isOnMainPage =
                          pathname === "/qhse" || pathname === "/qhse/";

                        // Convert href to query params for main page
                        const getSubmoduleLink = (href) => {
                          if (isOnMainPage && href) {
                            // Extract module and submodule from href
                            const hrefParts = href.split("/");
                            const moduleIndex = hrefParts.findIndex(
                              (part) => part === "training" || part === "drills"
                            );
                            if (moduleIndex !== -1) {
                              const module = hrefParts[moduleIndex];
                              const submodule =
                                hrefParts[moduleIndex + 2] || "plan";
                              return `/qhse?module=${module}&submodule=${submodule}`;
                            }
                          }
                          return href;
                        };

                        const isVendorEditFromList =
                          pathname.startsWith(
                            "/qhse/forms-checklist/vendor-supply/form"
                          ) &&
                          searchParams?.get("from") === "list";

                        // Special handling for equipment-base-stock-level: highlight when on any of its pages (form, list, admin)
                        const isEquipmentBaseStock = sub.key === "equipment-base-stock-level" &&
                          pathname.startsWith("/qhse/forms-checklist/equipment-base-stock-level");

                        // Forms & checklist: highlight submenu when on any page under that submodule (e.g. base-audit/form or base-audit/list)
                        const isFormsSubPath = tab.key === "forms" &&
                          pathname.startsWith("/qhse/forms-checklist/" + sub.key);

                        let isActiveSub =
                          isEquipmentBaseStock ||
                          isFormsSubPath ||
                          pathname === sub.href ||
                          pathname.startsWith(sub.href + "/") ||
                          (isOnMainPage &&
                            searchParams?.get("module") === tab.key &&
                            searchParams?.get("submodule") ===
                              (sub.href?.split("/").pop() ||
                                sub.key.split("-").pop()));

                        // Special handling: when editing vendor-supply form from list,
                        // keep the "List" submodule active instead of "Form"
                        if (tab.key === "forms") {
                          if (sub.key === "vendor-supply-list" && isVendorEditFromList) {
                            isActiveSub = true;
                          }
                          if (sub.key === "vendor-supply-form" && isVendorEditFromList) {
                            isActiveSub = false;
                          }
                        }
                        const isExpanded = expandedNestedSubmodules.has(
                          sub.key
                        );
                        const hasActiveNested = sub.nestedSubmodules?.some(
                          (nested) =>
                            pathname === nested.href ||
                            pathname.startsWith(nested.href + "/") ||
                            (isOnMainPage &&
                              searchParams?.get("module") === "due-diligence" &&
                              searchParams?.get("submodule") ===
                                nested.key.split("-").pop())
                        );

                        return (
                          <div key={sub.key}>
                            {sub.nestedSubmodules ? (
                              <>
                                <button
                                  onClick={(e) =>
                                    handleNestedSubmoduleClick(sub.key, e)
                                  }
                                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 border mb-1 ${
                                    hasActiveNested
                                      ? "text-orange-300 bg-orange-500/10 border-orange-500/30"
                                      : "text-orange-300/80 bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10 hover:border-orange-500/30"
                                  }`}
                                >
                                  <span>{sub.label}</span>
                                  <span
                                    className={`text-sm transition-transform ${
                                      isExpanded ? "rotate-90" : ""
                                    }`}
                                  >
                                    ▶
                                  </span>
                                </button>
                                {isExpanded && (
                                  <div className="ml-2 space-y-1 mb-2">
                                    {sub.nestedSubmodules.map((nested) => {
                                      const isActiveNested =
                                        pathname === nested.href ||
                                        pathname.startsWith(
                                          nested.href + "/"
                                        ) ||
                                        (isOnMainPage &&
                                          searchParams?.get("module") ===
                                            "due-diligence" &&
                                          searchParams?.get("submodule") ===
                                            nested.key.split("-").pop());
                                      return (
                                        <Link
                                          key={nested.key}
                                          href={getSubmoduleLink(nested.href)}
                                          data-sidebar-active={isActiveNested ? "true" : undefined}
                                          className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
                                            isActiveNested
                                              ? "bg-white/20 text-white border-orange-400/50 shadow-md"
                                              : "text-white/70 hover:bg-white/10 hover:text-white border-white/5 hover:border-white/10"
                                          }`}
                                        >
                                          <span className="flex items-center gap-2">
                                            <span className="text-xs">▸</span>
                                            {nested.label}
                                          </span>
                                        </Link>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            ) : (
                              <Link
                                href={getSubmoduleLink(sub.href)}
                                data-sidebar-active={isActiveSub ? "true" : undefined}
                                className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
                                  isActiveSub
                                    ? "bg-white/20 text-white border-orange-400/50 shadow-md"
                                    : "text-white/80 hover:bg-white/10 hover:text-white border-white/5 hover:border-white/10"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-xs">▸</span>
                                  {sub.label}
                                </span>
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-slate-800/50">
            <p className="text-[10px] text-slate-400 text-center">
              QHSE Management System
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar Toggle Button */}
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
