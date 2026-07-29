"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useEffect, useMemo, useState } from "react";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditIconButton, ViewIconButton, DownloadIconButton } from "../../../components/ActionIcons";
import { useQhseRole } from "@/hooks/useQhseRole";
import { QhseListPageContainer } from "../../../components/QhseListPageContainer";

/* ---------------- helpers ---------------- */

// Generate dynamic years: 2 years back, current year, and 5 years forward
function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  // 2 years in the past
  for (let i = currentYear - 2; i < currentYear; i++) {
    years.push(i);
  }
  // Current year and 5 years forward
  for (let i = currentYear; i <= currentYear + 5; i++) {
    years.push(i);
  }
  return years;
}

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

function getStatusBadge(status) {
  const map = {
    DRAFT: "bg-slate-700/40 border-slate-400/60 text-slate-100",
    UNDER_REVIEW: "bg-yellow-500/20 border-yellow-500/50 text-yellow-300",
    APPROVED: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300",
    REJECTED: "bg-red-500/20 border-red-500/50 text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        map[status] || map.DRAFT
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

/* ---------------- component ---------------- */

export default function VendorSupplyListClient() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const router = useRouter();
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();

  const currentYear = new Date().getFullYear();
  const initialYears = useMemo(() => getYears(), []);
  const [year, setYear] = useState("");
  const [availableYears, setAvailableYears] = useState(initialYears);
  const [loadingYears, setLoadingYears] = useState(true);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingId, setSubmittingId] = useState(null);
  const [downloadingDocx, setDownloadingDocx] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [formToReject, setFormToReject] = useState(null);
  const [filter, setFilter] = useState("DRAFT");
  const [selectedForm, setSelectedForm] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchForms = async () => {
    setLoading(true);
    setPageLoading(true);
    setError("");
    try {
      const url = year !== "" && year != null
        ? `/api/qhse/form-checklist/vendor-supply-form/list?year=${year}`
        : "/api/qhse/form-checklist/vendor-supply-form/list";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load forms");
      setForms(data.data || []);
      // Merge dynamic years from API so the dropdown surfaces every record
      // year, not just the rolling window the client computes locally.
      if (Array.isArray(data.years)) {
        setAvailableYears((prev) =>
          Array.from(new Set([...prev, ...data.years])).sort((a, b) => b - a)
        );
      }
      // Update selected form if it exists
      if (selectedForm) {
        const updated = (data.data || []).find(
          (f) => f._id === selectedForm._id
        );
        if (updated) setSelectedForm(updated);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
      setLoadingYears(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, [year]);

  const filteredForms = useMemo(
    () => (filter === "ALL" ? forms : forms.filter((form) => form.status === filter)),
    [forms, filter]
  );

  const vendorSearchFiltered = useMemo(() => {
    if (!searchTerm.trim()) return filteredForms;
    const s = searchTerm.toLowerCase();
    return filteredForms.filter(
      (f) =>
        (f.serialNumber || "").toLowerCase().includes(s) ||
        (f.formCode || f.formNo || "").toLowerCase().includes(s) ||
        (f.vendorName || "").toLowerCase().includes(s)
    );
  }, [filteredForms, searchTerm]);

  const vendorSupplyListPagination = useOperationsClientPagination(
    vendorSearchFiltered,
    `${searchTerm}|${filter}|${year}|${forms.length}`
  );
  const { paginatedItems: paginatedVendorRows, ...vendorSupplyListPaginationFooterProps } =
    vendorSupplyListPagination;

  const handleEdit = (id) => {
    if (!canEdit) return;
    router.push(
      `/qhse/forms-checklist/vendor-supply/form?edit=${id}&from=list`
    );
  };

  const handleDownloadDocx = async (form) => {
    if (!canDownload) return;
    setDownloadingDocx(form._id);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/vendor-supply-form/${form._id}/download`
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to download document");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Vendor-Supplier-Approval-${form.serialNumber || form._id}.docx`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download document");
    } finally {
      setDownloadingDocx(null);
    }
  };

  const handleDownloadPdf = async (form) => {
    if (!canDownload) return;
    setDownloadingPdf(form._id);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/vendor-supply-form/${form._id}/download/pdf`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download PDF");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Vendor-Supplier-Approval-${form.serialNumber || form._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleApprove = async (id) => {
    if (!canApprove) return;
    if (!confirm("Are you sure you want to approve this vendor/supplier form?")) return;
    setApprovingId(id);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/vendor-supply-form/${id}/approval`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "APPROVED",
            approvedBy: "admin",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve form");
      await fetchForms();
      if (selectedForm && selectedForm._id === id && data.data) {
        setSelectedForm(data.data);
      }
      alert("Vendor/Supplier form approved successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const openRejectModal = (form) => {
    setFormToReject(form);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!canApprove) return;
    if (!formToReject || !rejectionReason.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }
    setRejectingId(formToReject._id);
    setError("");
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/vendor-supply-form/${formToReject._id}/approval`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "REJECTED",
            rejectionReason: rejectionReason.trim(),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject form");
      setShowRejectModal(false);
      setFormToReject(null);
      setRejectionReason("");
      await fetchForms();
      if (selectedForm && selectedForm._id === formToReject._id && data.data) {
        setSelectedForm(data.data);
      }
      alert("Vendor/Supplier form rejected.");
    } catch (err) {
      setError(err.message);
    } finally {
      setRejectingId(null);
    }
  };

  const handleSubmitForm = async (id) => {
    if (!confirm("Submit this form for review?")) return;

    setSubmittingId(id);
    try {
      const res = await fetch(
        `/api/qhse/form-checklist/vendor-supply-form/${id}/update`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "UNDER_REVIEW" }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      await fetchForms();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) return null;

  /* ---------------- UI ---------------- */

  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
        {/* Header */}
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/dashboard"
            className="flex-shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / Forms & Checklist / Vendor & Supplier
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              Vendor / Supplier Approval – Forms
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-037</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <a
              href="/templates/controlled-register/QAF-OFD-037.xlsx"
              download
              className="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
              title="Download form template (QAF-OFD-037)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
              </svg>
              Template
            </a>
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/forms-checklist/vendor-supply/form"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Vendor Form
              </Link>
              <Link
                href="/qhse/forms-checklist/vendor-supply/list"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Vendor List
              </Link>
              {isQhseAdmin && (
                <Link
                  href="/qhse/forms-checklist/vendor-supply/admin"
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
                >
                  Vendor Admin
                </Link>
              )}
            </div>
          </div>
        </header>

        <QhseListPageContainer
          searchPlaceholder="Search by serial, form code, vendor..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          filterChildren={
            <>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
              <select
                className="theme-select rounded-full px-3 py-1 text-xs tracking-widest uppercase"
                value={year === null || year === undefined ? "" : year}
                onChange={(e) => {
                  const v = e.target.value;
                  setYear(v === "" ? "" : Number(v));
                }}
                disabled={loadingYears}
              >
                <option value="">All years</option>
                {loadingYears ? (
                  <option disabled>Loading…</option>
                ) : (
                  availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))
                )}
              </select>
              {["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED", "ALL"].map((key) => {
                const labelMap = { DRAFT: "Draft", UNDER_REVIEW: "Under Review", APPROVED: "Approved", REJECTED: "Rejected", ALL: "All" };
                const active = filter === key;
                const base = "px-4 py-2 rounded-lg text-sm font-medium transition border";
                const activeClass = key === "DRAFT" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/50" : key === "UNDER_REVIEW" ? "bg-sky-500/20 text-sky-300 border-sky-500/50" : key === "APPROVED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" : key === "REJECTED" ? "bg-red-500/20 text-red-300 border-red-500/50" : "bg-slate-700/50 text-white/80 border-sky-400/40";
                const inactiveClass = "bg-slate-800/40 text-white/70 border-slate-500/40 hover:bg-slate-700/60";
                return (
                  <button key={key} type="button" onClick={() => setFilter(key)} className={`${base} ${active ? activeClass : inactiveClass}`}>
                    {labelMap[key]}
                  </button>
                );
              })}
            </>
          }
        >
          {error && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
              {error}
            </div>
          )}
          {vendorSearchFiltered.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
            <p className="text-white/60 text-sm">
              {filter === "DRAFT"
                ? "No draft forms found."
                : filter === "UNDER_REVIEW"
                ? "No forms under review."
                : filter === "APPROVED"
                ? "No approved forms."
                : filter === "REJECTED"
                ? "No rejected forms."
                : "No vendor approval forms found."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Detail Card - Show when form is selected */}
            {selectedForm && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Form Details
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                      {selectedForm.formCode || selectedForm.formNo || "N/A"}
                      {selectedForm.serialNumber && ` • ${selectedForm.serialNumber}`}
                      {" • Year: "}{selectedForm.year ?? "N/A"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {canDownload && (
                      <DownloadIconButton
                        onClick={() => handleDownloadDocx(selectedForm)}
                        disabled={downloadingDocx === selectedForm._id || downloadingPdf === selectedForm._id}
                        loading={downloadingDocx === selectedForm._id}
                        title="Download as Word"
                      />
                    )}
                    {canDownload && (
                      <DownloadIconButton
                        onClick={() => handleDownloadPdf(selectedForm)}
                        disabled={downloadingPdf === selectedForm._id || downloadingDocx === selectedForm._id}
                        loading={downloadingPdf === selectedForm._id}
                        title="Download as PDF"
                        className="!text-rose-400 hover:!text-rose-300"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedForm(null)}
                      className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Status</p>
                    {getStatusBadge(selectedForm.status)}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Form Code</p>
                    <p className="text-sm text-white">{selectedForm.formCode || selectedForm.formNo || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Serial</p>
                    <p className="text-sm text-white font-mono">{selectedForm.serialNumber || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Vendor Name</p>
                    <p className="text-sm text-white">{selectedForm.vendorName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Vendor Address</p>
                    <p className="text-sm text-white">{selectedForm.vendorAddress || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Date</p>
                    <p className="text-sm text-white">{formatDate(selectedForm.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Year</p>
                    <p className="text-sm text-white">{selectedForm.year || "—"}</p>
                  </div>
                </div>

                {/* Requested By / For Accounts – names + signatures in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Requested By</p>
                    <p className="text-sm text-white">{selectedForm.requestedBy || "—"}</p>
                    {selectedForm.requestedBySignatureImage && (
                      <div className="mt-2 inline-block rounded-md border border-white/15 bg-white/95 p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedForm.requestedBySignatureImage}
                          alt="Requested by signature"
                          className="h-16 w-auto max-w-[220px] object-contain"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">For Accounts (Sign)</p>
                    <p className="text-sm text-white">{selectedForm.forAccountsSign || "—"}</p>
                    {selectedForm.forAccountsSignSignatureImage && (
                      <div className="mt-2 inline-block rounded-md border border-white/15 bg-white/95 p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedForm.forAccountsSignSignatureImage}
                          alt="For accounts signature"
                          className="h-16 w-auto max-w-[220px] object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Ratings and Scores */}
                <div className="border-t border-white/10 pt-4 space-y-4">
                  <h3 className="text-base font-semibold text-white">Ratings & Scores</h3>
                  
                  {/* Supply of Parts */}
                  <div className="rounded-xl border border-white/10 p-4 space-y-3" style={{ backgroundColor: '#153d59' }}>
                    <h4 className="text-sm font-semibold text-white">For Supply of Parts</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Technical Comparison</p>
                        <p className="text-white">{selectedForm.supplyOfParts?.technicalComparison || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Commercial Comparison</p>
                        <p className="text-white">{selectedForm.supplyOfParts?.commercialComparison || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Legal Entity</p>
                        <p className="text-white">{selectedForm.supplyOfParts?.legalEntityForServiceOrSupply || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Agrees to Oceane Terms</p>
                        <p className="text-white">{selectedForm.supplyOfParts?.agreesToOceaneTerms || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Infrastructure & Facilities</p>
                        <p className="text-white">{selectedForm.supplyOfParts?.infrastructureAndFacilities || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Previous Experience</p>
                        <p className="text-white">{selectedForm.supplyOfParts?.previousExperienceExpertise || "—"}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-xs text-slate-400 mb-1">Parts Percentage Score</p>
                      <p className="text-lg font-bold text-sky-300">
                        {selectedForm.supplyOfParts?.percentageScore || 0}%
                      </p>
                    </div>
                  </div>

                  {/* Supply of Services */}
                  <div className="rounded-xl border border-white/10 p-4 space-y-3" style={{ backgroundColor: '#153d59' }}>
                    <h4 className="text-sm font-semibold text-white">For Supply of Services</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Skilled Manpower Availability</p>
                        <p className="text-white">{selectedForm.supplyOfServices?.skilledManpowerAvailability || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Contractor Certifications</p>
                        <p className="text-white">{selectedForm.supplyOfServices?.contractorCertifications || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">HSE System / Due Diligence</p>
                        <p className="text-white">{selectedForm.supplyOfServices?.hseSystemDueDiligence || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Insurance & Work Permit</p>
                        <p className="text-white">{selectedForm.supplyOfServices?.insuranceAndWorkPermit || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Previous Experience (Years)</p>
                        <p className="text-white">{selectedForm.supplyOfServices?.previousExperienceYears || "—"}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-xs text-slate-400 mb-1">Services Percentage Score</p>
                      <p className="text-lg font-bold text-sky-300">
                        {selectedForm.supplyOfServices?.percentageScore || 0}%
                      </p>
                    </div>
                  </div>

                  {/* Overall Result */}
                  <div className="rounded-xl border border-sky-500/40 bg-sky-900/20 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-sky-200">Overall Percentage Score</p>
                        <p className="text-sm text-slate-200 mt-1">
                          {selectedForm.approvedVendorEligible
                            ? "Vendor is eligible for approval (≥80%)"
                            : "Vendor needs improvement (<80%)"}
                        </p>
                      </div>
                      <p
                        className={`text-3xl font-extrabold ${
                          selectedForm.overallPercentageScore >= 80
                            ? "text-emerald-300"
                            : "text-amber-300"
                        }`}
                      >
                        {selectedForm.overallPercentageScore || 0}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                {(selectedForm.requestedBySignatureImage ||
                  selectedForm.forAccountsSignSignatureImage) && (
                  <div className="border-t border-white/10 pt-4 space-y-3">
                    <h3 className="text-base font-semibold text-white">Signatures</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-white/10 p-4" style={{ backgroundColor: "#153d59" }}>
                        <p className="text-xs text-slate-400 mb-1">Requested By (Sign)</p>
                        <p className="text-sm text-white mb-2">{selectedForm.requestedBy || "—"}</p>
                        {selectedForm.requestedBySignatureImage ? (
                          <div className="inline-block rounded-md border border-white/15 bg-white p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selectedForm.requestedBySignatureImage}
                              alt="Requested by signature"
                              className="h-20 w-auto max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No signature uploaded</p>
                        )}
                      </div>
                      <div className="rounded-xl border border-white/10 p-4" style={{ backgroundColor: "#153d59" }}>
                        <p className="text-xs text-slate-400 mb-1">For Accounts (Sign)</p>
                        <p className="text-sm text-white mb-2">{selectedForm.forAccountsSign || "—"}</p>
                        {selectedForm.forAccountsSignSignatureImage ? (
                          <div className="inline-block rounded-md border border-white/15 bg-white p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selectedForm.forAccountsSignSignatureImage}
                              alt="For accounts signature"
                              className="h-20 w-auto max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No signature uploaded</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                {selectedForm.approvedBy && (
                  <div className="border-t border-white/10 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Approved By</p>
                        <p className="text-sm text-white">{selectedForm.approvedBy}</p>
                      </div>
                      {selectedForm.approvedAt && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Approved At</p>
                          <p className="text-sm text-white">{formatDate(selectedForm.approvedAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedForm.rejectionReason && (
                  <div className="border-t border-white/10 pt-4">
                    <p className="text-xs text-slate-400 mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-300">{selectedForm.rejectionReason}</p>
                  </div>
                )}

                {/* Action Buttons */}
                {selectedForm.status === "DRAFT" && (
                  <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/10">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedForm(null);
                          handleEdit(selectedForm._id);
                        }}
                        className="px-4 py-2 rounded-lg border border-white/25 bg-white/10 text-white/90 hover:bg-white/20 transition text-sm font-medium"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        handleSubmitForm(selectedForm._id);
                        setSelectedForm(null);
                      }}
                      disabled={submittingId === selectedForm._id}
                      className="px-6 py-2.5 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingId === selectedForm._id ? "Submitting..." : "Submit"}
                    </button>
                  </div>
                )}
                {selectedForm.status === "UNDER_REVIEW" && canApprove && (
                  <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => openRejectModal(selectedForm)}
                      disabled={approvingId === selectedForm._id}
                      className="px-5 py-2.5 rounded-lg border border-red-500/50 bg-red-500/10 text-red-300 font-medium hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {rejectingId === selectedForm._id ? "Rejecting…" : "Reject"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedForm._id)}
                      disabled={rejectingId === selectedForm._id}
                      className="px-5 py-2.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {approvingId === selectedForm._id ? "Approving…" : "Approve"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* List View - Hidden when detail card is shown */}
            {!selectedForm && (
              <div className="space-y-4">
                {paginatedVendorRows.map((form) => (
                  <div
                    key={form._id}
                    className="bg-white/5 border border-white/10 rounded-xl px-6 py-4 flex items-center justify-between gap-4 hover:border-white/20 transition"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-sm font-semibold text-white/90 truncate max-w-sm">
                          {form.vendorName || "Unnamed Vendor"}
                        </h2>
                        {getStatusBadge(form.status)}
                        {(form.formCode || form.formNo) && (
                          <span className="text-xs font-mono text-sky-300">
                            {form.formCode || form.formNo}
                          </span>
                        )}
                        {form.serialNumber && (
                          <span className="text-xs font-mono text-white/80">
                            {form.serialNumber}
                          </span>
                        )}
                        {typeof form.overallPercentageScore === "number" && (
                          <span className="text-xs text-sky-300 font-semibold">
                            Overall Score: {form.overallPercentageScore}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/60 line-clamp-1">
                        {form.vendorAddress || "No address provided"}
                      </p>
                      <div className="flex gap-4 text-[11px] text-white/50">
                        <span>Date: {formatDate(form.date)}</span>
                        <span>
                          Created: {formatDate(form.createdAt)} • Updated:{" "}
                          {formatDate(form.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <ViewIconButton onClick={() => setSelectedForm(form)} />
                      {canDownload && (
                        <DownloadIconButton
                          onClick={() => handleDownloadDocx(form)}
                          disabled={downloadingDocx === form._id || downloadingPdf === form._id}
                          loading={downloadingDocx === form._id}
                          title="Download as Word"
                        />
                      )}
                      {canDownload && (
                        <DownloadIconButton
                          onClick={() => handleDownloadPdf(form)}
                          disabled={downloadingPdf === form._id || downloadingDocx === form._id}
                          loading={downloadingPdf === form._id}
                          title="Download as PDF"
                          className="!text-rose-400 hover:!text-rose-300"
                        />
                      )}
                      {form.status === "DRAFT" && canEdit && (
                        <>
                          <EditIconButton onClick={() => handleEdit(form._id)} />
                          <button
                            type="button"
                            onClick={() => handleSubmitForm(form._id)}
                            disabled={submittingId === form._id}
                            className="px-4 py-2 rounded-full text-xs font-semibold border border-sky-400/60 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30 transition disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {submittingId === form._id ? "Submitting..." : "Submit"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <OperationsListPaginationFooter {...vendorSupplyListPaginationFooterProps} />
              </div>
            )}
          </div>
        )}
        </QhseListPageContainer>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-white/20 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">
              Reject Vendor/Supplier Form
            </h3>
            <p className="text-sm text-white/70 mb-4">
              Please provide a reason for rejecting this form:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-sky-500/50 resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                  setFormToReject(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 font-semibold text-sm hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!rejectionReason.trim() || rejectingId}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 font-semibold text-sm hover:bg-red-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rejectingId ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
