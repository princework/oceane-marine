"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";
import { useSearchParams } from "next/navigation";
import { POAC_EVALUATION_ITEMS } from "@/lib/constants/qhse-poac/poacEvaluationItems";
import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useQhseRole } from "@/hooks/useQhseRole";

export default function PoacCrossCompetencyFormPage() {
  const { contentClassName } = useQhseSidebar();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = editId ? canEdit : canCreate;

  // Initialize evaluation items
  const initialEvaluationItems = POAC_EVALUATION_ITEMS.map((item) => ({
    srNo: item.srNo,
    area: item.area,
    evaluation: null,
    remarks: "",
  }));

  const [form, setForm] = useState({
    // Revision (read-only when present: 1.0 = new, 1.1+ and revDate set by backend on update)
    revNo: "1.0",
    revDate: "",
    approvedBy: "",

    // POAC Details (Required)
    nameOfPOAC: "",
    evaluationDate: "",
    jobRefNo: "",
    leadPOAC: "",

    // Optional Vessel Information
    dischargingVessel: "",
    receivingVessel: "",
    location: "",
    typeOfOperation: "",
    weatherCondition: "",
    deadweightDischarging: "",
    deadweightReceiving: "",

    // Evaluation Items (all 75 items)
    evaluationItems: initialEvaluationItems,

    // Lead POAC Comments & Signatures
    leadPOACComment: "",
    leadPOACName: "",
    leadPOACDate: "",
    leadPOACSignature: "",

    // Operations Support Team Comment
    opsSupportTeamComment: "",

    // Ops Team
    opsTeamName: "",
    opsTeamDate: "",
    opsTeamSignature: "",

    // Ops Team Superintendent
    opsTeamSupdtName: "",
    opsTeamSupdtDate: "",
    opsTeamSupdtSignature: "",

    // Status
    status: "Draft",
  });

  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [displayFormCode, setDisplayFormCode] = useState(null);
  const [displaySerialNumber, setDisplaySerialNumber] = useState(null);

  // Load form data if editing
  useEffect(() => {
    if (editId) {
      const loadForm = async () => {
        try {
          const res = await fetch(`/api/qhse/cross-competency/${editId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.data) {
              const formData = data.data;

              // Merge existing evaluation items with form data
              const mergedEvaluationItems = initialEvaluationItems.map(
                (defaultItem) => {
                  const existingItem = formData.evaluationItems?.find(
                    (item) => item.srNo === defaultItem.srNo
                  );
                  if (existingItem) {
                    // Convert evaluation to number, handling both old string values and numbers
                    let evaluationValue = null;
                    if (
                      existingItem.evaluation !== null &&
                      existingItem.evaluation !== undefined
                    ) {
                      // If it's already a number between 1-5, use it
                      if (
                        typeof existingItem.evaluation === "number" &&
                        existingItem.evaluation >= 1 &&
                        existingItem.evaluation <= 5
                      ) {
                        evaluationValue = existingItem.evaluation;
                      }
                      // If it's a string, try to parse it
                      else if (typeof existingItem.evaluation === "string") {
                        const parsed = parseInt(existingItem.evaluation, 10);
                        if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
                          evaluationValue = parsed;
                        }
                        // If it's a string like "Unsatisfactory", "Satisfactory", etc., evaluationValue remains null
                      }
                    }

                    return {
                      srNo: defaultItem.srNo,
                      area: defaultItem.area,
                      evaluation: evaluationValue,
                      remarks: existingItem.remarks || "",
                    };
                  }
                  return defaultItem;
                }
              );

              setForm({
                revNo: formData.revNo || "1.0",
                revDate: formData.revDate
                  ? new Date(formData.revDate).toISOString().split("T")[0]
                  : "",
                approvedBy: formData.approvedBy || "",
                nameOfPOAC: formData.nameOfPOAC || "",
                evaluationDate: formData.evaluationDate
                  ? new Date(formData.evaluationDate)
                      .toISOString()
                      .split("T")[0]
                  : "",
                jobRefNo: formData.jobRefNo || "",
                leadPOAC: formData.leadPOAC || "",
                dischargingVessel: formData.dischargingVessel || "",
                receivingVessel: formData.receivingVessel || "",
                location: formData.location || "",
                typeOfOperation: formData.typeOfOperation || "",
                weatherCondition: formData.weatherCondition || "",
                deadweightDischarging: formData.deadweightDischarging || "",
                deadweightReceiving: formData.deadweightReceiving || "",
                evaluationItems: mergedEvaluationItems,
                leadPOACComment: formData.leadPOACComment || "",
                leadPOACName: formData.leadPOACName || "",
                leadPOACDate: formData.leadPOACDate
                  ? new Date(formData.leadPOACDate).toISOString().split("T")[0]
                  : "",
                leadPOACSignature: formData.leadPOACSignature || "",
                opsSupportTeamComment: formData.opsSupportTeamComment || "",
                opsTeamName: formData.opsTeamName || "",
                opsTeamDate: formData.opsTeamDate
                  ? new Date(formData.opsTeamDate).toISOString().split("T")[0]
                  : "",
                opsTeamSignature: formData.opsTeamSignature || "",
                opsTeamSupdtName: formData.opsTeamSupdtName || "",
                opsTeamSupdtDate: formData.opsTeamSupdtDate
                  ? new Date(formData.opsTeamSupdtDate)
                      .toISOString()
                      .split("T")[0]
                  : "",
                opsTeamSupdtSignature: formData.opsTeamSupdtSignature || "",
                status: formData.status || "Draft",
              });
              setDisplayFormCode(formData.formCode || null);
              setDisplaySerialNumber(formData.serialNumber || null);
            }
          }
        } catch (err) {
          setError("Failed to load form data");
        }
      };
      loadForm();
    }
  }, [editId]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleEvaluationChange = (index, field, value) => {
    setForm((prev) => {
      const newItems = [...prev.evaluationItems];

      // Convert evaluation to number if it's the evaluation field
      if (field === "evaluation") {
        let numValue = null;
        if (value && value !== "" && value !== null && value !== undefined) {
          // Handle both string and number inputs
          const parsed =
            typeof value === "string" ? parseInt(value, 10) : Number(value);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
            numValue = parsed;
          }
        }
        newItems[index] = { ...newItems[index], [field]: numValue };

        // If evaluation is >= 3, clear remarks requirement
        if (numValue !== null && numValue >= 3) {
          // Clear validation error if exists
          setValidationErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[`evaluation_${index}`];
            return newErrors;
          });
        }
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }

      return { ...prev, evaluationItems: newItems };
    });
  };

  const validateForm = () => {
    const errors = {};

    // Required fields
    if (!form.nameOfPOAC?.trim()) {
      errors.nameOfPOAC = "Name of POAC is required";
    }
    if (!form.evaluationDate) {
      errors.evaluationDate = "Evaluation date is required";
    }
    if (!form.jobRefNo?.trim()) {
      errors.jobRefNo = "Job Ref No is required";
    }
    if (!form.leadPOAC?.trim()) {
      errors.leadPOAC = "Lead POAC is required";
    }

    // Validate evaluation items
    form.evaluationItems.forEach((item, index) => {
      if (item.evaluation !== null && item.evaluation !== undefined) {
        const evalNum = parseInt(item.evaluation);
        if (evalNum < 3 && (!item.remarks || !item.remarks.trim())) {
          errors[
            `evaluation_${index}`
          ] = `Remarks are required for item ${item.srNo} when evaluation is less than 3`;
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveDraft = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      // Prepare payload matching API route structure
      const payload = {
        nameOfPOAC: form.nameOfPOAC?.trim() || "",
        evaluationDate: form.evaluationDate || "",
        jobRefNo: form.jobRefNo?.trim() || "",
        leadPOAC: form.leadPOAC?.trim() || "",

        // Optional fields
        ...(form.dischargingVessel?.trim() && {
          dischargingVessel: form.dischargingVessel.trim(),
        }),
        ...(form.receivingVessel?.trim() && {
          receivingVessel: form.receivingVessel.trim(),
        }),
        ...(form.location?.trim() && { location: form.location.trim() }),
        ...(form.typeOfOperation?.trim() && {
          typeOfOperation: form.typeOfOperation.trim(),
        }),
        ...(form.weatherCondition?.trim() && {
          weatherCondition: form.weatherCondition.trim(),
        }),
        ...(form.deadweightDischarging && {
          deadweightDischarging: Number(form.deadweightDischarging),
        }),
        ...(form.deadweightReceiving && {
          deadweightReceiving: Number(form.deadweightReceiving),
        }),

        // Revision: backend sets revNo 1.0 on create; do not send from form

        // Evaluation items - send all 75 items (API will normalize)
        evaluationItems: form.evaluationItems.map((item) => {
          let evaluationValue = null;
          if (
            item.evaluation !== null &&
            item.evaluation !== undefined &&
            item.evaluation !== ""
          ) {
            const parsed = parseInt(item.evaluation, 10);
            evaluationValue =
              !isNaN(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
          }
          return {
            srNo: item.srNo,
            evaluation: evaluationValue,
            remarks: item.remarks?.trim() || "",
          };
        }),

        // Lead POAC
        ...(form.leadPOACComment?.trim() && {
          leadPOACComment: form.leadPOACComment.trim(),
        }),
        ...(form.leadPOACName?.trim() && {
          leadPOACName: form.leadPOACName.trim(),
        }),
        ...(form.leadPOACDate && { leadPOACDate: form.leadPOACDate }),
        ...(form.leadPOACSignature?.trim() && {
          leadPOACSignature: form.leadPOACSignature.trim(),
        }),

        // Ops Support
        ...(form.opsSupportTeamComment?.trim() && {
          opsSupportTeamComment: form.opsSupportTeamComment.trim(),
        }),

        // Ops Team
        ...(form.opsTeamName?.trim() && {
          opsTeamName: form.opsTeamName.trim(),
        }),
        ...(form.opsTeamDate && { opsTeamDate: form.opsTeamDate }),
        ...(form.opsTeamSignature?.trim() && {
          opsTeamSignature: form.opsTeamSignature.trim(),
        }),

        // Superintendent
        ...(form.opsTeamSupdtName?.trim() && {
          opsTeamSupdtName: form.opsTeamSupdtName.trim(),
        }),
        ...(form.opsTeamSupdtDate && {
          opsTeamSupdtDate: form.opsTeamSupdtDate,
        }),
        ...(form.opsTeamSupdtSignature?.trim() && {
          opsTeamSupdtSignature: form.opsTeamSupdtSignature.trim(),
        }),

        status: "Draft",
      };

      const url = editId
        ? `/api/qhse/cross-competency/${editId}/update`
        : "/api/qhse/cross-competency/create";

      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        throw new Error(
          "Server returned an invalid response. Please try again."
        );
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to save form");
      }

      if (data.data?.formCode) setDisplayFormCode(data.data.formCode);
      if (data.data?.serialNumber) setDisplaySerialNumber(data.data.serialNumber);
      setMessage(
        editId
          ? " Form updated successfully!"
          : " Form saved as draft successfully!"
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    setValidationErrors({});

    if (!validateForm()) {
      setSubmitting(false);
      setError("Please fix the validation errors before submitting");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      // Prepare payload matching API route structure
      const payload = {
        nameOfPOAC: form.nameOfPOAC.trim(),
        evaluationDate: form.evaluationDate,
        jobRefNo: form.jobRefNo.trim(),
        leadPOAC: form.leadPOAC.trim(),

        // Optional fields
        ...(form.dischargingVessel?.trim() && {
          dischargingVessel: form.dischargingVessel.trim(),
        }),
        ...(form.receivingVessel?.trim() && {
          receivingVessel: form.receivingVessel.trim(),
        }),
        ...(form.location?.trim() && { location: form.location.trim() }),
        ...(form.typeOfOperation?.trim() && {
          typeOfOperation: form.typeOfOperation.trim(),
        }),
        ...(form.weatherCondition?.trim() && {
          weatherCondition: form.weatherCondition.trim(),
        }),
        ...(form.deadweightDischarging && {
          deadweightDischarging: Number(form.deadweightDischarging),
        }),
        ...(form.deadweightReceiving && {
          deadweightReceiving: Number(form.deadweightReceiving),
        }),

        // Revision: backend sets revNo 1.0 on create; do not send from form

        // Evaluation items - send all 75 items (API will normalize)
        evaluationItems: form.evaluationItems.map((item) => {
          let evaluationValue = null;
          if (
            item.evaluation !== null &&
            item.evaluation !== undefined &&
            item.evaluation !== ""
          ) {
            const parsed = parseInt(item.evaluation, 10);
            evaluationValue =
              !isNaN(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
          }
          return {
            srNo: item.srNo,
            evaluation: evaluationValue,
            remarks: item.remarks?.trim() || "",
          };
        }),

        // Lead POAC
        ...(form.leadPOACComment?.trim() && {
          leadPOACComment: form.leadPOACComment.trim(),
        }),
        ...(form.leadPOACName?.trim() && {
          leadPOACName: form.leadPOACName.trim(),
        }),
        ...(form.leadPOACDate && { leadPOACDate: form.leadPOACDate }),
        ...(form.leadPOACSignature?.trim() && {
          leadPOACSignature: form.leadPOACSignature.trim(),
        }),

        // Ops Support
        ...(form.opsSupportTeamComment?.trim() && {
          opsSupportTeamComment: form.opsSupportTeamComment.trim(),
        }),

        // Ops Team
        ...(form.opsTeamName?.trim() && {
          opsTeamName: form.opsTeamName.trim(),
        }),
        ...(form.opsTeamDate && { opsTeamDate: form.opsTeamDate }),
        ...(form.opsTeamSignature?.trim() && {
          opsTeamSignature: form.opsTeamSignature.trim(),
        }),

        // Superintendent
        ...(form.opsTeamSupdtName?.trim() && {
          opsTeamSupdtName: form.opsTeamSupdtName.trim(),
        }),
        ...(form.opsTeamSupdtDate && {
          opsTeamSupdtDate: form.opsTeamSupdtDate,
        }),
        ...(form.opsTeamSupdtSignature?.trim() && {
          opsTeamSupdtSignature: form.opsTeamSupdtSignature.trim(),
        }),

        status: "Submitted",
      };

      const url = editId
        ? `/api/qhse/cross-competency/${editId}/update`
        : "/api/qhse/cross-competency/create";

      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        throw new Error(
          "Server returned an invalid response. Please try again."
        );
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to submit form");
      }

      if (data.data?.formCode) setDisplayFormCode(data.data.formCode);
      if (data.data?.serialNumber) setDisplaySerialNumber(data.data.serialNumber);
      setMessage("Form submitted successfully!");
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Redirect to list page after 2 seconds
      setTimeout(() => {
        window.location.href = "/qhse/poac/cross-competency/list";
      }, 2000);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // Group evaluation items by category for better organization
  const evaluationCategories = [
    { name: "Prior to commencement of Operations", start: 1, end: 9 },
    { name: "Mobilization", start: 10, end: 15 },
    { name: "Rigging of vessel", start: 16, end: 23 },
    { name: "Approach and mooring operation", start: 24, end: 42 },
    { name: "Hose connection", start: 43, end: 48 },
    { name: "Cargo operations", start: 49, end: 51 },
    { name: "Hose draining and disconnection", start: 52, end: 56 },
    { name: "Unmooring", start: 57, end: 62 },
    { name: "De-Mobilization", start: 63, end: 66 },
    { name: "General", start: 67, end: 71 },
    { name: "Office Requirements", start: 72, end: 75 },
  ];

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
              QHSE / POAC Cross Competency
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              {editId
                ? "Edit POAC Cross Competency Form"
                : "POAC Cross Competency "}
            </h1>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-009" />
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/poac/cross-competency/form"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                POAC Form
              </Link>
              <Link
                href="/qhse/poac/cross-competency/list"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                POAC List
              </Link>
            </div>
          </div>
        </header>

        {!canSubmit && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm">
            You do not have permission to {editId ? "edit" : "create"} POAC cross competency forms.
          </div>
        )}

        {error && (
          <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {message && (
          <div className="text-base text-emerald-300 bg-emerald-950/40 border-2 border-emerald-500/60 rounded-lg px-6 py-4">
            <span className="font-semibold">{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Revision Information Section */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-orange-300">
              Revision
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              New forms start at Rev No 1.0. When this document is updated in the main app, Rev No becomes 1.1, 1.2, etc. and Rev Date is set automatically. Approved By is set when the document is approved.
            </p>
            {(form.revNo !== "1.0" || form.revDate || form.approvedBy) && (
              <div className="grid gap-4 md:grid-cols-3 mb-4">
                {form.revNo && (
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Rev No</span>
                    <p className="text-sm text-slate-200">{form.revNo}</p>
                  </div>
                )}
                {form.revDate && (
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Rev Date</span>
                    <p className="text-sm text-slate-200">{form.revDate}</p>
                  </div>
                )}
                {form.approvedBy && (
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-1">Approved By</span>
                    <p className="text-sm text-slate-200">{form.approvedBy}</p>
                  </div>
                )}
              </div>
            )}
            {(displayFormCode || displaySerialNumber) && (
              <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-white/10">
                {displayFormCode && (
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-xs block mb-0.5">Form Code</span>
                    <p className="font-mono font-semibold text-sky-300">{displayFormCode}</p>
                  </div>
                )}
                {displaySerialNumber && (
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-xs block mb-0.5">Serial</span>
                    <p className="font-mono font-semibold text-slate-200">{displaySerialNumber}</p>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2">
              Note: Form Code and Serial are separate fields and will be auto-generated upon save.
            </p>
          </div>

          {/* POAC Details Section */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-orange-300">
              POAC Details
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Name of POAC <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className={`w-full rounded-xl bg-slate-900/40 border ${
                    validationErrors.nameOfPOAC
                      ? "border-red-500"
                      : "border-white/15"
                  } px-3 py-2 text-sm text-white`}
                  value={form.nameOfPOAC}
                  onChange={(e) => handleChange("nameOfPOAC", e.target.value)}
                  required
                />
                {validationErrors.nameOfPOAC && (
                  <p className="text-xs text-red-400 mt-1">
                    {validationErrors.nameOfPOAC}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Evaluation Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  className={`w-full rounded-xl bg-slate-900/40 border ${
                    validationErrors.evaluationDate
                      ? "border-red-500"
                      : "border-white/15"
                  } px-3 py-2 text-sm text-white`}
                  value={form.evaluationDate}
                  onChange={(e) =>
                    handleChange("evaluationDate", e.target.value)
                  }
                  required
                />
                {validationErrors.evaluationDate && (
                  <p className="text-xs text-red-400 mt-1">
                    {validationErrors.evaluationDate}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Job Ref No <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className={`w-full rounded-xl bg-slate-900/40 border ${
                    validationErrors.jobRefNo
                      ? "border-red-500"
                      : "border-white/15"
                  } px-3 py-2 text-sm text-white`}
                  value={form.jobRefNo}
                  onChange={(e) => handleChange("jobRefNo", e.target.value)}
                  required
                />
                {validationErrors.jobRefNo && (
                  <p className="text-xs text-red-400 mt-1">
                    {validationErrors.jobRefNo}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Lead POAC <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className={`w-full rounded-xl bg-slate-900/40 border ${
                    validationErrors.leadPOAC
                      ? "border-red-500"
                      : "border-white/15"
                  } px-3 py-2 text-sm text-white`}
                  value={form.leadPOAC}
                  onChange={(e) => handleChange("leadPOAC", e.target.value)}
                  required
                />
                {validationErrors.leadPOAC && (
                  <p className="text-xs text-red-400 mt-1">
                    {validationErrors.leadPOAC}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Discharging Vessel
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                  value={form.dischargingVessel}
                  onChange={(e) =>
                    handleChange("dischargingVessel", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Receiving Vessel
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                  value={form.receivingVessel}
                  onChange={(e) =>
                    handleChange("receivingVessel", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                  value={form.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Type of Operation
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                  value={form.typeOfOperation}
                  onChange={(e) =>
                    handleChange("typeOfOperation", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Weather Condition
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                  value={form.weatherCondition}
                  onChange={(e) =>
                    handleChange("weatherCondition", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Deadweight Discharging
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                  value={form.deadweightDischarging}
                  onChange={(e) =>
                    handleChange("deadweightDischarging", e.target.value)
                  }
                  onWheel={(e) => e.target.blur()}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Deadweight Receiving
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                  value={form.deadweightReceiving}
                  onChange={(e) =>
                    handleChange("deadweightReceiving", e.target.value)
                  }
                  onWheel={(e) => e.target.blur()}
                />
              </div>
            </div>
          </div>

          {/* Evaluation Items Section */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-orange-300">
              Evaluation Items
            </h2>
            <p className="text-xs text-slate-300 mb-4">
              Rate each item from 1-5. Remarks are required if evaluation is
              less than 3.
            </p>

            <div className="space-y-6">
              {evaluationCategories.map((category) => {
                const categoryItems = form.evaluationItems.filter(
                  (item) =>
                    item.srNo >= category.start && item.srNo <= category.end
                );

                return (
                  <div
                    key={category.name}
                    className="border border-white/10 rounded-xl p-4 bg-slate-900/20"
                  >
                    <h3 className="text-sm font-bold text-cyan-300 mb-3">
                      {category.name}
                    </h3>
                    <div className="space-y-3">
                      {categoryItems.map((item, idx) => {
                        const globalIndex = form.evaluationItems.findIndex(
                          (e) => e.srNo === item.srNo
                        );
                        const hasError =
                          validationErrors[`evaluation_${globalIndex}`];
                        const evalNum =
                          typeof item.evaluation === "number"
                            ? item.evaluation
                            : item.evaluation
                            ? parseInt(item.evaluation, 10)
                            : null;
                        const showRemarks =
                          evalNum !== null && !isNaN(evalNum) && evalNum < 3;

                        return (
                          <div
                            key={item.srNo}
                            className="border border-white/5 rounded-lg p-3 bg-slate-900/30"
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-xs font-semibold text-slate-300 min-w-[40px]">
                                {item.srNo}.
                              </span>
                              <div className="flex-1 space-y-2">
                                <p className="text-xs text-slate-200">
                                  {item.area}
                                </p>
                                <div className="flex gap-3 items-start">
                                  <div className="flex-1">
                                    <label className="block text-[10px] uppercase tracking-wide text-slate-300 mb-1">
                                      Evaluation (1-5)
                                    </label>
                                    <select
                                      className={`w-full rounded-lg bg-slate-900/40 border ${
                                        hasError
                                          ? "border-red-500"
                                          : "border-white/15"
                                      } px-2 py-1.5 text-xs text-white`}
                                      value={
                                        item.evaluation !== null &&
                                        item.evaluation !== undefined
                                          ? String(item.evaluation)
                                          : ""
                                      }
                                      onChange={(e) =>
                                        handleEvaluationChange(
                                          globalIndex,
                                          "evaluation",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <option value="">Select</option>
                                      <option value="1">1</option>
                                      <option value="2">2</option>
                                      <option value="3">3</option>
                                      <option value="4">4</option>
                                      <option value="5">5</option>
                                    </select>
                                  </div>
                                  {(showRemarks || item.remarks) && (
                                    <div className="flex-1">
                                      <label className="block text-[10px] uppercase tracking-wide text-slate-300 mb-1">
                                        Remarks{" "}
                                        <span className="text-red-400">
                                          *
                                        </span>
                                      </label>
                                      <textarea
                                        className={`w-full rounded-lg bg-slate-900/40 border ${
                                          hasError
                                            ? "border-red-500"
                                            : "border-white/15"
                                        } px-2 py-1.5 text-xs text-white`}
                                        rows={2}
                                        value={item.remarks}
                                        onChange={(e) =>
                                          handleEvaluationChange(
                                            globalIndex,
                                            "remarks",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Required when evaluation < 3"
                                        required={showRemarks}
                                      />
                                      {hasError && (
                                        <p className="text-[10px] text-red-400 mt-1">
                                          {
                                            validationErrors[
                                              `evaluation_${globalIndex}`
                                            ]
                                          }
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lead POAC Comments & Signatures */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-orange-300">
              Lead POAC Comments & Signatures
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Lead POAC Comment
                </label>
                <textarea
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                  rows={4}
                  value={form.leadPOACComment}
                  onChange={(e) =>
                    handleChange("leadPOACComment", e.target.value)
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                    Lead POAC Name
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                    value={form.leadPOACName}
                    onChange={(e) =>
                      handleChange("leadPOACName", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                    Lead POAC Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                    value={form.leadPOACDate}
                    onChange={(e) =>
                      handleChange("leadPOACDate", e.target.value)
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                  Lead POAC Signature
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                  value={form.leadPOACSignature}
                  onChange={(e) =>
                    handleChange("leadPOACSignature", e.target.value)
                  }
                  placeholder="Signature URL or text"
                />
              </div>
            </div>
          </div>

          {/* Operations Support Team Comment */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-orange-300">
              Operations Support Team Comment
            </h2>
            <textarea
              className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
              rows={4}
              value={form.opsSupportTeamComment}
              onChange={(e) =>
                handleChange("opsSupportTeamComment", e.target.value)
              }
            />
          </div>

          {/* Ops Team Signatures */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-orange-300">
              Operations Team Signatures
            </h2>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                    Ops Team Name
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                    value={form.opsTeamName}
                    onChange={(e) =>
                      handleChange("opsTeamName", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                    Ops Team Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                    value={form.opsTeamDate}
                    onChange={(e) =>
                      handleChange("opsTeamDate", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                    Ops Team Signature
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                    value={form.opsTeamSignature}
                    onChange={(e) =>
                      handleChange("opsTeamSignature", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                    Ops Team Superintendent Name
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                    value={form.opsTeamSupdtName}
                    onChange={(e) =>
                      handleChange("opsTeamSupdtName", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                    Ops Team Superintendent Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                    value={form.opsTeamSupdtDate}
                    onChange={(e) =>
                      handleChange("opsTeamSupdtDate", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 mb-1.5">
                    Ops Team Superintendent Signature
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white"
                    value={form.opsTeamSupdtSignature}
                    onChange={(e) =>
                      handleChange("opsTeamSupdtSignature", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="rounded-full border border-white/20 bg-transparent px-6 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!canSubmit || submitting || saving}
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-orange-500 hover:bg-orange-400 px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] shadow disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!canSubmit || submitting || saving}
            >
              {submitting ? "Submitting..." : "Submit Form"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


