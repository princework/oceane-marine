"use client";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQhseRole } from "@/hooks/useQhseRole";

const ALLOWED_EXT_STR = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export default function MOCManagementChangeFormPage() {
  const { contentClassName } = useQhseSidebar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditMode = Boolean(editId);
  const fileInputRef = useRef(null);
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = isEditMode ? canEdit : canCreate;

  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear + 5; y >= currentYear - 7; y--) {
    yearOptions.push(y);
  }

  const [form, setForm] = useState({
    year: currentYear,
    proposedChange: "",
    reasonForChange: "",
    proposedBy: "",
    mocInitiatedBy: "",
    targetImplementationDate: "",
    potentialConsequences: {
      environment: false,
      safety: false,
      contractual: false,
      cost: false,
      operational: false,
      reputation: false,
      remarks: "",
    },
    equipmentFacilityDocumentationAffected: "",
    riskAssessmentRequired: false,
    riskLevel: "",
    reviewerComments: "",
    trainingRequired: false,
    trainingDetails: "",
    documentChangeRequired: false,
    dcrNumber: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [existingStatus, setExistingStatus] = useState(null);
  /** Risk assessment files already uploaded to this MOC (from server) */
  const [existingRiskAssessmentFiles, setExistingRiskAssessmentFiles] = useState([]);
  /** Pending files selected but not yet uploaded */
  const [pendingRaFiles, setPendingRaFiles] = useState([]);
  const [uploadingRa, setUploadingRa] = useState(false);
  const [removingRaFile, setRemovingRaFile] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setForm((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: child === "remarks" ? value : checked,
        },
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  const handleRaFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    if (valid.length > 0) {
      setPendingRaFiles((prev) => [
        ...prev,
        ...valid.map((file) => ({
          file,
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        })),
      ]);
      setError("");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRaRemovePending = (id) => {
    setPendingRaFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleRaDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRaDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = Array.from(e.dataTransfer.files || []);
    const valid = dropped.filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    if (valid.length > 0) {
      setPendingRaFiles((prev) => [
        ...prev,
        ...valid.map((file) => ({
          file,
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        })),
      ]);
      setError("");
    }
  };

  const handleRaUpload = async () => {
    if (!editId || pendingRaFiles.length === 0) return;
    setUploadingRa(true);
    setError("");
    try {
      const formData = new FormData();
      pendingRaFiles.forEach(({ file }) => formData.append("files", file));
      const res = await fetch(
        `/api/qhse/moc/management-change/${editId}/risk-assessment/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setExistingRiskAssessmentFiles(data.data.riskAssessmentFiles || []);
      setPendingRaFiles([]);
      setSuccess("Risk assessment files uploaded.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingRa(false);
    }
  };

  const buildUpdateBody = (riskAssessmentFilesOverride) => ({
    proposedChange: form.proposedChange?.trim() ?? "",
    reasonForChange: form.reasonForChange?.trim() ?? "",
    proposedBy: form.proposedBy?.trim() ?? "",
    mocInitiatedBy: form.mocInitiatedBy?.trim() ?? "",
    year: form.year != null ? Number(form.year) : currentYear,
    ...(form.targetImplementationDate && {
      targetImplementationDate: form.targetImplementationDate,
    }),
    potentialConsequences: form.potentialConsequences,
    equipmentFacilityDocumentationAffected:
      form.equipmentFacilityDocumentationAffected?.trim(),
    riskAssessmentRequired: form.riskAssessmentRequired,
    riskLevel: form.riskLevel || undefined,
    reviewerComments: form.reviewerComments?.trim(),
    trainingRequired: form.trainingRequired,
    trainingDetails: form.trainingDetails?.trim(),
    documentChangeRequired: form.documentChangeRequired,
    dcrNumber: form.dcrNumber?.trim(),
    ...(riskAssessmentFilesOverride !== undefined && {
      riskAssessmentFiles: riskAssessmentFilesOverride,
    }),
  });

  const handleRaRemoveExisting = async (index) => {
    if (!editId) return;
    setRemovingRaFile(index);
    setError("");
    try {
      const updated = existingRiskAssessmentFiles.filter((_, i) => i !== index);
      const res = await fetch(
        `/api/qhse/moc/management-change/${editId}/update`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildUpdateBody(updated)),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove file");
      setExistingRiskAssessmentFiles(updated);
      setSuccess("File removed.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingRaFile(null);
    }
  };

  // Load existing draft data when editing from list (?edit=id)
  useEffect(() => {
    const loadExisting = async () => {
      if (!editId) return;
      setLoadingExisting(true);
      setError("");
      try {
        const res = await fetch(
          `/api/qhse/moc/management-change/${editId}/status`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load MOC draft");
        }

        const m = data.data;
        if (!m) return;
        setExistingStatus(m.status || "Draft");

        const docYear =
          m.year != null && !Number.isNaN(Number(m.year))
            ? Number(m.year)
            : m.initiationDate
              ? new Date(m.initiationDate).getFullYear()
              : currentYear;

        setForm({
          year: docYear,
          proposedChange: m.proposedChange || "",
          reasonForChange: m.reasonForChange || "",
          proposedBy: m.proposedBy || "",
          mocInitiatedBy: m.mocInitiatedBy || "",
          targetImplementationDate: m.targetImplementationDate
            ? new Date(m.targetImplementationDate).toISOString().slice(0, 10)
            : "",
          potentialConsequences: {
            environment: m.potentialConsequences?.environment || false,
            safety: m.potentialConsequences?.safety || false,
            contractual: m.potentialConsequences?.contractual || false,
            cost: m.potentialConsequences?.cost || false,
            operational: m.potentialConsequences?.operational || false,
            reputation: m.potentialConsequences?.reputation || false,
            remarks: m.potentialConsequences?.remarks || "",
          },
          equipmentFacilityDocumentationAffected:
            m.equipmentFacilityDocumentationAffected || "",
          riskAssessmentRequired: m.riskAssessmentRequired || false,
          riskLevel: m.riskLevel || "",
          reviewerComments: m.reviewerComments || "",
          trainingRequired: m.trainingRequired || false,
          trainingDetails: m.trainingDetails || "",
          documentChangeRequired: m.documentChangeRequired || false,
          dcrNumber: m.dcrNumber || "",
        });
        setExistingRiskAssessmentFiles(Array.isArray(m.riskAssessmentFiles) ? m.riskAssessmentFiles : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingExisting(false);
      }
    };

    loadExisting();
  }, [editId]);

  const handleSaveDraft = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const formData = {
        action: "draft",
        year: form.year != null ? Number(form.year) : currentYear,
        proposedChange: form.proposedChange?.trim(),
        reasonForChange: form.reasonForChange?.trim(),
        proposedBy: form.proposedBy?.trim(),
        mocInitiatedBy: form.mocInitiatedBy?.trim(),

        ...(form.targetImplementationDate && {
          targetImplementationDate: form.targetImplementationDate,
        }),
        potentialConsequences: {
          environment: form.potentialConsequences.environment,
          safety: form.potentialConsequences.safety,
          contractual: form.potentialConsequences.contractual,
          cost: form.potentialConsequences.cost,
          operational: form.potentialConsequences.operational,
          reputation: form.potentialConsequences.reputation,
          remarks: form.potentialConsequences.remarks?.trim() || "",
        },
        equipmentFacilityDocumentationAffected:
          form.equipmentFacilityDocumentationAffected?.trim(),
        riskAssessmentRequired: form.riskAssessmentRequired,
        ...(form.riskLevel && { riskLevel: form.riskLevel }),
        reviewerComments: form.reviewerComments?.trim(),
        trainingRequired: form.trainingRequired,
        trainingDetails: form.trainingDetails?.trim(),
        documentChangeRequired: form.documentChangeRequired,
        dcrNumber: form.dcrNumber?.trim(),
      };

      let mocId = editId;

      if (!isEditMode) {
        const createRes = await fetch("/api/qhse/moc/management-change/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          throw new Error(createData.error || "Failed to save draft");
        }
        mocId = createData.data?._id || createData.data?.id;
        if (!mocId) throw new Error("Draft saved but no MOC id returned");
        if (pendingRaFiles.length > 0) {
          const uploadFormData = new FormData();
          pendingRaFiles.forEach(({ file }) => uploadFormData.append("files", file));
          const uploadRes = await fetch(
            `/api/qhse/moc/management-change/${mocId}/risk-assessment/upload`,
            { method: "POST", body: uploadFormData }
          );
          const uploadData = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uploadData.error || "Draft saved but file upload failed");
        }
        setSuccess("Draft saved successfully.");
        setPendingRaFiles([]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.replace(`/qhse/moc/management-change/form?edit=${mocId}`);
        return;
      }

      if (mocId && pendingRaFiles.length > 0) {
        const uploadFormData = new FormData();
        pendingRaFiles.forEach(({ file }) => uploadFormData.append("files", file));
        const uploadRes = await fetch(
          `/api/qhse/moc/management-change/${mocId}/risk-assessment/upload`,
          { method: "POST", body: uploadFormData }
        );
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "File upload failed");
        setExistingRiskAssessmentFiles(uploadData.data?.riskAssessmentFiles || []);
        setPendingRaFiles([]);
      }

      const res = await fetch(
        `/api/qhse/moc/management-change/${mocId}/update`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildUpdateBody()),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      router.push("/qhse/moc/management-change/list");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const formData = {
        action: "submit",
        year: form.year != null ? Number(form.year) : currentYear,
        proposedChange: form.proposedChange.trim(),
        reasonForChange: form.reasonForChange.trim(),
        proposedBy: form.proposedBy.trim(),
        mocInitiatedBy: form.mocInitiatedBy.trim(),

        ...(form.targetImplementationDate && {
          targetImplementationDate: form.targetImplementationDate,
        }),
        potentialConsequences: {
          environment: form.potentialConsequences.environment,
          safety: form.potentialConsequences.safety,
          contractual: form.potentialConsequences.contractual,
          cost: form.potentialConsequences.cost,
          operational: form.potentialConsequences.operational,
          reputation: form.potentialConsequences.reputation,
          remarks: form.potentialConsequences.remarks?.trim() || "",
        },
        equipmentFacilityDocumentationAffected:
          form.equipmentFacilityDocumentationAffected?.trim(),
        riskAssessmentRequired: form.riskAssessmentRequired,
        riskLevel: form.riskLevel,
        reviewerComments: form.reviewerComments?.trim(),
        trainingRequired: form.trainingRequired,
        trainingDetails: form.trainingDetails?.trim(),
        documentChangeRequired: form.documentChangeRequired,
        dcrNumber: form.dcrNumber?.trim(),
      };

      let mocId = editId;

      if (!isEditMode) {
        const createRes = await fetch("/api/qhse/moc/management-change/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          throw new Error(createData.error || "Failed to submit form");
        }
        mocId = createData.data?._id || createData.data?.id;
        if (mocId && pendingRaFiles.length > 0) {
          const uploadFormData = new FormData();
          pendingRaFiles.forEach(({ file }) => uploadFormData.append("files", file));
          const uploadRes = await fetch(
            `/api/qhse/moc/management-change/${mocId}/risk-assessment/upload`,
            { method: "POST", body: uploadFormData }
          );
          const uploadData = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uploadData.error || "Submitted but file upload failed");
        }
        setSuccess("Form submitted successfully");
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.push("/qhse/moc/management-change/list");
        return;
      }

      if (mocId && pendingRaFiles.length > 0) {
        const uploadFormData = new FormData();
        pendingRaFiles.forEach(({ file }) => uploadFormData.append("files", file));
        const uploadRes = await fetch(
          `/api/qhse/moc/management-change/${mocId}/risk-assessment/upload`,
          { method: "POST", body: uploadFormData }
        );
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "File upload failed");
        setExistingRiskAssessmentFiles(uploadData.data?.riskAssessmentFiles || []);
        setPendingRaFiles([]);
      }

      const res = await fetch(
        `/api/qhse/moc/management-change/${mocId}/submit`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit form");
      setSuccess("Form submitted successfully");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
        <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
          <Link
            href="/dashboard"
            className="flex-shrink-0 shrink-0 hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
            <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
              QHSE / MOC / Management of Change
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              {isEditMode ? "Edit Management of Change" : "Management of Change"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-058</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <a
              href="/templates/controlled-register/QAF-OFD-058.docx"
              download
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-indigo-300 hover:bg-indigo-500/20 transition"
              title="Download form template (QAF-OFD-058)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
              </svg>
              Template (058)
            </a>
            <a
              href="/templates/controlled-register/QAF-OFD-058A.docx"
              download
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
              title="Download form template (QAF-OFD-058A)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
              </svg>
              Template (058A)
            </a>
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/moc/management-change/form"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                MOC Form
              </Link>
              <Link
                href="/qhse/moc/management-change/list"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                MOC List
              </Link>
            </div>
          </div>
        </header>

        {!canSubmit && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm">
            You do not have permission to {isEditMode ? "edit" : "create"} MOC management of change records.
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
              <select
                id="year"
                name="year"
                value={form.year ?? currentYear}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    year: Number(e.target.value),
                  }))
                }
                className="rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[5rem]"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-4 py-3 text-emerald-200 text-sm font-medium">
              {success}
            </div>
          )}

          <form className="space-y-8">
          {/* Basic Information */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-semibold text-white">
                Basic Information
              </h2>
              {isEditMode && (
                <button
                  type="button"
                  onClick={() => router.push("/qhse/moc/management-change/list")}
                  className="p-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-red-500/20 hover:border-red-400/40 text-white/70 hover:text-red-300 transition"
                  title="Close form"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="proposedChange"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Proposed Change <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="proposedChange"
                  name="proposedChange"
                  value={form.proposedChange}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Describe the proposed change..."
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="reasonForChange"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Reason for Change <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="reasonForChange"
                  name="reasonForChange"
                  value={form.reasonForChange}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="e.g., Management change – CEO takeover"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="proposedBy"
                    className="block text-sm font-medium text-white/90 mb-2"
                  >
                    Proposed By <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="proposedBy"
                    type="text"
                    name="proposedBy"
                    value={form.proposedBy}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Enter name or identifier"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="mocInitiatedBy"
                    className="block text-sm font-medium text-white/90 mb-2"
                  >
                    MOC Initiated By <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="mocInitiatedBy"
                    type="text"
                    name="mocInitiatedBy"
                    value={form.mocInitiatedBy}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Enter name or identifier"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="targetImplementationDate"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Target Implementation Date
                </label>
                <input
                  id="targetImplementationDate"
                  type="date"
                  name="targetImplementationDate"
                  value={form.targetImplementationDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* Impact & Risk Assessment */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3">
              Impact & Risk Assessment
            </h2>

            <div className="space-y-4">
              <div>
                <p className="block text-sm font-medium text-white/90 mb-3">
                  Potential Consequences (Select all that apply)
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    "environment",
                    "safety",
                    "contractual",
                    "cost",
                    "operational",
                    "reputation",
                  ].map((key) => (
                    <label
                      key={key}
                      htmlFor={`potentialConsequences.${key}`}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        id={`potentialConsequences.${key}`}
                        name={`potentialConsequences.${key}`}
                        checked={form.potentialConsequences[key]}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-sky-500 focus:ring-sky-500"
                      />
                      <span className="text-sm text-white/90 capitalize">
                        {key}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="potentialConsequencesRemarks"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Remarks on Potential Consequences
                </label>
                <textarea
                  id="potentialConsequencesRemarks"
                  name="potentialConsequences.remarks"
                  value={form.potentialConsequences.remarks}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Additional remarks..."
                />
              </div>

              <div>
                <label
                  htmlFor="equipmentFacilityDocumentationAffected"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Equipment/Facility/Documentation Affected
                </label>
                <textarea
                  id="equipmentFacilityDocumentationAffected"
                  name="equipmentFacilityDocumentationAffected"
                  value={form.equipmentFacilityDocumentationAffected}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Describe affected equipment, facilities, or documentation..."
                />
              </div>

              <div className="space-y-3">
                <label
                  htmlFor="riskAssessmentRequired"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    id="riskAssessmentRequired"
                    name="riskAssessmentRequired"
                    checked={form.riskAssessmentRequired}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-sky-500 focus:ring-sky-500"
                  />
                  <span className="text-sm font-medium text-white/90">
                    Risk Assessment Required
                  </span>
                </label>

                {form.riskAssessmentRequired && (
                  <div>
                    <label
                      htmlFor="riskLevel"
                      className="block text-sm font-medium text-white/90 mb-2"
                    >
                      Risk Level <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="riskLevel"
                      name="riskLevel"
                      value={form.riskLevel}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      required={form.riskAssessmentRequired}
                    >
                      <option value="">Select risk level</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                )}

                {/* Risk assessment document upload - available immediately */}
                {form.riskAssessmentRequired && (
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <p className="text-sm font-medium text-white/90">
                      Upload risk assessment documents
                    </p>
                    <div
                      onDragOver={handleRaDragOver}
                      onDrop={handleRaDrop}
                      className="relative border-2 border-dashed border-white/20 rounded-xl p-8 text-center transition-all hover:border-sky-500/50 hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleRaFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept={ALLOWED_EXT_STR}
                      />
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-white">
                          Drag and drop files here, or click to select
                        </p>
                        <p className="text-xs text-slate-400">
                          PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, JPG, PNG, GIF. Max 10MB per file.
                        </p>
                        {!editId && (
                          <p className="text-xs text-sky-400 mt-1">
                            Selected files will be attached when you Save as Draft or Submit.
                          </p>
                        )}
                      </div>
                    </div>

                    {existingRiskAssessmentFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-white/80">
                          Uploaded files ({existingRiskAssessmentFiles.length})
                        </p>
                        <ul className="space-y-2">
                          {existingRiskAssessmentFiles.map((f, i) => (
                            <li
                              key={i}
                              className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                            >
                              <a
                                    href={f.url ? `/api/qhse/file/${f.url.replace(/^\//, "")}` : "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-sky-300 hover:text-sky-200 truncate flex-1 min-w-0"
                                  >
                                {f.name || f.filename}
                              </a>
                              <span className="text-xs text-slate-400 ml-2 shrink-0">
                                {formatFileSize(f.size || 0)}
                              </span>
                              {editId && (
                                <button
                                  type="button"
                                  onClick={() => handleRaRemoveExisting(i)}
                                  disabled={removingRaFile !== null}
                                  className="ml-2 p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                                  aria-label="Remove file"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {pendingRaFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-white/80">
                          Selected files ({pendingRaFiles.length})
                          {!editId && " — will be attached on Save as Draft or Submit"}
                        </p>
                        <ul className="space-y-2">
                          {pendingRaFiles.map(({ file, id }) => (
                            <li
                              key={id}
                              className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                            >
                              <span className="text-sm text-white truncate flex-1 min-w-0">
                                {file.name}
                              </span>
                              <span className="text-xs text-slate-400 ml-2 shrink-0">
                                {formatFileSize(file.size)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRaRemovePending(id)}
                                className="ml-2 p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                aria-label="Remove"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {editId && (
                          <button
                            type="button"
                            onClick={handleRaUpload}
                            disabled={uploadingRa}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 disabled:opacity-50"
                          >
                            {uploadingRa ? "Uploading..." : "Upload files"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="reviewerComments"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Reviewer Comments
                </label>
                <textarea
                  id="reviewerComments"
                  name="reviewerComments"
                  value={form.reviewerComments}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Reviewer comments..."
                />
              </div>
            </div>
          </section>

          {/* Training */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3">
              Training
            </h2>

            <div className="space-y-4">
              <label
                htmlFor="trainingRequired"
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  id="trainingRequired"
                  name="trainingRequired"
                  checked={form.trainingRequired}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-sky-500 focus:ring-sky-500"
                />
                <span className="text-sm font-medium text-white/90">
                  Training Required
                </span>
              </label>

              {form.trainingRequired && (
                <div>
                  <label
                    htmlFor="trainingDetails"
                    className="block text-sm font-medium text-white/90 mb-2"
                  >
                    Training Details
                  </label>
                  <textarea
                    id="trainingDetails"
                    name="trainingDetails"
                    value={form.trainingDetails}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Describe training requirements..."
                  />
                </div>
              )}
            </div>
          </section>

          {/* Document Control */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3">
              Document Control
            </h2>

            <div className="space-y-4">
              <label
                htmlFor="documentChangeRequired"
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  id="documentChangeRequired"
                  name="documentChangeRequired"
                  checked={form.documentChangeRequired}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-sky-500 focus:ring-sky-500"
                />
                <span className="text-sm font-medium text-white/90">
                  Document Change Required
                </span>
              </label>

              {form.documentChangeRequired && (
                <div>
                  <label
                    htmlFor="dcrNumber"
                    className="block text-sm font-medium text-white/90 mb-2"
                  >
                    DCR Number
                  </label>
                  <input
                    id="dcrNumber"
                    type="text"
                    name="dcrNumber"
                    value={form.dcrNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Enter DCR number..."
                  />
                </div>
              )}
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!canSubmit || saving || submitting}
              className="px-6 py-3 rounded-lg border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : isEditMode && existingStatus && existingStatus !== "Draft" ? "Save Changes" : "Save as Draft"}
            </button>
            {!(isEditMode && existingStatus && existingStatus !== "Draft") && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting || saving}
                className="px-6 py-3 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            )}
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
