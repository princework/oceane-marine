"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ARCHIVE_MODULES, buildArchivePayload, archiveDocument } from "../../../utils/archive";
import { ViewIconButton, ApproveIconButton, RejectIconButton, ArchiveIconButton, DeleteIconButton, DownloadIconButton } from "../../../components/ActionIcons";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";
import { QhseListPageContainer } from "../../../components/QhseListPageContainer";
import { useQhseMongoCursorList } from "../../../hooks/useQhseMongoCursorList";
import QhseCursorPaginationFooter from "../../../components/QhseCursorPaginationFooter";
import { resolveQhseSignatureImageSrc } from "@/lib/utils/qhse-signature-url";

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

function getSignatureSrc(value) {
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "not available" || trimmed.toLowerCase() === "n/a") return null;
  return resolveQhseSignatureImageSrc(trimmed);
}

export default function QuestionnaireListAdminPage() {
  const { setPageLoading } = useQhseLoading();
  const { canDelete, canApprove, canDownload } = useQhseRole();
  const { contentClassName } = useQhseSidebar();
  const [searchDebounced, setSearchDebounced] = useState("");
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [downloadingDocxId, setDownloadingDocxId] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);
  const [selectedForm, setSelectedForm] = useState(null);
  const [filterStatus, setFilterStatus] = useState("Pending"); // Pending = Pending Review
  const [searchTerm, setSearchTerm] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadPage = useCallback(
    async (requestCursor) => {
      const params = new URLSearchParams({
        paged: "cursor",
        limit: "10",
        status: filterStatus,
      });
      if (searchDebounced.trim()) {
        params.set("search", searchDebounced.trim());
      }
      if (requestCursor) params.set("cursor", requestCursor);
      const res = await fetch(
        `/api/qhse/due-diligence/due-diligence-questionnaire/list?${params.toString()}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load forms");
      }
      const rows = data.data || data.supplierDueDiligences || [];
      return { items: rows, hasNext: !!data.hasNext };
    },
    [filterStatus, searchDebounced]
  );

  const cursorResetKey = `${filterStatus}|${searchDebounced}`;
  const {
    items: listForms,
    loading,
    error,
    setError,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
    refreshFirstPage,
    setItems: setListForms,
  } = useQhseMongoCursorList(loadPage, cursorResetKey);

  useEffect(() => {
    setPageLoading(loading);
  }, [loading, setPageLoading]);

  // Clear selected form if it no longer matches the active filter
  useEffect(() => {
    if (selectedForm) {
      const matchesFilter =
        filterStatus === "All" || selectedForm.status === filterStatus;
      if (!matchesFilter) {
        setSelectedForm(null);
      }
    }
  }, [filterStatus, selectedForm]);

  const handleApprove = async (formId) => {
    if (!canApprove) return;
    if (!confirm("Are you sure you want to approve this form?")) {
      return;
    }

    setApproving(formId);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/due-diligence/due-diligence-questionnaire/${formId}/approve`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Check if response is JSON before parsing
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to approve form");
      }

      await refreshFirstPage();
      setSelectedForm(null);
      alert("Form approved successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setApproving(null);
    }
  };

  const handleDownloadDocx = async (form) => {
    if (!canDownload) return;
    setDownloadingDocxId(form._id);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/due-diligence/due-diligence-questionnaire/${form._id}/download`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let fileName = `Supplier-Due-Diligence-${form.serialNumber || form._id}.docx`;
      const contentDisposition = res.headers.get("Content-Disposition");
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^";]+)/i) || contentDisposition.match(/filename="?([^"]+)"?/i);
        if (match && match[1]) {
          fileName = match[1].trim().replace(/"$/g, "");
        }
      }
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download");
    } finally {
      setDownloadingDocxId(null);
    }
  };

  const handleDownloadPdf = async (form) => {
    if (!canDownload) return;
    setDownloadingPdfId(form._id);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/due-diligence/due-diligence-questionnaire/${form._id}/download/pdf`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download PDF");
      }
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let fileName = `Supplier-Due-Diligence-${form.serialNumber || form._id}.pdf`;
      const contentDisposition = res.headers.get("Content-Disposition");
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^";]+)/i) || contentDisposition.match(/filename="?([^"]+)"?/i);
        if (match && match[1]) {
          fileName = match[1].trim().replace(/"$/g, "");
        }
      }
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const openRejectModal = () => {
    if (!canApprove) return;
    setRejectionReasonInput("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!canApprove || !selectedForm) return;
    const reason = rejectionReasonInput.trim();
    if (!reason) {
      setError("Rejection reason is required.");
      return;
    }

    const formId = selectedForm._id;
    setRejecting(formId);
    setError(null);
    try {
      const res = await fetch(
        `/api/qhse/due-diligence/due-diligence-questionnaire/${formId}/reject`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rejectionReason: reason }),
        }
      );

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reject form");
      }

      setShowRejectModal(false);
      setRejectionReasonInput("");
      await refreshFirstPage();
      setSelectedForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRejecting(null);
    }
  };

  const handleArchive = async (form) => {
    if (!confirm("Archive this form? It will be stored in QHSE Archive (Due Diligence Questionnaire).")) return;
    setArchivingId(form._id);
    setError(null);
    try {
      const title = form.supplierDetails?.inchargeNameAndCompany || form.formCode || form.serialNumber || form._id;
      const payload = buildArchivePayload(ARCHIVE_MODULES.DUE_DILIGENCE_QUESTIONNAIRE, form, title, form.formCode);
      const result = await archiveDocument(payload);
      if (!result.success) throw new Error(result.error);
      await refreshFirstPage();
      if (selectedForm?._id === form._id) setSelectedForm(null);
      alert("Form archived successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (form) => {
    if (!canDelete) return;
    if (!confirm("Are you sure you want to delete this form? This cannot be undone.")) return;
    setDeleting(form._id);
    setError(null);
    try {
      const res = await fetch(`/api/qhse/due-diligence/due-diligence-questionnaire/${form._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setListForms((prev) => prev.filter((f) => f._id !== form._id));
      if (selectedForm?._id === form._id) setSelectedForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/dashboard"
            className="flex-shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / Due Diligence / Supplier Due Diligence Questionnaire
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Admin Review</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-043</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-043" />
          </div>
        </header>

        <QhseListPageContainer
          searchPlaceholder="Search by serial, form code, company, contact..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          filterChildren={
            <>
              {["Pending", "Approved", "Rejected", "All"].map((statusKey) => (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => {
                    setFilterStatus(statusKey);
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                    filterStatus === statusKey
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
                      : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {statusKey === "Pending" ? "Pending Review" : statusKey}
                </button>
              ))}
            </>
          }
        >
          {error && (
            <div className="text-xs text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <main className="space-y-6">
          {/* Detail Card - Shows when form is selected */}
          {selectedForm && (
            <div className="w-full rounded-2xl border border-white/10 bg-slate-800/95 backdrop-blur-md shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-sky-50 tracking-wide">
                      Form Details
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>
                        FORM CODE:{" "}
                        <span className="font-mono text-sky-300">
                          {selectedForm.formCode || "—"}
                        </span>
                      </span>
                      <span>
                        SERIAL:{" "}
                        <span className="font-mono text-emerald-300">
                          {selectedForm.serialNumber || "—"}
                        </span>
                      </span>
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border ${
                      selectedForm.status === "Approved"
                        ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/50"
                        : selectedForm.status === "Rejected"
                        ? "bg-red-500/15 text-red-200 border-red-400/50"
                        : "bg-sky-500/15 text-sky-200 border-sky-400/50"
                    }`}
                  >
                    {selectedForm.status || "Pending"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedForm(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800/80 hover:bg-slate-700 transition text-slate-100 text-xl font-bold border border-slate-600/60"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Supplier Details */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                    Supplier Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Company/Person Incharge: </span>
                      <span className="text-white">
                        {selectedForm.supplierDetails?.inchargeNameAndCompany || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Contact: </span>
                      <span className="text-white">
                        {selectedForm.supplierDetails?.contactDetails || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Registration: </span>
                      <span className="text-white">
                        {selectedForm.supplierDetails?.companyRegistrationDetails || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Parent Company: </span>
                      <span className="text-white">
                        {selectedForm.supplierDetails?.parentCompanyDetails || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Subsidiaries: </span>
                      <span className="text-white">
                        {selectedForm.supplierDetails?.hasSubsidiaries
                          ? selectedForm.supplierDetails?.subsidiariesDetails || "Yes"
                          : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Employees: </span>
                      <span className="text-white">
                        {selectedForm.supplierDetails?.employeeCount ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Business Activities: </span>
                      <span className="text-white">
                        {selectedForm.supplierDetails?.businessActivities || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Operating Locations: </span>
                      <span className="text-white">
                        {selectedForm.supplierDetails?.operatingLocations || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Payment Terms: </span>
                      <span className="text-white">
                        {selectedForm.supplierDetails?.paymentTerms || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Legal & Financial Declarations */}
                <div className="space-y-4 border-t border-white/10 pt-4">
                  <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                    Legal & Financial Declarations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Missing Licenses: </span>
                      <span className="text-white">
                        {selectedForm.legalDeclarations?.missingLicenses ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Criminal Offence History: </span>
                      <span className="text-white">
                        {selectedForm.legalDeclarations?.criminalOffenceHistory
                          ? "Yes"
                          : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Insolvency Status: </span>
                      <span className="text-white">
                        {selectedForm.legalDeclarations?.insolvencyStatus ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Business Misconduct: </span>
                      <span className="text-white">
                        {selectedForm.legalDeclarations?.businessMisconduct ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-slate-400">Unpaid Statutory Payments: </span>
                      <span className="text-white">
                        {selectedForm.legalDeclarations?.unpaidStatutoryPayments
                          ? "Yes"
                          : "No"}
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-slate-400">Declaration Details: </span>
                      <span className="text-white">
                        {selectedForm.legalDeclarations?.declarationDetails || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Insurance Details */}
                <div className="space-y-4 border-t border-white/10 pt-4">
                  <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                    Insurance Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">P&I: </span>
                      <span className="text-white">
                        {selectedForm.insuranceDetails?.pAndI || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Workers Compensation: </span>
                      <span className="text-white">
                        {selectedForm.insuranceDetails?.workersCompensation || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Public Liability: </span>
                      <span className="text-white">
                        {selectedForm.insuranceDetails?.publicLiability || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Other Insurance: </span>
                      <span className="text-white">
                        {selectedForm.insuranceDetails?.otherInsurance || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quality & Compliance */}
                <div className="space-y-4 border-t border-white/10 pt-4">
                  <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                    Quality & Compliance
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">QMS Registered: </span>
                      <span className="text-white">
                        {selectedForm.complianceDetails?.qualityManagementSystem?.registered
                          ? "Yes"
                          : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">QMS Accredited By: </span>
                      <span className="text-white">
                        {selectedForm.complianceDetails?.qualityManagementSystem
                          ?.accreditedBy || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Environmental Policy: </span>
                      <span className="text-white">
                        {selectedForm.complianceDetails?.environmentalPolicy ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">ESG Programme: </span>
                      <span className="text-white">
                        {selectedForm.complianceDetails?.esgProgramme ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Other Certifications: </span>
                      <span className="text-white">
                        {selectedForm.complianceDetails?.otherCertifications || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">ISO Certification: </span>
                      <span className="text-white">
                        {selectedForm.complianceDetails?.isoCertification || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Drug & Alcohol Policy: </span>
                      <span className="text-white">
                        {selectedForm.complianceDetails?.drugAlcoholPolicy ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Health & Safety Policy: </span>
                      <span className="text-white">
                        {selectedForm.complianceDetails?.healthSafetyPolicy ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Incidents Last 2 Years: </span>
                      <span className="text-white">
                        {selectedForm.complianceDetails?.incidentsLastTwoYears ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-slate-400">Incident Details: </span>
                      <span className="text-white">
                        {selectedForm.complianceDetails?.incidentDetails || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ethics & Governance */}
                <div className="space-y-4 border-t border-white/10 pt-4">
                  <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                    Ethics & Governance
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Ethical Conduct Policy: </span>
                      <span className="text-white">
                        {selectedForm.ethicsAndGovernance?.ethicalConductPolicy ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Equality & Diversity Policy: </span>
                      <span className="text-white">
                        {selectedForm.ethicsAndGovernance?.equalityDiversityPolicy
                          ? "Yes"
                          : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Subcontracting: </span>
                      <span className="text-white">
                        {selectedForm.ethicsAndGovernance?.subcontracting ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Subcontracting Details: </span>
                      <span className="text-white">
                        {selectedForm.ethicsAndGovernance?.subcontractingDetails || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Due Diligence For Subcontractors: </span>
                      <span className="text-white">
                        {selectedForm.ethicsAndGovernance?.dueDiligenceForSubcontractors
                          ? "Yes"
                          : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Anti-Corruption Acknowledged: </span>
                      <span className="text-white">
                        {selectedForm.ethicsAndGovernance?.antiCorruptionAcknowledged
                          ? "Yes"
                          : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Modern Slavery Acknowledged: </span>
                      <span className="text-white">
                        {selectedForm.ethicsAndGovernance?.modernSlaveryAcknowledged
                          ? "Yes"
                          : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Sanctions Exposure: </span>
                      <span className="text-white">
                        {selectedForm.ethicsAndGovernance?.sanctionsExposure ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial & Data Protection */}
                <div className="space-y-4 border-t border-white/10 pt-4">
                  <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                    Financial & Data Protection
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Credit Rating Details: </span>
                      <span className="text-white">
                        {selectedForm.financialAndData?.creditRatingDetails || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Turnover Last Two Years: </span>
                      <span className="text-white">
                        {selectedForm.financialAndData?.turnoverLastTwoYears || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Data Protection Policy: </span>
                      <span className="text-white">
                        {selectedForm.financialAndData?.dataProtectionPolicy ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-slate-400">Banker Details: </span>
                      <span className="text-white">
                        {selectedForm.financialAndData?.bankerDetails?.name || "—"},{" "}
                        {selectedForm.financialAndData?.bankerDetails?.branch || ""},{" "}
                        {selectedForm.financialAndData?.bankerDetails?.contactDetails || ""},{" "}
                        {selectedForm.financialAndData?.bankerDetails?.ibanOrAccountNumber ||
                          ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Declarations – with signature images */}
                {(selectedForm.generalDeclaration || selectedForm.purchasingDeclaration) && (
                  <div className="space-y-6 border-t border-white/10 pt-4">
                    <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                      Declarations & Signatures
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedForm.generalDeclaration && (
                        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                          <h4 className="text-sm font-semibold text-sky-200">General Declaration</h4>
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div>
                              <span className="text-slate-400">Name: </span>
                              <span className="text-white">{selectedForm.generalDeclaration.name || "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Position: </span>
                              <span className="text-white">{selectedForm.generalDeclaration.positionHeld || "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Signed At: </span>
                              <span className="text-white">{formatDate(selectedForm.generalDeclaration.signedAt)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-1">Signature: </span>
                              {getSignatureSrc(selectedForm.generalDeclaration.signature) ? (
                                <div className="p-3 rounded-lg border border-white/20 bg-white/5 inline-block">
                                  <img
                                    src={getSignatureSrc(selectedForm.generalDeclaration.signature)}
                                    alt="General declaration signature"
                                    className="max-h-20 w-auto max-w-[180px] object-contain block"
                                    decoding="async"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      const fallback = e.target.nextElementSibling;
                                      if (fallback) fallback.classList.remove("hidden");
                                    }}
                                  />
                                  <span className="text-slate-500 text-xs hidden">Image could not be displayed.</span>
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg border border-white/10 bg-white/5 inline-flex items-center justify-center min-h-[60px] min-w-[140px]">
                                  <span className="text-slate-500 text-sm">Signature not available</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {selectedForm.purchasingDeclaration && (
                        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                          <h4 className="text-sm font-semibold text-sky-200">Purchasing Declaration</h4>
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div>
                              <span className="text-slate-400">Name: </span>
                              <span className="text-white">{selectedForm.purchasingDeclaration.name || "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Position: </span>
                              <span className="text-white">{selectedForm.purchasingDeclaration.positionHeld || "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Signed At: </span>
                              <span className="text-white">{formatDate(selectedForm.purchasingDeclaration.signedAt)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-1">Signature: </span>
                              {getSignatureSrc(selectedForm.purchasingDeclaration.signature) ? (
                                <div className="p-3 rounded-lg border border-white/20 bg-white/5 inline-block">
                                  <img
                                    src={getSignatureSrc(selectedForm.purchasingDeclaration.signature)}
                                    alt="Purchasing declaration signature"
                                    className="max-h-20 w-auto max-w-[180px] object-contain block"
                                    decoding="async"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      const fallback = e.target.nextElementSibling;
                                      if (fallback) fallback.classList.remove("hidden");
                                    }}
                                  />
                                  <span className="text-slate-500 text-xs hidden">Image could not be displayed.</span>
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg border border-white/10 bg-white/5 inline-flex items-center justify-center min-h-[60px] min-w-[140px]">
                                  <span className="text-slate-500 text-sm">Signature not available</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Documents */}
                {Array.isArray(selectedForm.additionalDocuments) && selectedForm.additionalDocuments.length > 0 && (
                  <div className="space-y-4 border-t border-white/10 pt-4">
                    <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                      Additional Documents
                    </h3>
                    <ul className="space-y-2">
                      {selectedForm.additionalDocuments.map((doc, idx) => {
                        const href = doc.url || (doc.filePath ? (doc.filePath.startsWith("/") ? doc.filePath : `/${doc.filePath}`) : null) || "#";
                        return (
                          <li key={idx} className="flex items-center gap-2">
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-300 hover:text-sky-200 text-sm underline"
                            >
                              {doc.name || doc.fileName || `Document ${idx + 1}`}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Approve/Reject Buttons - Only show for Pending forms */}
                {canApprove && selectedForm.status === "Pending" ? (
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setSelectedForm(null)}
                      className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={openRejectModal}
                      disabled={rejecting === selectedForm._id || approving === selectedForm._id}
                      className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition disabled:opacity-60"
                    >
                      {rejecting === selectedForm._id ? "Rejecting..." : "Reject Form"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedForm._id)}
                      disabled={approving === selectedForm._id || rejecting === selectedForm._id}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition disabled:opacity-60"
                    >
                      {approving === selectedForm._id ? "Approving..." : "Approve Form"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setSelectedForm(null)}
                      className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold transition"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Table Section - Only show when no form is selected */}
          {!selectedForm && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-slate-100">Loading forms…</div>
                </div>
              ) : listForms.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-slate-100">
                    No{" "}
                    {filterStatus === "All"
                      ? ""
                      : filterStatus === "Submitted"
                      ? "pending"
                      : filterStatus.toLowerCase()}
                    {" "}
                    forms found.
                  </p>
                </div>
              ) : (
                <>
                  <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-200 border-b border-white/10">
                          <th className="py-3 pr-4 font-semibold">Form Code</th>
                          <th className="hidden py-3 pr-4 font-semibold md:table-cell">Serial No</th>
                          <th className="py-3 pr-4 font-semibold">
                            Company Name
                          </th>
                          <th className="py-3 pr-4 font-semibold">Contact</th>
                          <th className="py-3 pr-4 font-semibold">
                            Submitted At
                          </th>
                          <th className="py-3 pr-4 font-semibold">Status</th>
                          <th className="py-3 pr-4 font-semibold text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {listForms.map((form) => (
                          <tr
                            key={form._id}
                            className="border-b border-white/5 hover:bg-white/5 transition"
                          >
                            <td className="py-3 pr-4">
                              <span className="font-mono text-sky-300">
                                {form.formCode || "—"}
                              </span>
                            </td>
                            <td className="hidden py-3 pr-4 md:table-cell">
                              <span className="font-mono text-slate-200">
                                {form.serialNumber || "—"}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <div className="max-w-xs">
                                <p className="text-slate-200">
                                  {form.supplierDetails
                                    ?.inchargeNameAndCompany || "—"}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              {form.supplierDetails?.contactDetails || "—"}
                            </td>
                            <td className="py-3 pr-4">
                              {formatDate(form.updatedAt)}
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={`inline-flex items-center rounded-lg px-3 py-1 text-[10px] font-semibold uppercase tracking-wider border ${
                                  form.status === "Approved"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                                    : form.status === "Rejected"
                                    ? "bg-red-500/20 text-red-300 border-red-400/50"
                                    : "bg-blue-500/20 text-blue-300 border-blue-400/50"
                                }`}
                              >
                                {form.status || "Pending"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap py-2 pr-3 text-right sm:py-3 sm:pr-4">
                              <div className="inline-flex max-w-none flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                                {canDownload && (
                                  <DownloadIconButton
                                    onClick={() => handleDownloadDocx(form)}
                                    disabled={
                                      downloadingDocxId === form._id ||
                                      downloadingPdfId === form._id
                                    }
                                    loading={downloadingDocxId === form._id}
                                    title="Download as Word"
                                  />
                                )}
                                {canDownload && (
                                  <DownloadIconButton
                                    onClick={() => handleDownloadPdf(form)}
                                    disabled={
                                      downloadingPdfId === form._id ||
                                      downloadingDocxId === form._id
                                    }
                                    loading={downloadingPdfId === form._id}
                                    title="Download as PDF"
                                    className="!text-rose-400 hover:!text-rose-300"
                                  />
                                )}
                                <ViewIconButton
                                  onClick={() => setSelectedForm(form)}
                                  title="View Details"
                                />
                                <ArchiveIconButton
                                  onClick={() => handleArchive(form)}
                                  disabled={archivingId === form._id || deleting === form._id}
                                  loading={archivingId === form._id}
                                />
                                {canDelete && (
                                  <DeleteIconButton
                                    onClick={() => handleDelete(form)}
                                    disabled={archivingId === form._id || deleting === form._id}
                                    loading={deleting === form._id}
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <QhseCursorPaginationFooter
                    hasPrev={hasPrev}
                    hasNext={hasNext}
                    itemCount={listForms.length}
                    onPrev={() => {
                      void goPrev();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    onNext={() => {
                      void goNext();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    loading={loading}
                  />
                </>
              )}
            </div>
          )}
        </main>
        </QhseListPageContainer>
      </div>

      {showRejectModal && selectedForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dd-reject-modal-title"
        >
          <div className="bg-slate-800 border border-white/15 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="dd-reject-modal-title" className="text-lg font-semibold text-white mb-4">
              Reject Due Diligence Questionnaire
            </h2>
            <p className="text-slate-300 text-sm mb-3">
              {selectedForm.supplierDetails?.inchargeNameAndCompany || selectedForm.formCode || "—"}
            </p>
            <label htmlFor="dd-reject-reason" className="block text-sm text-slate-400 mb-1">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              id="dd-reject-reason"
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/5 text-white px-3 py-2 text-sm min-h-[100px] resize-y"
              placeholder="Enter rejection reason…"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReasonInput("");
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejecting === selectedForm._id}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 border border-red-400/50 hover:bg-red-500/30 disabled:opacity-50"
              >
                {rejecting === selectedForm._id ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
