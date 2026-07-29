"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { ActionViewIcon } from "@/app/components/RecordActionIcons";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import { QhseListPageContainer } from "@/app/qhse/components/QhseListPageContainer";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";

const FORMS = [
  { formNo: 'OPS-OFD-001', title: 'Before Operation Commence', apiPath: 'ops-ofd-001' },
  { formNo: 'OPS-OFD-001A', title: 'Ship Standard Questionnaire', apiPath: 'ops-ofd-001a' },
  { formNo: 'OPS-OFD-002', title: 'Before Run In & Mooring', apiPath: 'ops-ofd-002' },
  { formNo: 'OPS-OFD-003', title: 'Before Cargo Transfer (3A & 3B)', apiPath: 'ops-ofd-003' },
  { formNo: 'OPS-OFD-004', title: 'Pre-Transfer Agreements (4A-4F)', apiPath: 'ops-ofd-004' },
  { formNo: 'OPS-OFD-005', title: 'During Transfer (5A-5C)', apiPath: 'ops-ofd-005' },
  { formNo: 'OPS-OFD-005B', title: 'Before Disconnection & Unmooring', apiPath: 'ops-ofd-005b' },
  { formNo: 'OPS-OFD-005C', title: 'Terminal Transfer Checklist', apiPath: 'ops-ofd-005c' },
  { formNo: 'OPS-OFD-005E', title: 'Declaration Of STS At Sea', apiPath: 'declaration-of-sea' },
  { formNo: 'OPS-OFD-005D', title: 'Declaration for STS operations (At port & Terminal)', apiPath: 'ops-ofd-005d' },
  { formNo: 'OPS-OFD-028', title: 'Personnel Transfer Basket Checklist', apiPath: 'ops-ofd-028' },
  { formNo: 'OPS-OFD-009', title: 'Mooring Master\'s Job Report', apiPath: 'ops-ofd-009' },
  { formNo: 'OPS-OFD-011', title: 'STS Standing Order', apiPath: 'ops-ofd-011' },
  { formNo: 'OPS-OFD-014', title: 'Equipment Checklist', apiPath: 'ops-ofd-014' },
  { formNo: 'OPS-OFD-015', title: 'Hourly Quantity Log', apiPath: 'ops-ofd-015' },
  { formNo: 'OPS-OFD-018', title: 'STS Timesheet', apiPath: 'ops-ofd-018' },
  { formNo: 'OPS-OFD-029', title: 'Mooring Master Expense Sheet', apiPath: 'ops-ofd-029' },
];

export default function StsChecklistListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const { isOpsAdmin } = useOperationsRole();
  const sidebarTabs = getSidebarTabs(isOpsAdmin);
  const [activeTab, setActiveTab] = useState("forms");
  const [expandedModules, setExpandedModules] = useState(new Set(["forms"]));
  const sidebarRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");

  const formsFiltered = FORMS.filter((f) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      f.formNo.toLowerCase().includes(s) ||
      f.title.toLowerCase().includes(s) ||
      f.apiPath.toLowerCase().includes(s)
    );
  });

  const pagination = useOperationsClientPagination(formsFiltered, searchTerm);
  const { paginatedItems: formsPage, ...paginationFooterProps } = pagination;

  const handleViewList = (apiPath) => {
    router.push(`/operations/sts-operations/new/form-checklist/sts-checklist/${apiPath}/list`);
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex">
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
              <h2 className="text-lg font-bold text-white">Operations Modules</h2>
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
          <div className="flex-1 overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent transition-all duration-200">
            <div className="space-y-1.5">
              {sidebarTabs.map((tab) => (
                <div key={tab.key} className="space-y-1">
                  {tab.submodules ? (
                    <>
                      <button
                        onClick={() => {
                          setExpandedModules((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(tab.key)) {
                              newSet.delete(tab.key);
                            } else {
                              newSet.add(tab.key);
                            }
                            return newSet;
                          });
                        }}
                        className={`group flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                          activeTab === tab.key
                            ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-[1.02]"
                            : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 hover:scale-[1.01]"
                        }`}
                      >
                        <span className="flex-1">{tab.label}</span>
                        <span
                          className={`text-sm transition-transform ${
                            expandedModules.has(tab.key) ? "rotate-90" : ""
                          }`}
                        >
                          ▶
                        </span>
                        {activeTab === tab.key && (
                          <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                        )}
                      </button>
                      {expandedModules.has(tab.key) && (
                        <div className="ml-4 space-y-1 mt-1.5 pl-4 border-l-2 border-orange-500/30">
                          {tab.submodules.map((submodule) => {
                            const isActiveSub = isFormsSubmoduleSidebarActive(
                              pathname,
                              submodule.href
                            );
                            return (
                              <Link
                                key={submodule.key}
                                href={submodule.href}
                                className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
                                  isActiveSub
                                    ? "bg-gradient-to-r from-orange-500/90 to-orange-600/90 text-white border-orange-400 shadow-lg"
                                    : "text-white/80 hover:bg-white/10 hover:text-white border-white/5 hover:border-white/10"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-xs">▸</span>
                                  {submodule.label}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={tab.href}
                      className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                        activeTab === tab.key
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/40 scale-[1.02]"
                          : "text-white/90 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 hover:scale-[1.01]"
                      }`}
                    >
                      <span className="flex-1">{tab.label}</span>
                      {activeTab === tab.key && (
                        <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                      )}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-slate-800/50">
            <p className="text-[10px] text-slate-400 text-center">
              Operations Management System
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

      {/* Main Content */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
        <div className={`mx-auto py-6 sm:py-10 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`}>
          <header
            className={`${isSidebarOpen ? "mt-0" : "mt-8 md:mt-0"} mb-2 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4`}
          >
            <Link
              href="/dashboard"
              className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
            >
              ← Dashboard
            </Link>
            <div className="flex-1 min-w-0 flex flex-col items-center text-center w-full md:w-auto">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
                Operations / Forms & Checklist / STS Checklist
              </p>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">STS Checklist</h1>
              <p className="text-xs sm:text-sm text-slate-200 mt-1">
                Select a form to view all submitted entries
              </p>
            </div>
            <div className="shrink-0 md:w-[140px]" aria-hidden />
          </header>

          <QhseListPageContainer
            searchPlaceholder="Search by form number or title..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
          >
          {formsFiltered.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/60 text-sm">
              No forms match your search.
            </div>
          ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                      Form Number
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                      Form Title
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-white/90 uppercase tracking-wider w-32">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {formsPage.map((form, index) => (
                    <tr
                      key={form.formNo}
                      className="hover:bg-white/5 transition"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-orange-400 font-semibold">
                          {form.formNo}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/90">{form.title}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <ActionViewIcon
                            onClick={() => handleViewList(form.apiPath)}
                            title="View list"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <OperationsListPaginationFooter {...paginationFooterProps} />
          </div>
          )}
          </QhseListPageContainer>
        </div>
      </div>
    </div>
  );
}
