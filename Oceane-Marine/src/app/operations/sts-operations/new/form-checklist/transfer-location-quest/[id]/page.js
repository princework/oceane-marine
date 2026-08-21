"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useOperationsLoading } from "@/app/operations/OperationsLoadingContext";
import { useOperationsSidebar } from "@/app/operations/OperationsSidebarContext";
import { useOperationsRole } from "@/hooks/useOperationsRole";
import { useQhseRole } from "@/hooks/useQhseRole";
import {
  getSidebarTabs,
  isFormsSubmoduleSidebarActive,
} from "@/app/operations/sts-operations/new/sidebarTabs";

const LIST_HREF = "/operations/sts-operations/new/form-checklist/transfer-location-quest/list";

const SECTIONS = [
  {
    key: "location",
    title: "1. Location Information",
    fields: [
      { name: "locationName", label: "Transfer Location Name" },
      { name: "latitude", label: "Latitude" },
      { name: "longitude", label: "Longitude" },
      { name: "country", label: "Country" },
      { name: "portOrOffshoreArea", label: "Port / Offshore Area" },
      { name: "waterDepth", label: "Water Depth" },
    ],
  },
  {
    key: "environmental",
    title: "2. Environmental Conditions",
    fields: [
      { name: "weatherConditions", label: "Weather Conditions" },
      { name: "windLimits", label: "Wind Limits" },
      { name: "waveHeight", label: "Wave Height" },
      { name: "currentSpeed", label: "Current Speed" },
      { name: "tidalInformation", label: "Tidal Information" },
    ],
  },
  {
    key: "traffic",
    title: "3. Traffic Information",
    fields: [
      { name: "nearbyShippingLanes", label: "Nearby Shipping Lanes" },
      { name: "anchorageDetails", label: "Anchorage Details" },
      { name: "trafficDensity", label: "Traffic Density" },
    ],
  },
  {
    key: "regulatory",
    title: "4. Regulatory Information",
    fields: [
      { name: "localAuthorityApproval", label: "Local Authority Approval" },
      { name: "portAuthorityRequirements", label: "Port Authority Requirements" },
      { name: "environmentalRestrictions", label: "Environmental Restrictions" },
    ],
  },
  {
    key: "emergencySupport",
    title: "5. Emergency Support",
    fields: [
      { name: "nearestTug", label: "Nearest Tug" },
      { name: "pilotAvailability", label: "Pilot Availability" },
      { name: "medicalAssistance", label: "Medical Assistance" },
      { name: "emergencyContacts", label: "Emergency Contacts" },
    ],
  },
  {
    key: "communication",
    title: "6. Communication",
    fields: [
      { name: "vhfChannels", label: "VHF Channels" },
      { name: "contactPersons", label: "Contact Persons" },
      { name: "communicationProcedures", label: "Communication Procedures" },
    ],
  },
  {
    key: "operationalRestrictions",
    title: "7. Operational Restrictions",
    fields: [
      { name: "dayNightOperationAllowed", label: "Day/Night Operation Allowed" },
      { name: "maximumVesselSize", label: "Maximum Vessel Size" },
      { name: "draftLimitations", label: "Draft Limitations" },
      { name: "mooringRestrictions", label: "Mooring Restrictions" },
    ],
  },
];

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status) {
  const statusConfig = {
    "Pending Approval": "bg-amber-500/15 text-amber-300 border-amber-400/40",
    Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
    Rejected: "bg-red-500/15 text-red-300 border-red-400/40",
  };
  const className = statusConfig[status] || "bg-slate-500/15 text-slate-300 border-slate-400/40";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border ${className}`}
    >
      {status}
    </span>
  );
}

/** Shared left sidebar + toggle, identical shell to every other Operations "form-checklist" page. */
function OperationsSidebarChrome({ isSidebarOpen, setIsSidebarOpen, sidebarTabs, activeTab, expandedModules, setExpandedModules, pathname }) {
  return (
    <>
      <div
        className={`fixed left-0 top-0 h-full w-[260px] sm:w-[300px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-white/20 shadow-2xl backdrop-blur-md z-50 transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
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

          <div className="p-4 border-t border-white/10 bg-slate-800/50">
            <p className="text-[10px] text-slate-400 text-center">
              Operations Management System
            </p>
          </div>
        </div>
      </div>

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

export default function TransferLocationQuestReviewPage() {
  const pathname = usePathname();
  const params = useParams();
  const recordId = params.id;

  const { isSidebarOpen, setIsSidebarOpen } = useOperationsSidebar();
  const { setPageLoading } = useOperationsLoading();
  const { isOpsAdmin } = useOperationsRole();
  const { canApprove } = useQhseRole();
  const sidebarTabs = getSidebarTabs(isOpsAdmin);
  const [activeTab] = useState("forms");
  const [expandedModules, setExpandedModules] = useState(new Set(["forms"]));

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    const fetchRecord = async () => {
      if (!recordId) return;
      setLoading(true);
      setPageLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/qhse/form-checklist/transfer-location-quest/submissions/${recordId}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load questionnaire");
        }
        setRecord(data.data);
      } catch (err) {
        setError(err.message || "Failed to load questionnaire");
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    };
    fetchRecord();
  }, [recordId]);

  const handleApprove = async () => {
    if (!canApprove || !record) return;
    if (!window.confirm("Approve this Transfer Location Questionnaire? The linked operation will move to In Progress.")) return;

    setApproving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/transfer-location-quest/${recordId}/approve`,
        { method: "PUT" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve");
      }
      setRecord(data.data);
    } catch (err) {
      setError(err.message || "Failed to approve");
    } finally {
      setApproving(false);
    }
  };

  const openRejectModal = () => {
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!canApprove || !record) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      setError("Rejection reason is required.");
      return;
    }

    setRejecting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/transfer-location-quest/${recordId}/reject`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason: reason }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject");
      }
      setShowRejectModal(false);
      setRejectionReason("");
      setRecord(data.data);
    } catch (err) {
      setError(err.message || "Failed to reject");
    } finally {
      setRejecting(false);
    }
  };

  const chromeProps = {
    isSidebarOpen,
    setIsSidebarOpen,
    sidebarTabs,
    activeTab,
    expandedModules,
    setExpandedModules,
    pathname,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent text-white flex">
        <OperationsSidebarChrome {...chromeProps} />
        <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
          <div className="flex items-center justify-center h-screen">
            <p className="text-white/60">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !record) {
    return (
      <div className="min-h-screen bg-transparent text-white flex">
        <OperationsSidebarChrome {...chromeProps} />
        <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
          <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-10">
            <div className="rounded-3xl border border-red-500/40 bg-red-950/40 p-6">
              <p className="text-red-300">{error || "Questionnaire not found"}</p>
              <Link
                href={LIST_HREF}
                className="mt-4 inline-block rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Back to List
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white flex">
      <OperationsSidebarChrome {...chromeProps} />

      <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"}`}>
        <div className={`mx-auto py-6 sm:py-10 space-y-4 sm:space-y-6 ${isSidebarOpen ? "max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4" : "px-3 sm:px-6"}`}>
          <header
            className={`${isSidebarOpen ? "mt-0" : "mt-8 md:mt-0"} mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4`}
          >
            <Link
              href={LIST_HREF}
              className="flex-shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
            >
              ← List
            </Link>
            <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
                Operations / Forms & Checklist / Transfer Location Questionnaire
              </p>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                Operation {record.operationRef}
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 mt-1">
                Form code: <span className="font-mono font-semibold text-sky-300">{record.formCode || "QAF-OFD-049"}</span>
                {record.serialNumber ? ` • ${record.serialNumber}` : ""}
              </p>
            </div>
            <div className="flex-shrink-0">{getStatusBadge(record.status)}</div>
          </header>

          {error && (
            <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <span className="text-slate-400">Submitted by:</span>{" "}
                <span className="text-white">{record.submittedByName || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Submitted email:</span>{" "}
                <span className="text-white">{record.submittedByEmail || "—"}</span>
              </div>
            </div>
          </div>

          {SECTIONS.map((section) => (
            <div
              key={section.key}
              className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl"
            >
              <h2 className="text-sm font-semibold text-white border-b border-white/10 pb-3 mb-3">
                {section.title}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div key={field.name}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                      {field.label}
                    </p>
                    <p className="text-sm text-white/90">
                      {record[section.key]?.[field.name] || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <div className="grid gap-4 md:grid-cols-2 text-xs text-slate-400">
              <div>
                <span className="font-semibold">Submitted:</span> {formatDateTime(record.createdAt)}
              </div>
              {record.updatedAt && (
                <div>
                  <span className="font-semibold">Last Updated:</span> {formatDateTime(record.updatedAt)}
                </div>
              )}
            </div>
            {record.status === "Rejected" && record.rejectionReason && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-red-300/90 mb-1">
                  Rejection reason
                </p>
                <p className="text-sm text-red-200/90 whitespace-pre-wrap">{record.rejectionReason}</p>
              </div>
            )}
          </div>

          {canApprove && record.status === "Pending Approval" && (
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-4 sm:px-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={openRejectModal}
                disabled={rejecting || approving}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-red-400/50 bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-50 transition"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || rejecting}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-emerald-400/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition inline-flex items-center gap-2"
              >
                {approving ? (
                  <span className="inline-block w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-100 rounded-full animate-spin" />
                ) : null}
                {approving ? "Approving…" : "Approve"}
              </button>
            </div>
          )}
        </div>

        {showRejectModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tlq-reject-modal-title"
          >
            <div className="bg-slate-800 border border-white/15 rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 id="tlq-reject-modal-title" className="text-lg font-semibold text-white mb-4">
                Reject Questionnaire
              </h2>
              <p className="text-slate-300 text-sm mb-3">
                Operation: {record.operationRef} • {record.serialNumber || "—"}
              </p>
              <label htmlFor="tlq-reject-reason" className="block text-sm text-slate-400 mb-1">
                Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                id="tlq-reject-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 text-white px-3 py-2 text-sm min-h-[100px] resize-y"
                placeholder="Enter rejection reason…"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason("");
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectSubmit}
                  disabled={rejecting}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 border border-red-400/50 hover:bg-red-500/30 disabled:opacity-50"
                >
                  {rejecting ? "Rejecting…" : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
