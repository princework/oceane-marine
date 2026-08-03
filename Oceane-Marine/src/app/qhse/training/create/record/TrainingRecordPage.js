"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useQhseRole } from "@/hooks/useQhseRole";
import { readJsonFromResponse } from "@/lib/utils/readJsonFromResponse";

/* ---------------- helpers ---------------- */

// Generate dynamic years
function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i < currentYear; i++) years.push(i);
  for (let i = currentYear; i <= currentYear + 5; i++) years.push(i);
  return years;
}

const MONTH_PAIRS = [
  { label: "Jan–Feb", key: "Jan-Feb" },
  { label: "Mar–Apr", key: "Mar-Apr" },
  { label: "May–Jun", key: "May-Jun" },
  { label: "Jul–Aug", key: "Jul-Aug" },
  { label: "Sep–Oct", key: "Sep-Oct" },
  { label: "Nov–Dec", key: "Nov-Dec" },
];

// Normalize date to yyyy-mm-dd
const toDateInputValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
};

const getInitialFormData = (overrides = {}) => ({
  actualTrainingDate: new Date().toISOString().slice(0, 10),
  trainees: [{ name: "", role: "" }],
  ...overrides,
});

/* ---------------- component ---------------- */

export default function TrainingRecordPage({ hideSidebar = false }) {
  const currentYear = new Date().getFullYear();
  const initialYears = getYears();

  const [availableYears, setAvailableYears] = useState(initialYears);
  const [loadingYears, setLoadingYears] = useState(true);
  const [year, setYear] = useState(currentYear); // number or "all"
  const [selectedPair, setSelectedPair] = useState(0);

  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [planDeleting, setPlanDeleting] = useState(false);
  const [planApproving, setPlanApproving] = useState(false);
  const [planRejecting, setPlanRejecting] = useState(false);
  const [showPlanRejectModal, setShowPlanRejectModal] = useState(false);
  const [planRejectionReason, setPlanRejectionReason] = useState("");
  const [creatingFor, setCreatingFor] = useState(null);
  const [editingRecordId, setEditingRecordId] = useState(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState(null);

  const [formData, setFormData] = useState(() => getInitialFormData());
  const [attachmentFile, setAttachmentFile] = useState(null);

  const [downloadingPlanDocx, setDownloadingPlanDocx] = useState(false);
  const [downloadingPlanPdf, setDownloadingPlanPdf] = useState(false);
  const [downloadingRecordDocxId, setDownloadingRecordDocxId] = useState(null);
  const [downloadingRecordPdfId, setDownloadingRecordPdfId] = useState(null);
  const [expandedAttendanceId, setExpandedAttendanceId] = useState(null);

  /* ---------------- effects ---------------- */

  useEffect(() => {
    const loadYears = async () => {
      setLoadingYears(true);
      try {
        const res = await fetch("/api/qhse/training/plan");
        const data = await readJsonFromResponse(res);
        if (res.ok && data.success && Array.isArray(data.data)) {
          const merged = Array.from(
            new Set([...initialYears, ...data.data])
          ).sort((a, b) => b - a);
          setAvailableYears(merged);
          // Do not change the selected year here — keep user's selection (or initial currentYear) so it doesn't change while filling the form
        }
      } catch {
        /* Non-JSON or network: keep default year list */
      } finally {
        setLoadingYears(false);
      }
    };
    loadYears();
  }, []);

  useEffect(() => {
    if (year === "all") {
      setPlan(null);
      setPlanError("Select a year to view the monthly training plan.");
      setPlanLoading(false);
      return;
    }
    let active = true;
    const fetchPlan = async () => {
      setPlanLoading(true);
      setPlanError(null);
      setCreatingFor(null);
      try {
        const res = await fetch(`/api/qhse/training/plan?year=${year}`);
        const data = await readJsonFromResponse(res);
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load training plan");
        }
        if (active) setPlan(data.data);
      } catch (err) {
        if (active) {
          setPlan(null);
          setPlanError(err.message);
        }
      } finally {
        if (active) setPlanLoading(false);
      }
    };
    fetchPlan();
    return () => {
      active = false;
    };
  }, [year]);

  const handleDeletePlan = async () => {
    if (!canDelete) return;
    if (!plan?._id) return;
    if (!window.confirm("Delete this training plan? This cannot be undone.")) return;
    setPlanDeleting(true);
    setPlanError(null);
    try {
      const res = await fetch(`/api/qhse/training/plan/${plan._id}`, { method: "DELETE" });
      const data = await readJsonFromResponse(res);
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete plan");
      setPlan(null);
      setMessage("Training plan deleted.");
      const yearsRes = await fetch("/api/qhse/training/plan");
      const yearsData = await readJsonFromResponse(yearsRes);
      if (yearsRes.ok && yearsData.success && Array.isArray(yearsData.data)) {
        const merged = Array.from(new Set([...getYears(), ...yearsData.data])).sort((a, b) => b - a);
        setAvailableYears(merged);
      }
    } catch (err) {
      setPlanError(err.message);
    } finally {
      setPlanDeleting(false);
    }
  };

  const handleApprovePlan = async () => {
    if (!canApprove || !plan?._id) return;
    if (!window.confirm(`Approve the Training Plan for ${plan.year}?`)) return;
    setPlanApproving(true);
    setPlanError(null);
    try {
      const res = await fetch(`/api/qhse/training/plan/${plan._id}/approve`, {
        method: "PUT",
      });
      const data = await readJsonFromResponse(res);
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to approve plan");
      setPlan(data.data);
      setMessage("Training plan approved.");
    } catch (err) {
      setPlanError(err.message);
    } finally {
      setPlanApproving(false);
    }
  };

  const submitRejectPlan = async () => {
    if (!canApprove || !plan?._id) return;
    if (!planRejectionReason.trim()) return;
    setPlanRejecting(true);
    setPlanError(null);
    try {
      const res = await fetch(`/api/qhse/training/plan/${plan._id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: planRejectionReason.trim() }),
      });
      const data = await readJsonFromResponse(res);
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to reject plan");
      setPlan(data.data);
      setMessage("Training plan rejected.");
      setShowPlanRejectModal(false);
      setPlanRejectionReason("");
    } catch (err) {
      setPlanError(err.message);
    } finally {
      setPlanRejecting(false);
    }
  };

  const handleDownloadPlanDocx = async () => {
    if (!plan?._id) return;
    setDownloadingPlanDocx(true);
    try {
      const res = await fetch(`/api/qhse/training/plan/${plan._id}/download`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Training-Matrix-${plan.year ?? "plan"}-${plan.serialNumber ?? plan._id}.docx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download Word");
    } finally {
      setDownloadingPlanDocx(false);
    }
  };

  const handleDownloadPlanPdf = async () => {
    if (!plan?._id) return;
    setDownloadingPlanPdf(true);
    try {
      const res = await fetch(`/api/qhse/training/plan/${plan._id}/download/pdf`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Training-Matrix-${plan.year ?? "plan"}-${plan.serialNumber ?? plan._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPlanPdf(false);
    }
  };

  const handleDownloadRecordDocx = async (recordId, serialNumber) => {
    setDownloadingRecordDocxId(recordId);
    try {
      const res = await fetch(`/api/qhse/training/record/${recordId}/download/docx`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Training-Record-${serialNumber ?? recordId}.docx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download Word");
    } finally {
      setDownloadingRecordDocxId(null);
    }
  };

  const handleDownloadRecordPdf = async (recordId, serialNumber) => {
    setDownloadingRecordPdfId(recordId);
    try {
      const res = await fetch(`/api/qhse/training/record/${recordId}/download/pdf`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Training-Record-${serialNumber ?? recordId}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(err.message || "Failed to download PDF");
    } finally {
      setDownloadingRecordPdfId(null);
    }
  };

  // Fetch records when year changes
  useEffect(() => {
    let active = true;
    const fetchRecords = async () => {
      setLoadingRecords(true);
      setRecordsError(null);
      try {
        const res = await fetch(
          `/api/qhse/training/record?year=${year === "all" ? "all" : year}`,
          { cache: "no-store" }
        );
        const data = await readJsonFromResponse(res);
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load training records");
        }
        if (active) setRecords(data.data || []);
      } catch (err) {
        if (active) {
          setRecordsError(err.message);
          setRecords([]);
        }
      } finally {
        if (active) setLoadingRecords(false);
      }
    };
    fetchRecords();
    return () => {
      active = false;
    };
  }, [year]);

  /* ---------------- handlers ---------------- */

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTraineeChange = (index, field, value) => {
    setFormData((prev) => {
      const trainees = [...prev.trainees];
      trainees[index] = { ...trainees[index], [field]: value };
      return { ...prev, trainees };
    });
  };

  const addTrainee = () => {
    setFormData((prev) => ({
      ...prev,
      trainees: [...prev.trainees, { name: "", role: "" }],
    }));
  };

  const removeTrainee = (index) => {
    setFormData((prev) => ({
      ...prev,
      trainees: prev.trainees.filter((_, i) => i !== index),
    }));
  };

  const applyPlanItem = (item, monthPairIndex) => {
    if (!item) return;
    setEditingRecordId(null);
    setFormData(
      getInitialFormData({
        actualTrainingDate: toDateInputValue(item.plannedDate),
      })
    );
    setAttachmentFile(null);
    setCreatingFor({ ...item, _monthPairIndex: monthPairIndex });
    setMessage(null);
    setError(null);
  };

  const startEditRecord = (record, planItem, monthPairIndex) => {
    if (!record?._id || !planItem) return;
    setEditingRecordId(record._id);
    setCreatingFor({ ...planItem, _monthPairIndex: monthPairIndex });
    setFormData({
      actualTrainingDate: toDateInputValue(record.actualTrainingDate || planItem.plannedDate),
      trainees: (record.attendance || []).map((t) => ({
        name: t.traineeName || "",
        role: t.department || t.designation || "",
      })),
    });
    setAttachmentFile(null);
    setMessage(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeRecordForm = () => {
    setCreatingFor(null);
    setEditingRecordId(null);
    setFormData(getInitialFormData());
    setAttachmentFile(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const isEdit = Boolean(editingRecordId);
    if (!isEdit && !plan?._id) {
      setError("Select a year with an approved training plan before creating a record.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const validTrainees = formData.trainees.filter(
        (t) => t.name.trim() && t.role.trim()
      );

      if (
        !formData.actualTrainingDate ||
        validTrainees.length === 0
      ) {
        throw new Error("Please fill all required fields.");
      }

      const attendance = validTrainees.map((t) => ({
        traineeName: t.name.trim(),
        role: t.role.trim(),
      }));

      if (!isEdit) {
        const expectedMonthPairIndex = creatingFor._monthPairIndex;
        if (expectedMonthPairIndex !== undefined && expectedMonthPairIndex !== null) {
          const plannedDateMonth = new Date(creatingFor.plannedDate).getMonth();
          const expectedMonths = MONTH_PAIRS[expectedMonthPairIndex].key.split("-").map((m) => {
            const monthMap = {
              Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
              Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
            };
            return monthMap[m];
          });
          if (!expectedMonths.includes(plannedDateMonth)) {
            throw new Error(
              `Planned date month (${plannedDateMonth}) does not match selected month pair (${MONTH_PAIRS[expectedMonthPairIndex].label})`
            );
          }
        }
      }

      const submitFormData = new FormData();
      if (!isEdit) {
        submitFormData.append("trainingPlanId", plan._id);
        const plannedDateStr = creatingFor.plannedDate
          ? typeof creatingFor.plannedDate === "string"
            ? creatingFor.plannedDate
            : new Date(creatingFor.plannedDate).toISOString().split("T")[0]
          : "";
        submitFormData.append("plannedDate", plannedDateStr);
        submitFormData.append("topic", creatingFor.topic);
        submitFormData.append("instructor", creatingFor.instructor);
      }
      submitFormData.append("actualTrainingDate", formData.actualTrainingDate);
      submitFormData.append("attendance", JSON.stringify(attendance));

      if (attachmentFile) {
        submitFormData.append("attachment", attachmentFile);
      }

      const res = await fetch(
        isEdit ? `/api/qhse/training/record/${editingRecordId}` : "/api/qhse/training/record",
        {
          method: isEdit ? "PUT" : "POST",
          body: submitFormData,
        }
      );

      const data = await readJsonFromResponse(res);
      if (!res.ok || !data.success) {
        throw new Error(
          data.error ||
            (isEdit ? "Failed to update training record" : "Failed to create training record")
        );
      }

      setMessage(
        isEdit ? "Training record updated successfully!" : "Training record saved successfully!"
      );
      window.scrollTo({ top: 0, behavior: "smooth" });

      closeRecordForm();
      
      // Refresh plan and records (only refresh plan when a specific year is selected)
      if (year !== "all") {
        const refreshRes = await fetch(`/api/qhse/training/plan?year=${year}`);
        const refreshData = await readJsonFromResponse(refreshRes);
        if (refreshRes.ok && refreshData.success) {
          setPlan(refreshData.data);
        }
      }
      
      // Refresh records list (cache-bust so new record is included)
      const recordsRes = await fetch(
        `/api/qhse/training/record?year=${year === "all" ? "all" : year}&_t=${Date.now()}`,
        { cache: "no-store" }
      );
      const recordsData = await readJsonFromResponse(recordsRes);
      if (recordsRes.ok && recordsData.success) {
        setRecords(recordsData.data || []);
      }
    } catch (err) {
      let msg = err?.message || "Save failed";
      if (/Unexpected token ['"]?</i.test(msg) || /not valid JSON/i.test(msg)) {
        msg =
          "The server returned an error page instead of data. Sign in again, try a smaller attachment (under 25MB), then retry. If it continues, open DevTools → Network → the training/record request and check the status code.";
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- UI ---------------- */

  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = editingRecordId ? canEdit : canCreate;

  const { contentClassName } = useQhseSidebar();
  const content = (
    <div className={`${contentClassName} w-full min-w-0 pr-4`}>
      <div className="flex-1">
        <div className="mx-auto max-w-[95%] pl-3 sm:pl-4 pr-3 sm:pr-4 py-6 sm:py-6 sm:py-10 space-y-3 sm:space-y-4 sm:space-y-6">
          <header className="mt-12 md:mt-0 mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
            {/* Left: Dashboard */}
            <Link
              href="/dashboard"
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold shadow-lg shadow-black/25 backdrop-blur-md transition flex-shrink-0"
            >
              ← Dashboard
            </Link>

            {/* Center: Title */}
            <div className="flex-1 flex flex-col items-center text-center w-full sm:w-auto">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.25em] text-sky-300">
                QHSE / Training
              </p>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Training Record</h1>
              <p className="text-xs sm:text-sm text-slate-200 mt-1">
                Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-039</span>
              </p>
            </div>

            {/* Right: Template + Year + Tabs */}
            <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
              <a
                href="/templates/controlled-register/QAF-OFD-039.docx"
                download
                className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition"
                title="Download form template (QAF-OFD-039)"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
                </svg>
                Template
              </a>
              <div className="inline-flex max-w-full flex-wrap justify-center rounded-lg sm:rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                <Link
                  href="/qhse/training/create/plan"
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
                >
                  Training Matrix
                </Link>
                <Link
                  href="/qhse/training/create/record"
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
                >
                  Training Record
                </Link>
              </div>
            </div>
          </header>

          {/* Plan list and create-record trigger */}
          <div className="rounded-2xl border border-white/10 bg-[#0b2740]/70 p-4 space-y-3">
            {/* Mobile: year centered + compact. sm+: year top-right */}
            <div className="mb-1 flex justify-center sm:mb-2 sm:justify-end">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-200 sm:text-xs sm:tracking-[0.2em]">
                  Year
                </span>
                <select
                  className="min-w-[4.5rem] rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs leading-tight text-white focus:outline-none focus:ring-2 focus:ring-sky-500 sm:min-w-[5.5rem] sm:px-3 sm:py-2 sm:text-sm"
                  value={year === "all" ? "all" : String(year)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setYear(v === "all" ? "all" : Number(v));
                  }}
                  disabled={availableYears.length === 0}
                  aria-label="Filter by year"
                >
                  <option value="all">All years</option>
                  {(loadingYears ? initialYears : availableYears).map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="border-b border-white/10 pb-3">
              {/* Own row: title — centered on all breakpoints */}
              <h2 className="text-center text-base font-semibold text-white whitespace-nowrap sm:text-lg">
                Training Records for {year === "all" ? "All years" : year}
              </h2>
              {/* Next row: badges, actions, hint — centered; unchanged stacking on small screens */}
              <div className="mt-3 flex flex-col items-center gap-3 text-center sm:mt-4">
                {plan && (
                  <div className="flex w-full max-w-md flex-col items-center gap-2">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-lg border border-white/15 bg-white/5 text-slate-200">
                        Plan year: {plan.year}
                      </span>
                      {(plan.formCode || plan.serialNumber) && (
                        <span className="text-xs px-2 py-1 rounded-lg border border-white/15 bg-white/5 font-mono text-sky-200">
                          {[plan.formCode, plan.serialNumber].filter(Boolean).join(" • ")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadPlanDocx}
                        disabled={downloadingPlanDocx || downloadingPlanPdf}
                        className="text-xs px-3 py-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 disabled:opacity-50 transition"
                      >
                        {downloadingPlanDocx ? "…" : "Word"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPlanPdf}
                        disabled={downloadingPlanDocx || downloadingPlanPdf}
                        className="text-xs px-3 py-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 transition"
                      >
                        {downloadingPlanPdf ? "…" : "PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeletePlan}
                        disabled={!canDelete || planDeleting}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-400/50 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50 transition"
                      >
                        {planDeleting ? "Deleting…" : "Delete plan"}
                      </button>
                    </div>
                  </div>
                )}

                {plan && plan.status && plan.status !== "Approved" && (
                  <div
                    className={`w-full max-w-md rounded-xl border px-4 py-3 text-left space-y-2 ${
                      plan.status === "Pending Approval"
                        ? "border-amber-400/40 bg-amber-500/10"
                        : "border-red-400/40 bg-red-500/10"
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        plan.status === "Pending Approval" ? "text-amber-200" : "text-red-200"
                      }`}
                    >
                      {plan.status === "Pending Approval" ? "Pending your approval" : "Rejected"}
                    </span>
                    {plan.status === "Rejected" && plan.rejectionReason && (
                      <p className="text-xs text-red-100">Reason: {plan.rejectionReason}</p>
                    )}
                    {plan.status === "Pending Approval" && canApprove && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleApprovePlan}
                          disabled={planApproving || planRejecting}
                          className="text-xs px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50 transition"
                        >
                          {planApproving ? "Approving…" : "Approve plan"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPlanRejectModal(true)}
                          disabled={planApproving || planRejecting}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50 transition"
                        >
                          Reject plan
                        </button>
                      </div>
                    )}
                    {plan.status === "Pending Approval" && !canApprove && (
                      <p className="text-xs text-amber-100">
                        Waiting for a QHSE approver to review this plan.
                      </p>
                    )}
                  </div>
                )}

                {showPlanRejectModal && (
                  <div className="w-full max-w-md rounded-xl border border-red-400/40 bg-red-950/30 px-4 py-3 text-left space-y-2">
                    <label className="block text-xs font-semibold text-red-200">
                      Rejection reason
                    </label>
                    <textarea
                      value={planRejectionReason}
                      onChange={(e) => setPlanRejectionReason(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/40"
                      placeholder="Explain why this plan is being rejected…"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPlanRejectModal(false);
                          setPlanRejectionReason("");
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={submitRejectPlan}
                        disabled={planRejecting || !planRejectionReason.trim()}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-400/50 bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition"
                      >
                        {planRejecting ? "Rejecting…" : "Confirm reject"}
                      </button>
                    </div>
                  </div>
                )}

                {plan?.status === "Approved" && (
                  <p className="text-xs text-slate-300">
                    Select a month pair to create record
                  </p>
                )}
              </div>
            </div>
            {planLoading && (
              <p className="text-sm text-slate-200">Loading plan…</p>
            )}
            {planError && (
              <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                {planError}
              </div>
            )}
            {plan && plan.year !== year && (
              <div className="text-sm text-amber-200 bg-amber-950/40 border border-amber-500/40 rounded-lg px-4 py-2">
                Plan year ({plan.year}) differs from selected year ({year}).
                Switch the selector to match.
              </div>
            )}
            {plan && plan.status === "Approved" && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {MONTH_PAIRS.map((pair, idx) => {
                  // Match plan item to month pair based on the month of plannedDate
                  // Plan items might not be in array order if some months weren't filled
                  const item = plan.planItems?.find((pi) => {
                    if (!pi?.plannedDate) return false;
                    const month = new Date(pi.plannedDate).getMonth(); // 0-11
                    // Check if this plan item's month belongs to the current month pair
                    const pairMonths = pair.key.split("-").map((m) => {
                      const monthMap = {
                        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
                        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
                      };
                      return monthMap[m];
                    });
                    return pairMonths.includes(month);
                  }) || null;
                  
                  return (
                    <div
                      key={pair.key}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{pair.label}</span>
                        <span className="text-xs text-slate-300">
                          {item ? toDateInputValue(item.plannedDate) : "—"}
                        </span>
                      </div>
                      <p className="text-sm text-white/90">
                        {item?.topic || "No plan"}
                      </p>
                      <p className="text-xs text-slate-300">
                        {item?.instructor || ""}
                      </p>
                      <button
                        type="button"
                        disabled={!item}
                        onClick={() => item && applyPlanItem(item, idx)}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-orange-400/60 text-orange-200 hover:bg-orange-500/10 disabled:opacity-50"
                      >
                        {item ? "Create record" : "Not planned"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {creatingFor && (
            <>
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-6"
            >
              {!canSubmit && (
                <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
                  You do not have permission to {editingRecordId ? "update" : "create"} training records. Form is view-only.
                </div>
              )}
              <fieldset disabled={!canSubmit} className="border-0 p-0 m-0 min-w-0 space-y-6 disabled:opacity-[0.88]">
              {/* Form Fields */}
              <div className="rounded-2xl border border-white/10 bg-[#0b2740]/80 p-6 space-y-6">
                {/* General Details Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">➕</span>
                      <h2 className="text-lg font-semibold">
                        {editingRecordId ? "Edit training record" : "Training record details"}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={closeRecordForm}
                      className="text-xs text-slate-200 hover:text-white"
                    >
                      ✕ Close
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        htmlFor="topic"
                        className="block text-sm font-semibold text-white/90"
                      >
                        Topic :
                      </label>
                      <input
                        id="topic"
                        type="text"
                        value={creatingFor.topic || ""}
                        disabled
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/60 placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="instructor"
                        className="block text-sm font-semibold text-white/90"
                      >
                        Instructor :
                      </label>
                      <input
                        id="instructor"
                        type="text"
                        value={creatingFor.instructor || ""}
                        disabled
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/60 placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="planned-date"
                        className="block text-sm font-semibold text-white/90"
                      >
                        Planned Date :
                      </label>
                      <div className="relative">
                        <input
                          id="planned-date"
                          type="date"
                          value={toDateInputValue(creatingFor.plannedDate)}
                          disabled
                          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/60 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="actual-date"
                        className="block text-sm font-semibold text-white/90"
                      >
                        Actual Training Date :
                      </label>
                      <div className="relative">
                        <input
                          id="actual-date"
                          type="date"
                          value={formData.actualTrainingDate}
                          onChange={(e) =>
                            handleFieldChange("actualTrainingDate", e.target.value)
                          }
                          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attachment Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <h2 className="text-lg font-semibold">Attachment</h2>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="attachment"
                      className="block text-sm font-semibold text-white/90"
                    >
                      Upload Document :
                    </label>
                    <input
                      id="attachment"
                      type="file"
                      onChange={(e) => setAttachmentFile(e.target.files[0] || null)}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600 file:cursor-pointer focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                    />
                    {attachmentFile && (
                      <p className="text-xs text-slate-300">
                        Selected: {attachmentFile.name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Trainees Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h2 className="text-lg font-semibold">Trainees</h2>
                    <button
                      type="button"
                      onClick={addTrainee}
                      className="px-3 py-1 rounded-lg border border-white/20 bg-white/5 text-xs font-semibold hover:bg-white/10 transition"
                    >
                      + Add Trainee
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.trainees.map((trainee, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <div className="flex-1 grid gap-3 md:grid-cols-2">
                          <input
                            type="text"
                            value={trainee.name}
                            onChange={(e) =>
                              handleTraineeChange(
                                index,
                                "name",
                                e.target.value
                              )
                            }
                            placeholder="Trainee Name"
                            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                          />
                          <input
                            type="text"
                            value={trainee.role}
                            onChange={(e) =>
                              handleTraineeChange(
                                index,
                                "role",
                                e.target.value
                              )
                            }
                            placeholder="Role (e.g., Engineer, Manager)"
                            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition outline-none"
                          />
                        </div>
                        {formData.trainees.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTrainee(index)}
                            className="px-3 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Messages */}
              {error && (
                <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                  {error}
                </div>
              )}
              {message && (
                <div className="text-base text-emerald-300 bg-emerald-950/40 border-2 border-emerald-500/60 rounded-lg px-6 py-4 shadow-lg shadow-emerald-500/20">
                  <span className="font-semibold">{message}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="submit"
                  disabled={!canSubmit || saving}
                  className="px-6 py-3 rounded-xl bg-orange-500 text-sm font-semibold uppercase tracking-[0.2em] shadow-lg shadow-orange-500/40 hover:bg-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving
                    ? "Saving..."
                    : editingRecordId
                      ? "Update Training Record"
                      : "Save Training Record"}
                </button>
              </div>
              </fieldset>
            </form>
            </>
          )}

          {/* Records List Section */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Monthly Training Plan
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Plan & records grouped by month pairs
                </p>
              </div>
              {loadingRecords && (
                <span className="text-xs text-slate-300">Loading…</span>
              )}
            </div>

            {recordsError && (
              <div className="text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-3">
                {recordsError}
              </div>
            )}

            {/* Quarter File Downloads Section */}
            {plan && plan.monthPairFiles && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 space-y-4">
                <h3 className="text-base font-semibold text-white border-b border-white/10 pb-2">
                  Training Matrix Files (Month Pair-wise)
                </h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {MONTH_PAIRS.map((pair) => {
                    const monthPairKey = pair.key;
                    const monthPairFile = plan.monthPairFiles?.[monthPairKey];
                    if (!monthPairFile || !monthPairFile.filePath) return null;

                    return (
                      <div
                        key={monthPairKey}
                        className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">
                            {pair.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {monthPairFile.fileName || "Training Matrix"}
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await fetch(
                                `/api/qhse/training/download/quarter-file?planId=${plan._id}&monthPair=${monthPairKey}`
                              );
                              if (!res.ok) {
                                let msg = "Failed to download file";
                                try {
                                  const data = await res.json();
                                  msg = data.error || msg;
                                } catch {
                                  /* ignore */
                                }
                                throw new Error(msg);
                              }
                              const blob = await res.blob();
                              const url = globalThis.URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download =
                                monthPairFile.fileName ||
                                `training-matrix-${monthPairKey}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              globalThis.URL.revokeObjectURL(url);
                              a.remove();
                            } catch (err) {
                              alert(err.message || "Failed to download file");
                            }
                          }}
                          className="w-full text-xs text-sky-300 hover:text-sky-200 font-medium px-3 py-2 rounded border border-sky-400/30 hover:bg-sky-400/10 transition"
                        >
                          📥 Download {pair.label} File
                        </button>
                      </div>
                    );
                  })}
                </div>
                {!MONTH_PAIRS.some(
                  (pair) => plan.monthPairFiles?.[pair.key]?.filePath
                ) && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No training matrix files uploaded for this plan.
                  </p>
                )}
              </div>
            )}

            {!loadingRecords && !recordsError && year === "all" && records.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">Records across all years (select a year to see month-pair view).</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {records.map((record) => (
                    <div
                      key={record._id}
                      className="rounded-xl border border-white/10 bg-slate-900/40 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">
                          {record.topic || "—"}
                        </span>
                        {record.status && (
                          <span className="text-[11px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200">
                            {record.status}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-slate-300">
                        <div>
                          <span className="text-slate-400">Planned:</span>{" "}
                          {record.plannedDate
                            ? new Date(record.plannedDate).toLocaleDateString()
                            : "—"}
                        </div>
                        <div>
                          <span className="text-slate-400">Actual:</span>{" "}
                          {record.actualTrainingDate
                            ? new Date(record.actualTrainingDate).toLocaleDateString()
                            : "—"}
                        </div>
                        <div>
                          <span className="text-slate-400">Instructor:</span>{" "}
                          {record.instructor || "—"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleDownloadRecordDocx(record._id, record.serialNumber)}
                          disabled={downloadingRecordDocxId === record._id || downloadingRecordPdfId === record._id}
                          className="text-xs text-sky-300 hover:text-sky-200 font-medium px-2 py-1 rounded border border-sky-400/30 hover:bg-sky-400/10 disabled:opacity-50 transition"
                        >
                          {downloadingRecordDocxId === record._id ? "…" : "Word"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadRecordPdf(record._id, record.serialNumber)}
                          disabled={downloadingRecordDocxId === record._id || downloadingRecordPdfId === record._id}
                          className="text-xs text-rose-300 hover:text-rose-200 font-medium px-2 py-1 rounded border border-rose-400/30 hover:bg-rose-500/10 disabled:opacity-50 transition"
                        >
                          {downloadingRecordPdfId === record._id ? "…" : "PDF"}
                        </button>
                        {record.attachment?.fileName && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await fetch(
                                  `/api/qhse/training/record/${record._id}/download`
                                );
                                if (!res.ok) {
                                  let msg = "Failed to download attachment";
                                  try {
                                    const data = await res.json();
                                    msg = data.error || msg;
                                  } catch {
                                    /* ignore */
                                  }
                                  throw new Error(msg);
                                }
                                const blob = await res.blob();
                                const url = globalThis.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = record.attachment.fileName;
                                document.body.appendChild(a);
                                a.click();
                                globalThis.URL.revokeObjectURL(url);
                                a.remove();
                              } catch (err) {
                                alert(err.message || "Failed to download attachment");
                              }
                            }}
                            className="text-xs text-slate-300 hover:text-slate-200 font-medium px-2 py-1 rounded border border-white/20 hover:bg-white/10 transition"
                          >
                            📥 Attachment
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loadingRecords && !recordsError && (year !== "all" || records.length === 0) && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {MONTH_PAIRS.map((pair, idx) => {
                  // Match plan item to month pair based on the month of plannedDate
                  const planItem = plan?.planItems?.find((pi) => {
                    if (!pi?.plannedDate) return false;
                    const month = new Date(pi.plannedDate).getMonth(); // 0-11
                    // Check if this plan item's month belongs to the current month pair
                    const pairMonths = pair.key.split("-").map((m) => {
                      const monthMap = {
                        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
                        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
                      };
                      return monthMap[m];
                    });
                    return pairMonths.includes(month);
                  }) || null;
                  
                  // Find record for this plan item by matching exact plannedDate
                  let record = null;
                  if (planItem && planItem.plannedDate) {
                    const planDateStr = new Date(planItem.plannedDate).toISOString().split("T")[0];
                    record = records.find((r) => {
                      if (!r.plannedDate) return false;
                      const recordDateStr = new Date(r.plannedDate).toISOString().split("T")[0];
                      return recordDateStr === planDateStr;
                    }) || null;
                  }

                  // Only show card if there's a plan item
                  if (!planItem) return null;

                  return (
                    <div
                      key={pair.key}
                      className="rounded-xl border border-white/10 bg-slate-900/40 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-white">
                          {pair.label}
                        </div>
                        {record?.status && (
                          <span className="text-[11px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200">
                            {record.status}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-slate-300">
                        <div>
                          <span className="text-slate-400">Planned:</span>{" "}
                          {planItem.plannedDate
                            ? new Date(planItem.plannedDate).toLocaleDateString()
                            : "—"}
                        </div>
                        <div>
                          <span className="text-slate-400">Topic:</span>{" "}
                          {planItem.topic || "—"}
                        </div>
                        <div>
                          <span className="text-slate-400">Instructor:</span>{" "}
                          {planItem.instructor || "—"}
                        </div>
                      </div>

                      <div className="border-t border-white/10 pt-3">
                        <div className="text-xs text-slate-400 mb-1">
                          Record
                        </div>
                        {record ? (
                          <div className="space-y-1 text-xs text-slate-200">
                            <div>
                              <span className="text-slate-400">Plan:</span>{" "}
                              {[plan?.formCode, plan?.serialNumber].filter(Boolean).join(" • ") || "—"}
                            </div>
                            <div>
                              <span className="text-slate-400">Record Form Code:</span>{" "}
                              {record.formCode || "—"}
                            </div>
                            <div>
                              <span className="text-slate-400">Actual:</span>{" "}
                              {record.actualTrainingDate
                                ? new Date(
                                    record.actualTrainingDate
                                  ).toLocaleDateString()
                                : "—"}
                            </div>
                            <div>
                              <span className="text-slate-400">Status:</span>{" "}
                              {record.status || "—"}
                            </div>
                            {record.attendance && record.attendance.length > 0 && (
                              <div className="space-y-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedAttendanceId((prev) =>
                                      prev === record._id ? null : record._id
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"
                                >
                                  <span className="text-slate-400">Trainees:</span>
                                  <span>{record.attendance.length}</span>
                                  <span className="text-[10px]">
                                    {expandedAttendanceId === record._id ? "▲ Hide" : "▼ View signatures"}
                                  </span>
                                </button>
                                {expandedAttendanceId === record._id && (
                                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-white/10 bg-slate-900/40 p-2">
                                    {record.attendance.map((t, idx) => {
                                      const sig = (t.signature || "").trim();
                                      const isImage =
                                        sig.startsWith("data:image") ||
                                        sig.startsWith("/signature/") ||
                                        sig.startsWith("/uploads/") ||
                                        /^https?:\/\//.test(sig);
                                      return (
                                        <div
                                          key={idx}
                                          className="rounded-md border border-white/10 bg-white/5 p-2"
                                        >
                                          <p className="text-xs font-semibold text-white">
                                            {t.traineeName || "—"}
                                          </p>
                                          {(t.designation || t.department) && (
                                            <p className="text-[10px] text-slate-400">
                                              {[t.designation, t.department]
                                                .filter(Boolean)
                                                .join(" • ")}
                                            </p>
                                          )}
                                          <div className="mt-1">
                                            {isImage ? (
                                              <div className="inline-block rounded-sm border border-white/15 bg-white p-0.5">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                  src={sig}
                                                  alt={`${t.traineeName || "trainee"} signature`}
                                                  className="h-12 w-auto max-w-[160px] object-contain"
                                                  loading="lazy"
                                                />
                                              </div>
                                            ) : sig ? (
                                              <p className="text-[11px] italic text-slate-200">
                                                {sig}
                                              </p>
                                            ) : (
                                              <p className="text-[10px] italic text-slate-500">
                                                No signature
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => startEditRecord(record, planItem, idx)}
                                  className="text-xs text-amber-300 hover:text-amber-200 font-medium px-2 py-1 rounded border border-amber-400/30 hover:bg-amber-400/10 transition"
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDownloadRecordDocx(record._id, record.serialNumber)}
                                disabled={downloadingRecordDocxId === record._id || downloadingRecordPdfId === record._id}
                                className="text-xs text-sky-300 hover:text-sky-200 font-medium px-2 py-1 rounded border border-sky-400/30 hover:bg-sky-400/10 disabled:opacity-50 transition"
                              >
                                {downloadingRecordDocxId === record._id ? "…" : "Word"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadRecordPdf(record._id, record.serialNumber)}
                                disabled={downloadingRecordDocxId === record._id || downloadingRecordPdfId === record._id}
                                className="text-xs text-rose-300 hover:text-rose-200 font-medium px-2 py-1 rounded border border-rose-400/30 hover:bg-rose-500/10 disabled:opacity-50 transition"
                              >
                                {downloadingRecordPdfId === record._id ? "…" : "PDF"}
                              </button>
                              {record.attachment?.fileName && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(
                                        `/api/qhse/training/record/${record._id}/download`
                                      );
                                      if (!res.ok) {
                                        let msg = "Failed to download attachment";
                                        try {
                                          const data = await res.json();
                                          msg = data.error || msg;
                                        } catch {
                                          /* ignore */
                                        }
                                        throw new Error(msg);
                                      }
                                      const blob = await res.blob();
                                      const url = globalThis.URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = record.attachment.fileName;
                                      document.body.appendChild(a);
                                      a.click();
                                      globalThis.URL.revokeObjectURL(url);
                                      a.remove();
                                    } catch (err) {
                                      alert(err.message || "Failed to download attachment");
                                    }
                                  }}
                                  className="text-xs text-slate-300 hover:text-slate-200 font-medium px-2 py-1 rounded border border-white/20 hover:bg-white/10 transition"
                                >
                                  📥 {record.attachment.fileName}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">
                            No record yet.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loadingRecords && !recordsError && records.length === 0 && (
              <div className="text-sm text-slate-300 text-center py-8">
                No training records found for {year === "all" ? "all years" : year}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (hideSidebar) {
    return content;
  }

  return content;
}
