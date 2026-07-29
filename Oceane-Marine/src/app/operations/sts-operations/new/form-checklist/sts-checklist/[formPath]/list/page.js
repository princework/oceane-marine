"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname, useParams } from "next/navigation";
import { useOperationsLoading } from "@/app/operations/OperationsLoadingContext";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import {
  ActionViewIcon,
  ActionEditIcon,
  ActionDeleteIcon,
} from "@/app/components/RecordActionIcons";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";
import { QhseListPageContainer } from "@/app/qhse/components/QhseListPageContainer";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import OperationsSelectField from "@/app/operations/components/OperationsSelectField";

const FORM_TITLES = {
  'ops-ofd-001': 'OPS-OFD-001 - Before Operation Commence',
  'ops-ofd-001a': 'OPS-OFD-001A - Ship Standard Questionnaire',
  'ops-ofd-002': 'OPS-OFD-002 - Before Run In & Mooring',
  'ops-ofd-003': 'OPS-OFD-003 - Before Cargo Transfer (3A & 3B)',
  'ops-ofd-004': 'OPS-OFD-004 - Pre-Transfer Agreements (4A-4F)',
  'ops-ofd-005': 'OPS-OFD-005 - During Transfer (5A-5C)',
  'ops-ofd-005b': 'OPS-OFD-005B - Before Disconnection & Unmooring',
  'ops-ofd-005c': 'OPS-OFD-005C - Terminal Transfer Checklist',
  'ops-ofd-005d': 'OPS-OFD-005D - Declaration for STS operations (At port & Terminal)',
  'ops-ofd-028': 'OPS-OFD-028 - Personnel Transfer Basket Checklist',
  'ops-ofd-009': 'OPS-OFD-009 - Mooring Master\'s Job Report',
  'ops-ofd-011': 'OPS-OFD-011 - STS Standing Order',
  'ops-ofd-014': 'OPS-OFD-014 - Equipment Checklist',
  'ops-ofd-015': 'OPS-OFD-015 - Hourly Quantity Log',
  'ops-ofd-018': 'OPS-OFD-018 - STS Timesheet',
  'ops-ofd-020': 'OPS-OFD-020 - Master\'s Feedback Form',
  'ops-ofd-023': 'OPS-OFD-023 - Record of Work Hours (Rest Hours CKL)',
  'ops-ofd-029': 'OPS-OFD-029 - Mooring Master Expense Sheet',
};

const API_BASE_URL = '/api/operations/sts-checklist';

const STATUS_COLORS = {
  DRAFT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  SUBMITTED: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  APPROVED: 'bg-green-500/20 text-green-300 border-green-500/40',
  SIGNED: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  ARCHIVED: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
  FINALIZED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function FormListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const formPath = params.formPath;
  const { isOpsAdmin, canEditForm, canDeleteForm } = useOperationsRole();
  const sidebarTabs = getSidebarTabs(isOpsAdmin);

  const currentYear = new Date().getFullYear();
  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const [activeTab, setActiveTab] = useState("forms");
  const [expandedModules, setExpandedModules] = useState(new Set(["forms"]));
  const sidebarRef = useRef(null);
  
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [selectedYear, setSelectedYear] = useState(currentYear); // Default to current year, but can be cleared
  const [availableYears, setAvailableYears] = useState([currentYear]);
  const [searchTerm, setSearchTerm] = useState("");
  const { setPageLoading } = useOperationsLoading();

  useEffect(() => {
    fetchForms();
  }, [formPath, selectedYear]);

  const fetchForms = async () => {
    try {
      setLoading(true);
      setError(null);
      setPageLoading(true);

      // Build URL with year parameter only if a year is selected
      let url = `${API_BASE_URL}/${formPath}/list`;
      if (selectedYear) {
        url += `?year=${selectedYear}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch forms');
      }

      const result = await response.json();
      
      if (result.success) {
        setForms(result.data || []);
        setAvailableYears(result.years || [currentYear]);
      } else {
        throw new Error(result.error || 'Failed to fetch forms');
      }
    } catch (err) {
      console.error('Error fetching forms:', err);
      setError(err.message);
      setForms([]);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  const handleView = (id) => {
    router.push(`/operations/sts-operations/new/form-checklist/sts-checklist/${formPath}/view/${id}`);
  };

  const handleEdit = (id) => {
    router.push(`/operations/sts-operations/new/form-checklist/sts-checklist/${formPath}/edit/${id}`);
  };

  const handleDelete = async (id) => {
    if (!confirm(`Are you sure you want to delete this form? This action cannot be undone.`)) {
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch(
        `${API_BASE_URL}/${formPath}/${id}/delete`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete record");
      }

      // Refresh the list
      fetchForms();
    } catch (err) {
      setError(err.message || "Failed to delete record");
    } finally {
      setDeleting(null);
    }
  };

  const getFormDisplayFields = (form) => {
    const rawVessel =
      form.vesselDetails?.vesselName ??
      form.vesselName ??
      '';
    const vessel = typeof rawVessel === 'string' && rawVessel ? rawVessel : '—';
    const rawLocation =
      form.vesselDetails?.transferLocation ??
      form.transferLocation ??
      form.transferLocationName ??
      '';
    const location = typeof rawLocation === 'string' && rawLocation ? rawLocation : '—';
    const issueDate = form.issueDate ?? form.revisionDate ?? form.vesselDetails?.plannedTransferDateTime ?? form.documentInfo?.revisionDate ?? form.createdAt;
    // Many forms (e.g. OPS-OFD-028) store formNo/revisionNo inside documentInfo
    const formNoFromTitle = FORM_TITLES[formPath]?.split(' - ')[0];
    const formNo = form.formNo ?? form.documentInfo?.formNo ?? formNoFromTitle ?? '—';
    const revisionNo = form.revisionNo ?? form.documentInfo?.revisionNo ?? '—';
    return {
      formNo,
      revisionNo,
      issueDate,
      vessel,
      location,
    };
  };

  const searchFiltered = !searchTerm.trim()
    ? forms
    : forms.filter((form) => {
        const s = searchTerm.toLowerCase();
        const fields = getFormDisplayFields(form);
        return (
          String(form.sequenceNumber || "").toLowerCase().includes(s) ||
          String(fields.formNo || "").toLowerCase().includes(s) ||
          String(fields.revisionNo || "").toLowerCase().includes(s) ||
          String(fields.vessel || "").toLowerCase().includes(s) ||
          String(fields.location || "").toLowerCase().includes(s) ||
          String(form.status || "").toLowerCase().includes(s)
        );
      });

  const pagination = useOperationsClientPagination(
    searchFiltered,
    `${selectedYear ?? ""}|${searchTerm}|${formPath}`
  );
  const { paginatedItems: paginatedForms, ...paginationFooterProps } = pagination;

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
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                {FORM_TITLES[formPath] || `Form ${formPath}`}
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 mt-1">All submitted forms</p>
            </div>
            <div className="flex justify-center md:justify-end shrink-0">
              <Link
                href="/operations/sts-operations/new/form-checklist/sts-checklist"
                className="px-3 sm:px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-white text-xs sm:text-sm font-medium hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                ← Back to Forms
              </Link>
            </div>
          </header>

          <QhseListPageContainer
            searchPlaceholder="Search by sequence, form no., vessel, location, status..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterChildren={
              <>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
                <OperationsSelectField
                  variant="pill"
                  ariaLabel="Year filter"
                  value={selectedYear != null ? String(selectedYear) : ""}
                  onChange={(v) => setSelectedYear(v ? Number(v) : null)}
                  options={[
                    { value: "", label: "All Years" },
                    ...availableYears.map((y) => ({
                      value: String(y),
                      label: String(y),
                    })),
                  ]}
                  triggerClassName="ops-select-trigger rounded-full px-3 py-1 text-xs tracking-widest uppercase"
                />
              </>
            }
          >
            {error && (
              <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
                {error}
              </div>
            )}

            {forms.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-white/60">
                  {selectedYear ? `No forms found for ${selectedYear}.` : "No forms found."}
                </p>
              </div>
            ) : searchFiltered.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-white/60">No rows match your search.</p>
              </div>
            ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Sequence No
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Form No
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Rev No
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Issue Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Vessel
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-white/90 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-white/90 uppercase tracking-wider w-48">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {paginatedForms.map((form) => {
                      const fields = getFormDisplayFields(form);
                      return (
                        <tr key={form._id} className="hover:bg-white/5 transition">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-mono font-semibold text-sky-400">
                              {form.sequenceNumber || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-orange-400">
                              {fields.formNo}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-white/90">
                              {fields.revisionNo}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-white/90">
                              {formatDate(fields.issueDate)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-white/90">
                              {fields.vessel || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-white/90">
                              {fields.location || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_COLORS[form.status] || STATUS_COLORS.DRAFT}`}>
                              {form.status || 'DRAFT'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-2 justify-center">
                              <ActionViewIcon onClick={() => handleView(form._id)} title="View" />
                              {canEditForm && (
                                <ActionEditIcon onClick={() => handleEdit(form._id)} title="Edit" />
                              )}
                              {canDeleteForm && (
                                <ActionDeleteIcon
                                  onClick={() => handleDelete(form._id)}
                                  disabled={deleting === form._id}
                                  loading={deleting === form._id}
                                  title="Delete"
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
