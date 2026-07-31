"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";
import { useSearchParams, useRouter } from "next/navigation";
import QhseSidebar from "../../../components/QhseSidebar";

const RATING_VALUES = [1, 2, 3, 4];

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

function calculatePercentage(values) {
  const numeric = values.filter((v) => typeof v === "number");
  if (!numeric.length) return 0;
  const total = numeric.reduce((sum, v) => sum + v, 0);
  const max = numeric.length * 4;
  return Math.round((total / max) * 100);
}

function RatingScale({ label, value, onChange }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 min-h-[2.5rem]">
      <p className="text-sm text-white/90 min-w-0 leading-tight">{label}</p>
      <div className="flex gap-2 flex-shrink-0 items-center">
        {RATING_VALUES.map((rating) => {
          const active = value === rating;
          return (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating)}
              className={`h-8 w-8 min-w-[2rem] rounded-full text-xs font-semibold flex items-center justify-center border transition flex-shrink-0
                ${
                  active
                    ? "bg-sky-500 text-white border-sky-300 shadow-[0_0_0_1px_rgba(56,189,248,0.6)]"
                    : "bg-slate-800/60 text-slate-200 border-slate-500/60 hover:bg-slate-700"
                }`}
            >
              {rating}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VendorSupplyFormContent() {
  const { contentClassName } = useQhseSidebar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit");
  const vendorId = searchParams?.get("vendorId");
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = editId ? canEdit : canCreate;

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const [form, setForm] = useState({
    vendorName: "",
    vendorAddress: "",
    date: "",
    requestedBy: "",
    forAccountsSign: "",
    supplyOfParts: {
      technicalComparison: null,
      commercialComparison: null,
      legalEntityForServiceOrSupply: null,
      agreesToOceaneTerms: null,
      infrastructureAndFacilities: null,
      previousExperienceExpertise: null,
    },
    supplyOfServices: {
      skilledManpowerAvailability: null,
      contractorCertifications: null,
      hseSystemDueDiligence: null,
      insuranceAndWorkPermit: null,
      previousExperienceYears: null,
    },
  });

  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  /** Optional signature images (base64 data URLs) */
  const [requestedBySignatureImage, setRequestedBySignatureImage] = useState(null);
  const [forAccountsSignSignatureImage, setForAccountsSignSignatureImage] = useState(null);

  // Scroll to top when a new error or success message appears
  useEffect(() => {
    if (error || success) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [error, success]);

  // Prefill vendor name from the master record when opened from the Vendor Onboarding dashboard
  useEffect(() => {
    if (!vendorId || editId) return;
    const loadVendor = async () => {
      try {
        const res = await fetch("/api/master/vendors/list");
        const data = await res.json();
        const vendor = (data.vendors || []).find((v) => String(v._id) === String(vendorId));
        if (vendor) {
          setForm((prev) => ({ ...prev, vendorName: vendor.name }));
        }
      } catch {
        // non-fatal — vendor name stays blank, user can type it
      }
    };
    loadVendor();
  }, [vendorId, editId]);

  // Load existing draft when editing
  useEffect(() => {
    const id = editId;
    if (!id) {
      setCurrentId(null);
      return;
    }

    const fetchDraft = async () => {
      setLoading(true);
      setPageLoading(true);
      setError("");
      setSuccess("");

      try {
        const res = await fetch(
          "/api/qhse/form-checklist/vendor-supply-form/list"
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load forms");
        }
        const record = (data.data || []).find((f) => String(f._id) === String(id));
        if (!record) {
          throw new Error("Draft not found");
        }
        if (record.status !== "DRAFT") {
          throw new Error("Only draft forms can be edited");
        }

        setCurrentId(record._id);
        if (record.year) {
          setYear(record.year);
        }
        setRequestedBySignatureImage(record.requestedBySignatureImage || null);
        setForAccountsSignSignatureImage(
          record.forAccountsSignSignatureImage || null
        );
        setForm({
          vendorName: record.vendorName || "",
          vendorAddress: record.vendorAddress || "",
          date: record.date
            ? new Date(record.date).toISOString().split("T")[0]
            : "",
          requestedBy: record.requestedBy || "",
          forAccountsSign: record.forAccountsSign || "",
          supplyOfParts: {
            technicalComparison:
              record.supplyOfParts?.technicalComparison ?? null,
            commercialComparison:
              record.supplyOfParts?.commercialComparison ?? null,
            legalEntityForServiceOrSupply:
              record.supplyOfParts?.legalEntityForServiceOrSupply ?? null,
            agreesToOceaneTerms:
              record.supplyOfParts?.agreesToOceaneTerms ?? null,
            infrastructureAndFacilities:
              record.supplyOfParts?.infrastructureAndFacilities ?? null,
            previousExperienceExpertise:
              record.supplyOfParts?.previousExperienceExpertise ?? null,
          },
          supplyOfServices: {
            skilledManpowerAvailability:
              record.supplyOfServices?.skilledManpowerAvailability ?? null,
            contractorCertifications:
              record.supplyOfServices?.contractorCertifications ?? null,
            hseSystemDueDiligence:
              record.supplyOfServices?.hseSystemDueDiligence ?? null,
            insuranceAndWorkPermit:
              record.supplyOfServices?.insuranceAndWorkPermit ?? null,
            previousExperienceYears:
              record.supplyOfServices?.previousExperienceYears ?? null,
          },
        });
      } catch (err) {
        setError(err.message || "Failed to load draft form");
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    };

    fetchDraft();
  }, [editId]);

  const partsPercentage = useMemo(
    () =>
      calculatePercentage(Object.values(form.supplyOfParts).filter((v) => v)),
    [form.supplyOfParts]
  );

  const servicesPercentage = useMemo(
    () =>
      calculatePercentage(
        Object.values(form.supplyOfServices).filter((v) => v)
      ),
    [form.supplyOfServices]
  );

  const overallPercentage = useMemo(() => {
    if (!partsPercentage && !servicesPercentage) return 0;
    return Math.round((partsPercentage + servicesPercentage) / 2);
  }, [partsPercentage, servicesPercentage]);

  const handleBasicChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePartsRatingChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      supplyOfParts: {
        ...prev.supplyOfParts,
        [key]: value,
      },
    }));
  };

  const handleServicesRatingChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      supplyOfServices: {
        ...prev.supplyOfServices,
        [key]: value,
      },
    }));
  };

  const validateForm = () => {
    if (!editId && !vendorId) {
      return "No vendor selected. Open this form from the Vendor Onboarding dashboard so it knows which vendor this rating is for.";
    }
    if (!form.vendorName.trim()) {
      return "Please enter vendor name";
    }
    if (!form.vendorAddress.trim()) {
      return "Please enter vendor address";
    }
    if (!form.date) {
      return "Please select a date";
    }
    if (!year) {
      return "Please select a year";
    }
    if (!form.requestedBy.trim()) {
      return "Please enter requested by (sign)";
    }
    if (!form.forAccountsSign.trim()) {
      return "Please enter for accounts (sign)";
    }

    const partsValues = Object.values(form.supplyOfParts);
    if (partsValues.some((v) => typeof v !== "number")) {
      return "Please provide ratings for all Supply of Parts questions";
    }

    const servicesValues = Object.values(form.supplyOfServices);
    if (servicesValues.some((v) => typeof v !== "number")) {
      return "Please provide ratings for all Supply of Services questions";
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setSuccess("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const endpoint = currentId
        ? `/api/qhse/form-checklist/vendor-supply-form/${currentId}/update`
        : "/api/qhse/form-checklist/vendor-supply-form/create";

      const res = await fetch(endpoint, {
        method: currentId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendorId,
          vendorName: form.vendorName.trim(),
          vendorAddress: form.vendorAddress.trim(),
          date: form.date,
          year: year,
          requestedBy: form.requestedBy.trim(),
          forAccountsSign: form.forAccountsSign.trim(),
          ...(requestedBySignatureImage && { requestedBySignatureImage }),
          ...(forAccountsSignSignatureImage && { forAccountsSignSignatureImage }),
          supplyOfParts: form.supplyOfParts,
          supplyOfServices: form.supplyOfServices,
          status: "UNDER_REVIEW",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit form");
      }

      const code = data?.data?.formCode || data?.data?.formNo || "QAF-OFD-037";
      const serial = data?.data?.serialNumber;
      setSuccess(
        serial
          ? `Form submitted. Form code: ${code} • Serial: ${serial}`
          : "Vendor / Supplier / Contractor approval form submitted."
      );

      // After final submit, redirect to list and clear edit mode
      setTimeout(() => {
        router.push("/qhse/forms-checklist/vendor-supply/list");
      }, 1000);
    } catch (err) {
      setError(err.message || "Failed to submit form");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setSuccess("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingDraft(true);

    try {
      const endpoint = currentId
        ? `/api/qhse/form-checklist/vendor-supply-form/${currentId}/update`
        : "/api/qhse/form-checklist/vendor-supply-form/create";

      const res = await fetch(endpoint, {
        method: currentId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendorId,
          vendorName: form.vendorName.trim(),
          vendorAddress: form.vendorAddress.trim(),
          date: form.date,
          year: year,
          requestedBy: form.requestedBy.trim(),
          forAccountsSign: form.forAccountsSign.trim(),
          ...(requestedBySignatureImage && { requestedBySignatureImage }),
          ...(forAccountsSignSignatureImage && { forAccountsSignSignatureImage }),
          supplyOfParts: form.supplyOfParts,
          supplyOfServices: form.supplyOfServices,
          status: "DRAFT",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save draft");
      }

      const code = data?.data?.formCode || data?.data?.formNo || "QAF-OFD-037";
      const serial = data?.data?.serialNumber;
      setSuccess(
        serial
          ? `Draft saved. Form code: ${code} • Serial: ${serial}`
          : "Draft saved successfully."
      );
      // For new draft, remember its id for future edits if API returns it
      if (!currentId && data.data?._id) {
        setCurrentId(data.data._id);
      }
    } catch (err) {
      setError(err.message || "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  if (loading) return null;

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
                Vendor / Supplier / Contractor Approval
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 mt-1">
                Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-037</span>
              </p>
            </div>
            <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
              <TemplateDownloadLink formCode="QAF-OFD-037" />
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-200">
                  Year
                </span>
                <select
                  className="theme-select rounded-full px-3 py-1 text-xs tracking-widest uppercase"
                  value={year || ""}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {getYears().map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                <Link
                  href="/qhse/forms-checklist/vendor-supply/form"
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
                >
                  Vendor Form
                </Link>
                <Link
                  href="/qhse/forms-checklist/vendor-supply/list"
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
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

          {/* Alerts */}
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

          {/* Rating Legend */}
          <div className="rounded-xl border border-white/10 px-4 py-3 text-xs text-slate-200 flex flex-wrap items-center gap-x-6 gap-y-1" style={{ backgroundColor: '#153d59' }}>
            <span className="font-semibold text-white/90">
              Rating Scale (1–4):
            </span>
            <span>1 = Not Satisfied</span>
            <span>2 = Need Improvement</span>
            <span>3 = Acceptable</span>
            <span>4 = Satisfied</span>
          </div>

          {!canSubmit && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm">
              You do not have permission to {editId ? "edit" : "create"} records. Form is view-only.
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Info */}
            <section className="rounded-2xl border border-white/10 p-6 space-y-6" style={{ backgroundColor: '#153d59' }}>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="h-7 w-7 rounded-full bg-sky-500/20 border border-sky-400/60 flex items-center justify-center text-xs text-sky-300">
                  1
                </span>
                Basic Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
                <div className="space-y-2 md:col-span-2 flex flex-col">
                  <label
                    htmlFor="vendorName"
                    className="block text-xs font-medium text-white/70 leading-tight"
                  >
                    Vendor Name
                  </label>
                  <input
                    id="vendorName"
                    type="text"
                    name="vendorName"
                    value={form.vendorName}
                    onChange={handleBasicChange}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-sky-500/60 h-[42px]"
                    placeholder="Enter vendor / supplier / contractor name"
                  />
                </div>
                <div className="space-y-2 flex flex-col">
                  <label
                    htmlFor="vendorDate"
                    className="block text-xs font-medium text-white/70 leading-tight"
                  >
                    Date
                  </label>
                  <input
                    type="date"
                    id="vendorDate"
                    name="date"
                    value={form.date}
                    onChange={handleBasicChange}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/60 [&::-webkit-calendar-picker-indicator]:opacity-70 h-[42px]"
                  />
                </div>
                <div className="space-y-2 md:col-span-3 flex flex-col">
                  <label
                    htmlFor="vendorAddress"
                    className="block text-xs font-medium text-white/70"
                  >
                    Vendor Address
                  </label>
                  <textarea
                    id="vendorAddress"
                    name="vendorAddress"
                    value={form.vendorAddress}
                    onChange={handleBasicChange}
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-sky-500/60 resize-y"
                    placeholder="Enter full address of vendor"
                  />
                </div>
              </div>
            </section>

            {/* Ratings */}
            <section className="rounded-2xl border border-white/10 p-6 space-y-6" style={{ backgroundColor: '#153d59' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                {/* Supply of Parts */}
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">
                    For Supply of Parts
                  </h2>
                  <p className="text-[11px] text-slate-300 mb-4">
                    Rate each criterion from 1 to 4 based on the vendor&apos;s
                    capability for supply of parts.
                  </p>
                  <div className="divide-y divide-white/10">
                    <RatingScale
                      label="Vendor evaluation in technical comparison"
                      value={form.supplyOfParts.technicalComparison}
                      onChange={(v) =>
                        handlePartsRatingChange("technicalComparison", v)
                      }
                    />
                    <RatingScale
                      label="Vendor evaluation in commercial comparison"
                      value={form.supplyOfParts.commercialComparison}
                      onChange={(v) =>
                        handlePartsRatingChange("commercialComparison", v)
                      }
                    />
                    <RatingScale
                      label="Does the vendor have a legal entity for provision of service or supplies intended"
                      value={form.supplyOfParts.legalEntityForServiceOrSupply}
                      onChange={(v) =>
                        handlePartsRatingChange(
                          "legalEntityForServiceOrSupply",
                          v
                        )
                      }
                    />
                    <RatingScale
                      label="Does the vendor agree on the Oceane Group terms and conditions"
                      value={form.supplyOfParts.agreesToOceaneTerms}
                      onChange={(v) =>
                        handlePartsRatingChange("agreesToOceaneTerms", v)
                      }
                    />
                    <RatingScale
                      label="Does the vendor have adequate infrastructure / facilities available to execute the scope of work"
                      value={form.supplyOfParts.infrastructureAndFacilities}
                      onChange={(v) =>
                        handlePartsRatingChange(
                          "infrastructureAndFacilities",
                          v
                        )
                      }
                    />
                    <RatingScale
                      label="Does the vendor have previous experience / expertise in the relevant work"
                      value={form.supplyOfParts.previousExperienceExpertise}
                      onChange={(v) =>
                        handlePartsRatingChange(
                          "previousExperienceExpertise",
                          v
                        )
                      }
                    />
                  </div>

                  {/* Parts Percentage */}
                  <div className="mt-4 rounded-xl border border-white/10 px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#153d59' }}>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">
                        % Age Score (Parts)
                      </p>
                      <p className="text-[10px] text-slate-300">
                        Overall % age = sum of maximum available score v/s that
                        achieved * 100
                      </p>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-sky-300">
                      {partsPercentage}%
                    </p>
                  </div>
                </div>

                {/* Supply of Services */}
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">
                    For Supply of Services
                  </h2>
                  <p className="text-[11px] text-slate-300 mb-4">
                    Rate each criterion from 1 to 4 based on the vendor&apos;s
                    capability for supply of services.
                  </p>
                  <div className="divide-y divide-white/10">
                    <RatingScale
                      label="Availability of skilled / competent manpower with the vendor for executing the scope of work"
                      value={form.supplyOfServices.skilledManpowerAvailability}
                      onChange={(v) =>
                        handleServicesRatingChange(
                          "skilledManpowerAvailability",
                          v
                        )
                      }
                    />
                    <RatingScale
                      label="Certification obtained by the contractor (such as ISO-9001, 14001, or other certifications)"
                      value={form.supplyOfServices.contractorCertifications}
                      onChange={(v) =>
                        handleServicesRatingChange(
                          "contractorCertifications",
                          v
                        )
                      }
                    />
                    <RatingScale
                      label="HSE system / Due Diligence / Policies followed by the vendor"
                      value={form.supplyOfServices.hseSystemDueDiligence}
                      onChange={(v) =>
                        handleServicesRatingChange("hseSystemDueDiligence", v)
                      }
                    />
                    <RatingScale
                      label="Vendor has insurance policy and work permit for the men to be deployed for the job"
                      value={form.supplyOfServices.insuranceAndWorkPermit}
                      onChange={(v) =>
                        handleServicesRatingChange("insuranceAndWorkPermit", v)
                      }
                    />
                    <RatingScale
                      label="Previous experience / expertise of the vendor in the relevant work (no. of years in the field)"
                      value={form.supplyOfServices.previousExperienceYears}
                      onChange={(v) =>
                        handleServicesRatingChange("previousExperienceYears", v)
                      }
                    />
                  </div>

                  {/* Services Percentage */}
                  <div className="mt-4 rounded-xl border border-white/10 px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#153d59' }}>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">
                        % Age Score (Services)
                      </p>
                      <p className="text-[10px] text-slate-300">
                        Overall % age = sum of maximum available score v/s that
                        achieved * 100
                      </p>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-sky-300">
                      {servicesPercentage}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Overall Result */}
              <div className="mt-6 rounded-2xl border border-sky-500/40 bg-sky-900/20 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-sky-200">
                    Overall % Age Score
                  </p>
                  <p className="text-[11px] text-slate-200 max-w-xl">
                    Any vendor with a score of{" "}
                    <span className="font-semibold">80%</span> or above can be
                    listed as an approved vendor.
                  </p>
                </div>
                <p
                  className={`text-3xl font-extrabold ${
                    overallPercentage >= 80
                      ? "text-emerald-300"
                      : "text-amber-300"
                  }`}
                >
                  {overallPercentage}%
                </p>
              </div>
            </section>

            {/* Signatures */}
            <section className="rounded-2xl border border-white/10 p-6 space-y-6" style={{ backgroundColor: '#153d59' }}>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="h-7 w-7 rounded-full bg-sky-500/20 border border-sky-400/60 flex items-center justify-center text-xs text-sky-300">
                  2
                </span>
                Signatures
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 flex flex-col">
                  <label
                    htmlFor="requestedBy"
                    className="block text-xs font-medium text-white/70 leading-tight"
                  >
                    Requested By (Sign)
                  </label>
                  <input
                    id="requestedBy"
                    type="text"
                    name="requestedBy"
                    value={form.requestedBy}
                    onChange={handleBasicChange}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-sky-500/60 h-[42px]"
                    placeholder="Name / designation"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/90 hover:bg-white/10 transition">
                      <span>Add image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => setRequestedBySignatureImage(reader.result);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {requestedBySignatureImage && (
                      <span className="flex items-center gap-1 text-xs text-sky-300">
                        <span>Image added</span>
                        <button
                          type="button"
                          onClick={() => setRequestedBySignatureImage(null)}
                          className="text-red-300 hover:underline"
                        >
                          Remove
                        </button>
                      </span>
                    )}
                  </div>
                  {requestedBySignatureImage && (
                    <div className="mt-1 rounded border border-white/10 overflow-hidden max-w-[120px]">
                      <img src={requestedBySignatureImage} alt="Requested by signature" className="w-full h-auto object-contain max-h-20" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 flex flex-col">
                  <label
                    htmlFor="forAccountsSign"
                    className="block text-xs font-medium text-white/70 leading-tight"
                  >
                    For Account (Sign)
                  </label>
                  <input
                    type="text"
                    id="forAccountsSign"
                    name="forAccountsSign"
                    value={form.forAccountsSign}
                    onChange={handleBasicChange}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-sky-500/60 h-[42px]"
                    placeholder="Name / designation"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/90 hover:bg-white/10 transition">
                      <span>Add image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => setForAccountsSignSignatureImage(reader.result);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {forAccountsSignSignatureImage && (
                      <span className="flex items-center gap-1 text-xs text-sky-300">
                        <span>Image added</span>
                        <button
                          type="button"
                          onClick={() => setForAccountsSignSignatureImage(null)}
                          className="text-red-300 hover:underline"
                        >
                          Remove
                        </button>
                      </span>
                    )}
                  </div>
                  {forAccountsSignSignatureImage && (
                    <div className="mt-1 rounded border border-white/10 overflow-hidden max-w-[120px]">
                      <img src={forAccountsSignSignatureImage} alt="For accounts signature" className="w-full h-auto object-contain max-h-20" />
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-300 mt-2">
                * Evaluating and approving authority will have to be different
                personnel.
              </p>
            </section>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={!canSubmit || savingDraft || submitting}
                className="rounded-full border border-white/30 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/15 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingDraft ? "Saving Draft..." : "Save as Draft"}
              </button>
              <button
                type="submit"
                disabled={!canSubmit || submitting || savingDraft}
                className="rounded-full border border-sky-400/60 bg-sky-500/20 px-6 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-500/30 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit for Approval"}
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}

export default function VendorSupplyFormPage() {
  const { setPageLoading } = useQhseLoading();
  return <VendorSupplyFormContent />;
}
