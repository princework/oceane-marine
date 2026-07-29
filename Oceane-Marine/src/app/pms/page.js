"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import EquipmentTesting from "./equipment-testing/EquipmentTesting";
import PrimaryEquipment from "./equipment-inventory/primary-equipment/PrimaryEquipment";
import Accessories from "./equipment-inventory/accessories/Accessories";
import PmsLocationMaster from "./location/PmsLocationMaster";
import WarehouseManagement from "./warehouse-management/WarehouseManagement";
import { usePmsRole } from "@/hooks/usePmsRole";

export default function PmsPage() {
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

  const [activeTab, setActiveTab] = useState("equipment-inventory");
  const [activeSubmodule, setActiveSubmodule] = useState("primary-equipment");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const sidebarRef = useRef(null);
  const [primaryEquipmentTab, setPrimaryEquipmentTab] = useState("form");
  const [accessoriesView, setAccessoriesView] = useState("form");
  const [warehouseView, setWarehouseView] = useState("form");

  return (
    <div className="min-h-screen bg-transparent text-white flex">
      {/* Left Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full w-[260px] sm:w-[280px] bg-slate-900/70 border-r border-white/20 shadow-2xl backdrop-blur-[2px] z-50 transition-transform duration-300 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
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
                  <button
                    onClick={() => {
                      setActiveTab(tab.key);
                      if (tab.submodules && tab.submodules.length > 0) {
                        setActiveSubmodule(tab.submodules[0].key);
                      }
                    }}
                    className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === tab.key
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40"
                        : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{tab.label}</span>
                      {tab.submodules && (
                        <span className={`text-xs transition-transform ${activeTab === tab.key ? "rotate-90" : ""
                          }`}>
                          ▶
                        </span>
                      )}
                    </div>
                  </button>

                  {tab.submodules && activeTab === tab.key && (
                    <div className="ml-4 mt-2 space-y-1 pl-4 border-l-2 border-orange-500/30">
                      {tab.submodules.map((sub) => (
                        <button
                          key={sub.key}
                          onClick={() => setActiveSubmodule(sub.key)}
                          className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${activeSubmodule === sub.key
                              ? "bg-white/20 text-white border-orange-400/50 shadow-md"
                              : "text-white/80 hover:bg-white/10 hover:text-white border-white/5 hover:border-white/10"
                            }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-xs">▸</span>
                            {sub.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Toggle + Dashboard (mobile) */}
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
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold shadow-lg shadow-black/25 backdrop-blur-[2px] transition"
          >
            ← Dashboard
          </Link>
        </div>
      )}

      {/* Main Content */}
      <div
        className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-0 md:ml-[280px]" : "mx-auto max-w-7xl"}`}
      >
        <div className={`mx-auto py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-[95%] px-3 sm:pl-4 sm:pr-4" : "px-3 sm:px-4 md:px-6"}`}>
          <header className="mt-12 md:mt-0 mb-2 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            {/* Left: Dashboard */}
            <Link
              href="/dashboard"
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-[2px] transition flex-shrink-0"
            >
              ← Dashboard
            </Link>

            {/* Center: Title */}
            <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
                PMS
              </p>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Planned maintenance system</h1>
            </div>

            {/* Right: Form/List Tabs (warehouse: full-width row, centered on small screens) */}
            <div
              className={`flex items-center gap-2 sm:gap-3 flex-shrink-0 ${
                activeTab === "warehouse-management"
                  ? "w-full justify-center sm:justify-end md:w-auto md:self-auto"
                  : "self-end sm:self-auto"
              }`}
            >
              {activeTab === "equipment-inventory" &&
                activeSubmodule === "primary-equipment" && (
                  <div className="inline-flex rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setPrimaryEquipmentTab("form")}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                        primaryEquipmentTab === "form"
                          ? "text-white bg-orange-500 hover:bg-orange-600"
                          : "text-white/90 hover:bg-white/10"
                      }`}
                    >
                      Form
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrimaryEquipmentTab("list")}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                        primaryEquipmentTab === "list"
                          ? "text-white bg-orange-500 hover:bg-orange-600"
                          : "text-white/90 hover:bg-white/10"
                      }`}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrimaryEquipmentTab("history")}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                        primaryEquipmentTab === "history"
                          ? "text-white bg-orange-500 hover:bg-orange-600"
                          : "text-white/90 hover:bg-white/10"
                      }`}
                    >
                      History
                    </button>
                  </div>
                )}

              {activeTab === "equipment-inventory" &&
                activeSubmodule === "accessories" && (
                  <div className="inline-flex rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                    <button
                      onClick={() => setAccessoriesView("form")}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                        accessoriesView === "form"
                          ? "text-white bg-orange-500 hover:bg-orange-600"
                          : "text-white/90 hover:bg-white/10"
                      }`}
                    >
                      Form
                    </button>
                    <button
                      onClick={() => setAccessoriesView("list")}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                        accessoriesView === "list"
                          ? "text-white bg-orange-500 hover:bg-orange-600"
                          : "text-white/90 hover:bg-white/10"
                      }`}
                    >
                      List
                    </button>
                  </div>
                )}

              {activeTab === "warehouse-management" && (
                <div className="inline-flex rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                  <button
                    onClick={() => setWarehouseView("form")}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                      warehouseView === "form"
                        ? "text-white bg-orange-500 hover:bg-orange-600"
                        : "text-white/90 hover:bg-white/10"
                    }`}
                  >
                    Form
                  </button>
                  <button
                    onClick={() => setWarehouseView("list")}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                      warehouseView === "list"
                        ? "text-white bg-orange-500 hover:bg-orange-600"
                        : "text-white/90 hover:bg-white/10"
                    }`}
                  >
                    List
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Tab Content */}
          <div className="rounded-xl sm:rounded-2xl md:rounded-3xl border border-white/10 bg-[#0b2740]/45 backdrop-blur-[2px] p-3 sm:p-4 md:p-6 shadow-2xl">
            {activeTab === "equipment-inventory" &&
              activeSubmodule === "primary-equipment" && (
                <PrimaryEquipment
                  activeTab={primaryEquipmentTab}
                  onChangeTab={setPrimaryEquipmentTab}
                />
              )}
            {activeTab === "equipment-inventory" && activeSubmodule === "accessories" && (
              <Accessories
                view={accessoriesView}
                onViewChange={setAccessoriesView}
              />
            )}
            {activeTab === "warehouse-management" && (
              <WarehouseManagement
                view={warehouseView}
                onViewChange={setWarehouseView}
              />
            )}
            {activeTab === "location" && isPmsAdmin && <PmsLocationMaster />}
            {activeTab === "equipment-testing" && <EquipmentTesting />}
          </div>
        </div>
      </div>
    </div>
  );
}