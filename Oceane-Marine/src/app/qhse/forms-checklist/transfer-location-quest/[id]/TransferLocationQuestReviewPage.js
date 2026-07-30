"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

export default function TransferLocationQuestReviewPage() {
  const { setPageLoading } = useQhseLoading();
  const { canApprove } = useQhseRole();
  const { contentClassName } = useQhseSidebar();
  const params = useParams();
  const recordId = params.id;

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

  if (loading) return null;

  if (error && !record) {
    return (
      <div className={`${contentClassName} w-full min-w-0 pr-4`}>
        <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-10">
          <div className="rounded-3xl border border-red-500/40 bg-red-950/40 p-6">
            <p className="text-red-300">{error || "Questionnaire not found"}</p>
            <Link
              href="/qhse/forms-checklist/transfer-location-quest/list"
              className="mt-4 inline-block rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10 transition"
            >
              Back to List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/qhse/forms-checklist/transfer-location-quest/list"
            className="flex-shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← List
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / Transfer Location Questionnaire
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
  );
}
