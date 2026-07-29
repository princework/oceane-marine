"use client";

import { useQhseLoading } from "@/app/qhse/QhseLoadingContext";
import { useQhseRole } from "@/hooks/useQhseRole";

import { useQhseSidebar } from "../../../QhseSidebarContext";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import QhseSidebar from "../../../components/QhseSidebar";
import { TemplateDownloadLink } from "../../../components/TemplateDownloadLink";

const CONDITION_OPTIONS = ["Not Assessed", "Good", "Average", "Poor"];

// Template based on the shared STS Equipment Base Stock Level form
const EQUIPMENT_TEMPLATE = [
  {
    categoryName: "FENDERS",
    items: [
      { name: "3.3mx6.5m" },
      { name: "4.5mx9.0m" },
      { name: "1.5x3.0m" },
      { name: "1.0mx2.0m" },
      { name: "1.2mx1.2m" },
    ],
  },
  {
    categoryName: "HOSES",
    subCategory: "CARGO",
    items: [{ name: '12"x9m' }, { name: '10"x12m' }, { name: '8"x10m' }],
  },
  {
    categoryName: "HOSES",
    subCategory: "VAPOUR",
    items: [{ name: '8"x12m' }],
  },
  {
    categoryName: "Ropes",
    items: [
      { name: "55mx48mm" },
      { name: "65mx64mm head rope" },
      { name: "8mx64mm stretchers" },
      { name: "Wire - 65mx28mm" },
      { name: "Whole Polyprop 65mm" },
      { name: "Whole Polyprop 45mm" },
      { name: "65mx45mm head rope" },
      { name: "Natural fibre suspension lines 15mx22mm" },
      { name: "Whole natural fibre 22mm" },
      { name: "80mm tipto mooring rope" },
      { name: "70mx80mm mooring rope" },
      { name: "10mx80mm stretchers" },
      { name: "75mx32mm wire" },
      { name: "220mx64mm" },
    ],
  },
  {
    categoryName: "Gaskets",
    items: [{ name: '12"' }, { name: '10"' }, { name: '8"' }],
  },
  {
    categoryName: "Nuts and Bolts",
    items: [
      { name: "M24 stainless steel nuts" },
      { name: "M20 stainless steel nuts" },
      { name: "M24 Bolts" },
      { name: "M20 Bolts" },
    ],
  },
  {
    categoryName: "Split Pins",
    items: [{ name: "8x80" }, { name: "6x80" }],
  },
  {
    categoryName: "PPE",
    items: [
      { name: "Working Gloves" },
      { name: "Hard Hats" },
      { name: "Lifejacket" },
      { name: "Cold weather jacket" },
      { name: "Mooring master bag" },
    ],
  },
  {
    categoryName: "Shackles",
    items: [
      { name: "25T (with nut and bolt)" },
      { name: "17T (with nut and bolt)" },
      { name: "17T with nut" },
      { name: "8.5T (with nut and bolt)" },
      { name: "6.5T (with nut and bolt)" },
      { name: "4.75T (with nut and bolt)" },
      { name: "3.75T (with nut and bolt)" },
      { name: "Other (please specify)" },
    ],
  },
  {
    categoryName: "Swivels",
    items: [{ name: "Large" }, { name: "Swivel 5.7" }, { name: "Swivel 38" }],
  },
  {
    categoryName: "Lifting Strops",
    items: [{ name: "10T" }, { name: "4Tx4m" }, { name: "5Tx3m" }],
  },
  {
    categoryName: "Communication",
    items: [
      { name: "VHF sets" },
      { name: "Spare Batteries" },
      { name: "Chargers" },
    ],
  },
  {
    categoryName: "Equipment",
    items: [{ name: "Adaptors" }],
  },
  {
    categoryName: "Other",
    items: [
      { name: "Equipment cage" },
      { name: 'Portable Chock (5")' },
      { name: 'Portable Chock (2")' },
      { name: "Billy Pugh transfer Basket" },
      { name: "Skid - 9m" },
      { name: "Skid - 11m" },
      { name: "Combined Thimble and Master link (Spare)" },
      { name: "Laminated copy of test certificates" },
    ],
  },
  {
    categoryName: "Reducers",
    subCategory: "CARGO",
    items: [{ name: '16" to 10"' }, { name: '12" to 10"' }],
  },
  {
    categoryName: "Reducers",
    subCategory: "Vapour",
    items: [
      { name: '16" to 8"' },
      { name: '12" to 8"' },
      { name: '10" to 8"' },
    ],
  },
];

function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i < currentYear; i++) years.push(i);
  for (let i = currentYear; i <= currentYear + 5; i++) years.push(i);
  return years;
}

function createInitialCategories() {
  return EQUIPMENT_TEMPLATE.map((cat) => ({
    categoryName: cat.categoryName,
    subCategory: cat.subCategory || "",
    items: cat.items.map((item) => ({
      name: item.name,
      quantityInUse: "",
      quantitySpare: "",
      additionalComments: "",
      overallCondition: "Not Assessed",
    })),
  }));
}

export default function EquipmentBaseStockFormPage() {
  const { setPageLoading } = useQhseLoading();
  const { contentClassName } = useQhseSidebar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit");
  const { canCreate, canEdit, canDelete, canApprove, canDownload, isQhseAdmin } = useQhseRole();
  const canSubmit = editId ? canEdit : canCreate;

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [revisionDate, setRevisionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [equipmentCategories, setEquipmentCategories] = useState(
    createInitialCategories
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState(editId ? "edit" : "create");

  // Load existing draft if editing (from list)
  useEffect(() => {
    if (!editId) return;

    const fetchRecord = async () => {
      setLoading(true);
      setPageLoading(true);
      setError("");
      try {
        const res = await fetch(
          "/api/qhse/form-checklist/equipment-base-stock-level/list"
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load existing form");
        }
        const record = (data.data || []).find((r) => String(r._id) === String(editId));
        if (!record) {
          setError("Form not found");
          return;
        }

        setMode("edit");
        if (record.year != null) {
          setYear(Number(record.year));
        } else if (record.serialNumber && /^\d{4}-/.test(record.serialNumber)) {
          const y = Number(record.serialNumber.split("-")[0]);
          if (!Number.isNaN(y)) setYear(y);
        }
        if (record.revisionDate) {
          setRevisionDate(
            new Date(record.revisionDate).toISOString().split("T")[0]
          );
        }
        if (Array.isArray(record.equipmentCategories)) {
          setEquipmentCategories(record.equipmentCategories);
        }
      } catch (err) {
        setError(err.message || "Failed to load existing form");
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    };

    fetchRecord();
  }, [editId]);

  // Scroll to top for feedback
  useEffect(() => {
    if (error || success) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [error, success]);

  const handleItemChange = (catIndex, itemIndex, field, value) => {
    setEquipmentCategories((prev) =>
      prev.map((cat, cIdx) => {
        if (cIdx !== catIndex) return cat;
        return {
          ...cat,
          items: cat.items.map((item, iIdx) => {
            if (iIdx !== itemIndex) return item;
            let newValue = value;
            if (field === "quantityInUse" || field === "quantitySpare") {
              newValue = value === "" ? "" : Number.parseInt(value, 10) || 0;
            }
            return {
              ...item,
              [field]: newValue,
            };
          }),
        };
      })
    );
  };

  const handleSubmit = async (status) => {
    if (!canSubmit) return;
    setError("");
    setSuccess("");

    if (mode === "edit" && !revisionDate) {
      setError("Please select revision date");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        year: year || currentYear,
        revisionDate: mode === "edit" ? revisionDate : new Date().toISOString().split("T")[0],
        equipmentCategories,
        status,
      };

      let url = "/api/qhse/form-checklist/equipment-base-stock-level/create";
      let method = "POST";

      // When editing an existing draft, use update; allow status change to PENDING
      if (mode === "edit" && editId) {
        url = `/api/qhse/form-checklist/equipment-base-stock-level/${editId}/update`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(
          data.error ||
            data.message ||
            "Failed to save equipment base stock form"
        );
      }

      const code = data?.data?.formCode || "QAF-OFD-013";
      const serial = data?.data?.serialNumber;
      setSuccess(
        status === "DRAFT"
          ? (serial ? `Draft saved. Form code: ${code} • Serial: ${serial}` : "Form saved as draft successfully.")
          : (serial ? `Form submitted. Form code: ${code} • Serial: ${serial}` : "Form submitted for review successfully.")
      );

      if (status !== "DRAFT") {
        // On submit, navigate back to list after short delay
        setTimeout(() => {
          router.push("/qhse/forms-checklist/equipment-base-stock-level/list");
        }, 1500);
      }
    } catch (err) {
      setError(err.message || "Failed to save form");
    } finally {
      setSubmitting(false);
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
              QHSE / Forms & Checklist / STS Equipment Base Stock Level
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              STS Equipment Base Stock Level –{" "}
              {mode === "edit" ? "Edit Draft" : "New Form"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Form code: <span className="font-mono font-semibold text-sky-300">QAF-OFD-013</span>
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:self-auto sm:flex-shrink-0">
            <TemplateDownloadLink formCode="QAF-OFD-013" />
            <div className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <Link
                href="/qhse/forms-checklist/equipment-base-stock-level/form"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition"
              >
                Base Stock Form
              </Link>
              <Link
                href="/qhse/forms-checklist/equipment-base-stock-level/list"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
              >
                Base Stock List
              </Link>
              {isQhseAdmin && (
                <Link
                  href="/qhse/forms-checklist/equipment-base-stock-level/admin"
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white/90 hover:bg-white/10 transition"
                >
                  Base Stock Admin
                </Link>
              )}
            </div>
          </div>
        </header>

        {!canSubmit && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-amber-100 text-sm">
            You do not have permission to {editId ? "edit" : "create"} records. Form is view-only.
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Year</span>
              <select
                id="form-year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="theme-select rounded-full px-3 py-1.5 text-xs tracking-widest uppercase bg-slate-800 border border-white/20 text-white focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 outline-none cursor-pointer"
                aria-label="Form year"
              >
                {getYears().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Feedback */}
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

          {/* Revision date and status – only when editing (rev no/date updated on edit) */}
          {mode === "edit" && (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1">
                <label
                  htmlFor="revisionDate"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Revision Date <span className="text-red-400">*</span>
                </label>
                <input
                  id="revisionDate"
                  type="date"
                  value={revisionDate}
                  onChange={(e) => setRevisionDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="text-xs text-white/60 space-y-1">
                <p>
                  <span className="font-semibold text-white/80">
                    Status meanings:
                  </span>{" "}
                  <span className="text-white/70">
                    Draft – still editable by you. Submitted – locked and sent to
                    admin for approval.
                  </span>
                </p>
              </div>
              </div>
            </section>
          )}

          {/* Equipment table */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-lg font-semibold text-white/90">
              Equipment Details
            </h2>
            <p className="text-xs text-white/50">
              Fill quantities and condition for each relevant line item. Leave
              unused rows blank.
            </p>
            </div>

            <div className="qhse-table-scroll min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] rounded-xl border border-white/10 bg-slate-950/20">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-amber-200/80 text-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold w-1/3">
                    Equipment
                  </th>
                  <th className="px-4 py-3 text-center font-semibold w-1/6">
                    Quantity in Use
                  </th>
                  <th className="px-4 py-3 text-center font-semibold w-1/6">
                    Quantity Spare
                  </th>
                  <th className="px-4 py-3 text-left font-semibold w-1/4">
                    Additional Comments
                  </th>
                  <th className="px-4 py-3 text-left font-semibold w-1/6">
                    Overall Condition
                  </th>
                </tr>
              </thead>
              <tbody>
                {equipmentCategories.map((category, catIndex) => {
                  const categoryKey = `${category.categoryName}-${catIndex}`;
                  return (
                    <React.Fragment key={categoryKey}>
                      {/* Category row */}
                      <tr className="bg-amber-100/60 text-slate-900 font-semibold">
                        <td className="px-4 py-2" colSpan={5}>
                          <div className="flex items-center justify-between">
                            <span className="uppercase tracking-wide text-[11px]">
                              {category.categoryName}
                              {category.subCategory
                                ? ` – ${category.subCategory}`
                                : ""}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {/* Items */}
                      {category.items.map((item, itemIndex) => (
                        <tr
                          key={`${category.categoryName}-${item.name}-${itemIndex}`}
                          className="border-t border-white/5 hover:bg-white/5 transition"
                        >
                          <td className="px-4 py-2 text-white/90">
                            {item.name}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={
                                item.quantityInUse === ""
                                  ? ""
                                  : Number(item.quantityInUse)
                              }
                              onChange={(e) =>
                                handleItemChange(
                                  catIndex,
                                  itemIndex,
                                  "quantityInUse",
                                  e.target.value
                                )
                              }
                              onWheel={(e) => e.target.blur()}
                              className="w-full max-w-[80px] mx-auto px-2 py-1.5 rounded-md bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={
                                item.quantitySpare === ""
                                  ? ""
                                  : Number(item.quantitySpare)
                              }
                              onChange={(e) =>
                                handleItemChange(
                                  catIndex,
                                  itemIndex,
                                  "quantitySpare",
                                  e.target.value
                                )
                              }
                              onWheel={(e) => e.target.blur()}
                              className="w-full max-w-[80px] mx-auto px-2 py-1.5 rounded-md bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={item.additionalComments || ""}
                              onChange={(e) =>
                                handleItemChange(
                                  catIndex,
                                  itemIndex,
                                  "additionalComments",
                                  e.target.value
                                )
                              }
                              placeholder="Notes, damage, planned replacement..."
                              className="w-full px-2 py-1.5 rounded-md bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-white/40"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={item.overallCondition || "Not Assessed"}
                              onChange={(e) =>
                                handleItemChange(
                                  catIndex,
                                  itemIndex,
                                  "overallCondition",
                                  e.target.value
                                )
                              }
                              className="theme-select w-[140px] min-w-[100px] max-w-none px-4 py-2 rounded-md text-white text-sm leading-tight focus:outline-none focus:ring-1 focus:ring-sky-500"
                            >
                              {CONDITION_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </section>

          {/* Actions — smaller padding/text on small screens; bottom space for notification FAB */}
          <div className="flex flex-wrap items-center justify-center gap-2 pb-20 pt-2 sm:justify-end sm:gap-3 sm:pb-2">
          <Link
            href="/qhse/forms-checklist/equipment-base-stock-level/list"
            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10 transition sm:rounded-full sm:px-6 sm:py-3 sm:text-sm"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => handleSubmit("DRAFT")}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300/70 bg-slate-100/10 px-3 py-1.5 text-center text-[11px] font-semibold leading-snug text-slate-50 hover:bg-slate-100/20 transition disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-full sm:px-6 sm:py-3 sm:text-sm sm:leading-normal"
          >
            {submitting && mode === "edit" ? "Saving..." : "Save as Draft"}
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => handleSubmit("PENDING")}
            className="inline-flex items-center justify-center rounded-lg bg-amber-400 px-3 py-1.5 text-center text-[11px] font-semibold leading-snug text-slate-900 hover:bg-amber-300 transition disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-full sm:px-6 sm:py-3 sm:text-sm sm:leading-normal"
          >
            {submitting ? "Submitting..." : "Submit for Review"}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
