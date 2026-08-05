"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import OperationsSelectField from "@/app/operations/components/OperationsSelectField";
import {
  ActionViewIcon,
  ActionEditIcon,
  ActionDownloadIcon,
  ActionDeleteIcon,
} from "@/app/components/RecordActionIcons";
import { usePmsRole } from "@/hooks/usePmsRole";

/* =========================
   Reusable Input
========================= */
const Input = ({ label, required, ...props }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-slate-200">
      {label} {required && <span className="text-orange-400">*</span>}
    </label>
    <input
      {...props}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
    />
  </div>
);

/* =========================
   Searchable Dropdown
========================= */
const SearchableDropdown = ({ label, required, options = [], value, onChange, placeholder = "Select or search..." }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-1 relative" ref={ref}>
      <label className="text-xs font-medium text-slate-200">
        {label} {required && <span className="text-orange-400">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-orange-500/50"
      >
        <span className={value ? "text-white" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/15 bg-[#0b2740]/95 backdrop-blur-[2px] shadow-2xl max-h-56 overflow-hidden">
          <div className="p-2 border-b border-white/10">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="ops-select-list-scroll max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-500">No options found</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition ${
                    value === opt ? "bg-orange-500/20 text-orange-300" : "text-white"
                  }`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function formatWarehouseDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Export columns for one Warehouse record, in the order they appear in the detail modal. */
function getWarehouseRecordExportColumns() {
  return [
    { label: "Status", getValue: (r) => (r?.status === "COMPLETED" ? "Completed" : "Not Completed") },
    { label: "Location", getValue: (r) => r?.location ?? "" },
    { label: "Equipment Name", getValue: (r) => r?.equipment ?? "" },
    { label: "Equipment Type", getValue: (r) => r?.equipmentType ?? "" },
    { label: "Specification", getValue: (r) => r?.specification ?? "" },
    { label: "Ownership", getValue: (r) => (r?.ownership === "THIRD_PARTY" ? "Third Party" : r?.ownership === "OWNED" ? "Owned" : r?.ownership ?? "") },
    { label: "NOS", getValue: (r) => (r?.nos != null ? String(r.nos) : "") },
    { label: "Primary Fenders", getValue: (r) => (r?.primaryFenders != null ? String(r.primaryFenders) : "0") },
    { label: "Secondary Fenders", getValue: (r) => (r?.secondaryFenders != null ? String(r.secondaryFenders) : "0") },
    { label: "Hoses", getValue: (r) => (r?.hoses != null ? String(r.hoses) : "0") },
    { label: "Additional Equipments", getValue: (r) => r?.additionalEquipments ?? "" },
    { label: "From Location", getValue: (r) => r?.fromLocation ?? "" },
    { label: "Stopover", getValue: (r) => r?.stopover ?? "" },
    { label: "To Location", getValue: (r) => r?.toLocation ?? "" },
    { label: "Start Date", getValue: (r) => formatWarehouseDate(r?.startDate) },
    { label: "Estimated End Date", getValue: (r) => formatWarehouseDate(r?.estimatedEndDate) },
    { label: "Remarks", getValue: (r) => r?.remarks ?? "" },
  ];
}

function escapeCsvCell(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Download one warehouse record as CSV (opens in Excel). */
function downloadWarehouseRecordExcel(record) {
  if (!record) return;
  const columns = getWarehouseRecordExportColumns();
  const headers = columns.map((c) => c.label);
  const values = columns.map((c) => c.getValue(record));
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLine = values.map(escapeCsvCell).join(",");
  const csv = "\uFEFF" + headerLine + "\r\n" + dataLine + "\r\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const code = (record.equipment || record.location || "warehouse").replace(/[^a-zA-Z0-9_-]/g, "_");
  a.download = `Warehouse_Record_${code}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WarehouseManagement({ view: controlledView, onViewChange }) {
  const { canCreate, canEdit, canDelete, canDownload, isPmsAdmin } = usePmsRole();
  const [internalView, setInternalView] = useState("form");
  const view = controlledView !== undefined ? controlledView : internalView;
  const setView = onViewChange !== undefined ? onViewChange : setInternalView;

  const [selectedLocation, setSelectedLocation] = useState("");
  const [pmsLocations, setPmsLocations] = useState([]);

  const locationSelectOptions = useMemo(
    () =>
      (pmsLocations || [])
        .map((loc) => (typeof loc?.name === "string" ? loc.name.trim() : ""))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ value: name, label: name })),
    [pmsLocations]
  );

  const locationOptionsForSelect = useMemo(() => {
    const opts = [...locationSelectOptions];
    if (selectedLocation && !opts.some((o) => o.value === selectedLocation)) {
      opts.push({ value: selectedLocation, label: selectedLocation });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [locationSelectOptions, selectedLocation]);
  const [records, setRecords] = useState([]);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  /** "" = all years (matches QHSE defects list / API omits year filter) */
  const [filterYear, setFilterYear] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const canSubmit = editingRecord ? canEdit : canCreate;

  // Dropdown options from Primary Equipment & Accessories
  const [equipmentNames, setEquipmentNames] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [specifications, setSpecifications] = useState([]);

  // View modal state
  const [viewRecord, setViewRecord] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const warehouseListPagination = useOperationsClientPagination(
    view === "list" ? records : [],
    view === "list" ? `${filterYear}|${selectedLocation}|${records.length}` : "list-off"
  );
  const {
    paginatedItems: paginatedRecords,
    ...warehouseListPaginationFooterProps
  } = warehouseListPagination;

  const [form, setForm] = useState({
    status: "NOT_COMPLETED",
    equipment: "",
    equipmentType: "",
    specification: "",
    primaryFenders: "",
    secondaryFenders: "",
    hoses: "",
    additionalEquipments: "",
    ownership: "OWNED",
    nos: "",
    startDate: "",
    estimatedEndDate: "",
    fromLocation: "",
    stopover: "",
    toLocation: "",
    remarks: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  /* =========================
     FETCH DROPDOWN OPTIONS
  ========================= */
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [equipRes, accRes] = await Promise.all([
          fetch("/api/pms/equipment-inventory/primary-equipment/list"),
          fetch("/api/pms/equipment-inventory/accessories/list"),
        ]);
        const equipData = await equipRes.json();
        const accData = await accRes.json();

        const primaryEquipments = equipData.equipments || [];
        const accessories = accData.data || [];

        // Build unique sets of names, types, specifications
        const namesSet = new Set();
        const typesSet = new Set();
        const specsSet = new Set();

        primaryEquipments.forEach((eq) => {
          if (eq.equipmentName) namesSet.add(eq.equipmentName);
          if (eq.equipmentType) typesSet.add(eq.equipmentType);
          if (eq.specification) specsSet.add(eq.specification);
        });

        accessories.forEach((acc) => {
          if (acc.equipmentName) namesSet.add(acc.equipmentName);
          if (acc.specification) specsSet.add(acc.specification);
        });

        setEquipmentNames([...namesSet].sort());
        setEquipmentTypes([...typesSet].sort());
        setSpecifications([...specsSet].sort());
      } catch (err) {
        console.error("Failed to load dropdown data:", err);
      }
    };

    fetchDropdownData();
  }, []);

  useEffect(() => {
    const loadPmsLocations = async () => {
      try {
        const res = await fetch("/api/pms/locations/list");
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.locations)) {
          setPmsLocations(data.locations);
        }
      } catch (err) {
        console.error("Failed to load PMS locations:", err);
      }
    };
    loadPmsLocations();
  }, []);

  useEffect(() => {
    if (!selectedLocation && locationSelectOptions.length > 0) {
      setSelectedLocation(locationSelectOptions[0].value);
    }
  }, [locationSelectOptions, selectedLocation]);

  /* =========================
     FETCH LIST
  ========================= */
  const fetchList = async () => {
    const params = new URLSearchParams({ location: selectedLocation });
    if (filterYear) params.set("year", filterYear);
    const res = await fetch(
      `/api/pms/warehouse-management/list?${params.toString()}`
    );
    const data = await res.json();
    setRecords(data.data || []);
  };

  // Reset form when location changes
  useEffect(() => {
    if (view === "form" && !editingRecord) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]);

  useEffect(() => {
    if (view === "list") fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, filterYear, selectedLocation]);

  const resetForm = () => {
    setForm({
      status: "NOT_COMPLETED",
      equipment: "",
      equipmentType: "",
      specification: "",
      primaryFenders: "",
      secondaryFenders: "",
      hoses: "",
      additionalEquipments: "",
      ownership: "OWNED",
      nos: "",
      startDate: "",
      estimatedEndDate: "",
      fromLocation: "",
      stopover: "",
      toLocation: "",
      remarks: "",
    });
    setEditingRecord(null);
    setAttachmentFile(null);
    setSuccess(null);
    setError(null);
  };

  /* =========================
     SUBMIT (CREATE / UPDATE)
  ========================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSuccess(null);

    if (!form.equipment.trim()) {
      setError("Equipment Name is required");
      return;
    }
    if (!form.nos || Number(form.nos) <= 0) {
      setError("Nos must be greater than 0");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("location", selectedLocation);
      formData.append("status", form.status);
      formData.append("equipment", form.equipment);
      formData.append("equipmentType", form.equipmentType);
      formData.append("specification", form.specification);
      formData.append("primaryFenders", form.primaryFenders || "0");
      formData.append("secondaryFenders", form.secondaryFenders || "0");
      formData.append("hoses", form.hoses || "0");
      formData.append("additionalEquipments", form.additionalEquipments || "");
      formData.append("ownership", form.ownership);
      formData.append("nos", form.nos);
      if (form.startDate) formData.append("startDate", form.startDate);
      if (form.estimatedEndDate) formData.append("estimatedEndDate", form.estimatedEndDate);
      if (form.fromLocation) formData.append("fromLocation", form.fromLocation);
      if (form.stopover) formData.append("stopover", form.stopover);
      if (form.toLocation) formData.append("toLocation", form.toLocation);
      if (form.remarks) formData.append("remarks", form.remarks);
      if (attachmentFile) formData.append("attachment", attachmentFile);

      const isEditing = !!editingRecord;
      const url = isEditing
        ? `/api/pms/warehouse-management/${editingRecord}/update`
        : "/api/pms/warehouse-management/create";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, { method, body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || `${isEditing ? "Update" : "Create"} failed`);

      setSuccess(`Record ${isEditing ? "updated" : "saved"} successfully.`);
      resetForm();

      setTimeout(() => {
        setView("list");
        setSuccess(null);
      }, 1200);
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
  };

  const handleDownload = (id, index) => {
    const url = `/api/pms/warehouse-management/${id}/download?fileIndex=${index}`;
    window.open(url, "_blank");
  };

  const handleDelete = async (record) => {
    if (!record?._id || !canDelete) return;
    const label = record.equipment || record.location || "this record";
    if (
      !confirm(
        `Delete warehouse record "${label}"? This will also remove its attachments and cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(record._id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/pms/warehouse-management/${record._id}/delete`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete record");
      }
      setSuccess("Record deleted successfully");
      await fetchList();
      setTimeout(() => setSuccess(null), 1500);
    } catch (err) {
      setError(err.message || "Failed to delete record");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (record) => {
    const formatDate = (date) => {
      if (!date) return "";
      const d = new Date(date);
      return d.toISOString().split("T")[0];
    };

    setEditingRecord(record._id);
    setForm({
      status: record.status || "NOT_COMPLETED",
      equipment: record.equipment || "",
      equipmentType: record.equipmentType || "",
      specification: record.specification || "",
      primaryFenders: record.primaryFenders || "",
      secondaryFenders: record.secondaryFenders || "",
      hoses: record.hoses || "",
      additionalEquipments: record.additionalEquipments || "",
      ownership: record.ownership || "OWNED",
      nos: record.nos || "",
      startDate: formatDate(record.startDate),
      estimatedEndDate: formatDate(record.estimatedEndDate),
      fromLocation: record.fromLocation || "",
      stopover: record.stopover || "",
      toLocation: record.toLocation || "",
      remarks: record.remarks || "",
    });
    setAttachmentFile(null);
    setSuccess(null);
    setError(null);
    if (record.location) setSelectedLocation(record.location);
    setView("form");
  };

  return (
    <div className="space-y-6">
      {/* HEADER — md+: heading + filters one row (filters small); mobile: centered heading, filters next line */}
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0 text-center md:text-left">
          <p className="text-xs tracking-widest text-sky-300">
            PMS / Warehouse Management
          </p>
          <h2 className="text-lg font-bold text-white sm:text-xl">
            Warehouse Management
          </h2>
        </div>
        <div
          className={`flex w-full min-w-0 flex-row flex-nowrap items-center gap-2 md:w-auto md:shrink-0 md:justify-end md:gap-2 ${
            view === "form" ? "justify-center md:justify-end md:max-w-xs" : "justify-center"
          }`}
        >
          {view === "list" && (
            <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-300 md:text-[10px]">
                Year
              </span>
              <OperationsSelectField
                variant="pill"
                ariaLabel="Filter by year"
                value={filterYear}
                onChange={setFilterYear}
                options={[
                  { value: "", label: "All years" },
                  ...Array.from(
                    { length: new Date().getFullYear() + 5 - 2020 + 1 },
                    (_, i) => {
                      const y = 2020 + i;
                      return { value: String(y), label: String(y) };
                    }
                  ),
                ]}
                className="min-w-0 w-36 shrink-0 md:w-44"
                triggerClassName="ops-select-trigger w-full rounded-full px-2.5 py-0.5 text-[10px] tracking-wide uppercase md:px-3 md:py-1 md:text-[11px]"
              />
            </div>
          )}
          {view === "list" && (
            <div className="flex min-w-0 items-center gap-1 md:gap-1.5 max-w-[48%] flex-1 md:max-w-none md:flex-initial">
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-300 md:text-[10px]">
                <span className="md:hidden">Loc</span>
                <span className="hidden md:inline">Location</span>
              </span>
              <OperationsSelectField
                variant="pill"
                ariaLabel="Location"
                value={selectedLocation}
                onChange={setSelectedLocation}
                options={locationOptionsForSelect}
                className="min-w-0 flex-1 md:w-36 md:flex-initial"
                triggerClassName="ops-select-trigger w-full rounded-lg border border-white/10 bg-slate-900/50 py-1 pl-1.5 text-[10px] leading-tight md:rounded-full md:py-1 md:pl-2.5 md:text-[11px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* MESSAGES */}
      {success && (
        <div className="border border-emerald-400/40 bg-emerald-950/40 px-4 py-2 text-emerald-200 text-sm rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="border border-red-400/40 bg-red-950/40 px-4 py-2 text-red-200 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* ========================= FORM ========================= */}
      {view === "form" && (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-[#0b2740]/85 backdrop-blur-[2px] p-6 space-y-6 shadow-2xl max-w-6xl mx-auto"
        >
          {!canSubmit && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
              You do not have permission to {editingRecord ? "edit" : "create"} warehouse records.
            </div>
          )}
          <fieldset
            disabled={!canSubmit}
            className="border-0 p-0 m-0 min-w-0 space-y-6 disabled:opacity-[0.88]"
          >
          {/* STATUS — Top of form */}
          <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/5 border border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-semibold text-slate-200 shrink-0">Status:</span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  form.status === "COMPLETED"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${form.status === "COMPLETED" ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span className="whitespace-nowrap">
                  {form.status === "COMPLETED" ? "Completed" : "Not Completed"}
                </span>
              </span>
            </div>
            <OperationsSelectField
              variant="pill"
              ariaLabel="Record status"
              value={form.status}
              onChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
              options={[
                { value: "NOT_COMPLETED", label: "Not Completed" },
                { value: "COMPLETED", label: "Completed" },
              ]}
              className="w-full sm:w-auto sm:min-w-[11rem]"
              triggerClassName="ops-select-trigger w-full rounded-lg border border-white/10 bg-white/5 pl-4 py-2 text-sm pr-3!"
            />
          </div>

          {/* ROW 1: Location, Equipment Name, Equipment Type, Specification */}
          <div className="grid md:grid-cols-4 gap-4">
            <OperationsSelectField
              label={
                <>
                  Location <span className="text-orange-400">*</span>
                </>
              }
              value={selectedLocation}
              onChange={setSelectedLocation}
              options={locationOptionsForSelect}
              triggerClassName="w-full min-h-[2.75rem] rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />

            <SearchableDropdown
              label="Equipment Name"
              required
              options={equipmentNames}
              value={form.equipment}
              onChange={(val) => setForm((prev) => ({ ...prev, equipment: val }))}
              placeholder="Select equipment..."
            />

            <SearchableDropdown
              label="Equipment Type"
              options={equipmentTypes}
              value={form.equipmentType}
              onChange={(val) =>
                setForm((prev) => ({
                  ...prev,
                  equipmentType: val,
                  // Fender/hose counts are meaningless for e.g. a compressor or crane —
                  // clear them so a stale count from a previous selection never gets submitted.
                  ...(!/fender|hose/i.test(val || "") && {
                    primaryFenders: "",
                    secondaryFenders: "",
                    hoses: "",
                  }),
                }))
              }
              placeholder="Select type..."
            />

            <SearchableDropdown
              label="Specification"
              options={specifications}
              value={form.specification}
              onChange={(val) => setForm((prev) => ({ ...prev, specification: val }))}
              placeholder="Select spec..."
            />
          </div>

          {/* ROW 2: Primary Fenders, Secondary Fenders, Hoses — only relevant for fender/hose-type
              equipment; a compressor, crane, or gauge has no fender/hose count to enter. */}
          {/fender|hose/i.test(form.equipmentType || "") && (
            <div className="grid md:grid-cols-3 gap-4">
              <Input label="Primary Fenders" name="primaryFenders" type="number" value={form.primaryFenders} onChange={handleChange} />
              <Input label="Secondary Fenders" name="secondaryFenders" type="number" value={form.secondaryFenders} onChange={handleChange} />
              <Input label="Hoses" name="hoses" type="number" value={form.hoses} onChange={handleChange} />
            </div>
          )}

          {/* ROW 2b: Additional Equipments — free text for spares / extras not counted above */}
          <div>
            <label className="text-xs font-medium text-slate-200">
              Additional Equipments
            </label>
            <textarea
              name="additionalEquipments"
              rows={2}
              value={form.additionalEquipments}
              onChange={handleChange}
              placeholder="e.g. 2 spare 4-inch hoses, 1 backup primary fender"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
          </div>

          {/* ROW 3: Ownership, Nos */}
          <div className="grid md:grid-cols-2 gap-4">
            <OperationsSelectField
              label={
                <>
                  Ownership <span className="text-orange-400">*</span>
                </>
              }
              value={form.ownership}
              onChange={(v) => setForm((prev) => ({ ...prev, ownership: v }))}
              options={[
                { value: "OWNED", label: "Owned" },
                { value: "THIRD_PARTY", label: "Third Party" },
              ]}
              triggerClassName="w-full min-h-[2.75rem] rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
            <Input label="Nos" required type="number" name="nos" value={form.nos} onChange={handleChange} />
          </div>

          {/* ROW 4: From Location, Stopover, To Location (single row) */}
          <div className="grid md:grid-cols-3 gap-4">
            <Input label="From Location" name="fromLocation" value={form.fromLocation} onChange={handleChange} />
            <Input label="Stopover" name="stopover" value={form.stopover} onChange={handleChange} />
            <Input label="To Location" name="toLocation" value={form.toLocation} onChange={handleChange} />
          </div>

          {/* ROW 5: Start Date, Estimated End Date (single row) */}
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Start Date" type="date" name="startDate" value={form.startDate} onChange={handleChange} />
            <Input label="Estimated End Date" type="date" name="estimatedEndDate" value={form.estimatedEndDate} onChange={handleChange} />
          </div>

          {/* Remarks */}
          <div>
            <label className="text-xs font-medium text-slate-200">Remarks</label>
            <textarea
              name="remarks"
              rows={3}
              value={form.remarks}
              onChange={handleChange}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
          </div>

          {/* Attachment + Save */}
          <div className="grid md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-slate-200 block mb-1">
                Attachment (optional)
              </label>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  setAttachmentFile(file || null);
                }}
                className="block w-full text-xs text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-orange-600 cursor-pointer"
              />
              {attachmentFile && (
                <p className="mt-1 text-[11px] text-slate-200">
                  Selected: {attachmentFile.name}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              {editingRecord && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2 rounded-lg border border-white/20 text-white text-sm font-semibold hover:bg-white/10 transition"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-6 py-2 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingRecord ? "Update" : "Save"}
              </button>
            </div>
          </div>
          </fieldset>
        </form>
      )}

      {/* ========================= LIST ========================= */}
      {view === "list" && (
        <div className="rounded-3xl border border-white/10 bg-[#0b2740]/75 backdrop-blur-[2px] p-4 sm:p-6 shadow-2xl">
          <div className="overflow-x-auto styled-scrollbar">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="text-slate-300 border-b border-white/10">
                <tr>
                  <th className="text-left px-3 py-2">Equipment</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Specification</th>
                  <th className="text-center px-3 py-2">Nos</th>
                  <th className="text-left px-3 py-2">From</th>
                  <th className="text-left px-3 py-2">Stopover</th>
                  <th className="text-left px-3 py-2">To</th>
                  <th className="text-center px-3 py-2">Status</th>
                  <th className="text-center px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center px-4 py-6 text-slate-400">
                      No records found for {selectedLocation || "this location"}
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r) => (
                    <tr
                      key={r._id}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="px-3 py-2 text-white font-medium">{r.equipment}</td>
                      <td className="px-3 py-2 text-slate-300">{r.equipmentType || "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{r.specification || "—"}</td>
                      <td className="text-center px-3 py-2 text-slate-300">{r.nos}</td>
                      <td className="px-3 py-2 text-slate-300">{r.fromLocation || "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{r.stopover || "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{r.toLocation || "—"}</td>
                      <td className="text-center px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                            r.status === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              r.status === "COMPLETED" ? "bg-emerald-400" : "bg-amber-400"
                            }`}
                          />
                          {r.status === "COMPLETED" ? "Completed" : "Pending"}
                        </span>
                      </td>
                      <td className="text-center px-3 py-2">
                        <div className="inline-flex items-center gap-2">
                          <ActionViewIcon onClick={() => setViewRecord(r)} title="View record" />
                          {canEdit && <ActionEditIcon onClick={() => handleEdit(r)} title="Edit record" />}
                          {canDownload && (
                            <ActionDownloadIcon
                              onClick={() => downloadWarehouseRecordExcel(r)}
                              title="Download as Excel"
                            />
                          )}
                          {canDownload && r.attachments && r.attachments.length > 0 && (
                            <ActionDownloadIcon
                              onClick={() => handleDownload(r._id, 0)}
                              title="Download attachment"
                            />
                          )}
                          {canDelete && (
                            <ActionDeleteIcon
                              onClick={() => handleDelete(r)}
                              disabled={deletingId === r._id}
                              loading={deletingId === r._id}
                              title="Delete record"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <OperationsListPaginationFooter
            {...warehouseListPaginationFooterProps}
            className="overflow-visible"
          />
        </div>
      )}

      {/* ========================= VIEW MODAL ========================= */}
      {viewRecord &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setViewRecord(null);
            }}
          >
            <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 rounded-2xl border border-white/20 shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-slate-800 border-b border-white/10 px-6 py-5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 shadow-lg shadow-sky-500/30">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Warehouse Record Details</h3>
                    <p className="text-xs text-slate-300 mt-0.5">View complete record information</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewRecord(null)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 styled-scrollbar">
                {/* Status Banner */}
                <div
                  className={`p-3 rounded-xl border text-center text-sm font-bold ${
                    viewRecord.status === "COMPLETED"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  }`}
                >
                  {viewRecord.status === "COMPLETED" ? "✅ Completed" : "⏳ Not Completed"}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: "Location", value: viewRecord.location || "—", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" },
                    { label: "Equipment Name", value: viewRecord.equipment, icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
                    { label: "Equipment Type", value: viewRecord.equipmentType, icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" },
                    { label: "Specification", value: viewRecord.specification, icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
                    { label: "Ownership", value: viewRecord.ownership === "THIRD_PARTY" ? "Third Party" : "Owned", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                    { label: "Nos", value: viewRecord.nos, icon: "M7 20l4-16m2 16l4-16M6 9h14M4 15h14" },
                  ].map((item) => (
                    <div key={item.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                        </svg>
                        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{item.label}</p>
                      </div>
                      <p className="text-base font-semibold text-white">{item.value || "—"}</p>
                    </div>
                  ))}
                </div>

                {/* Inventory */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Primary Fenders", value: viewRecord.primaryFenders },
                    { label: "Secondary Fenders", value: viewRecord.secondaryFenders },
                    { label: "Hoses", value: viewRecord.hoses },
                  ].map((item) => (
                    <div key={item.label} className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-slate-400 font-semibold mb-1">{item.label}</p>
                      <p className="text-lg font-bold text-white">{item.value || 0}</p>
                    </div>
                  ))}
                </div>

                {/* Additional Equipments — free-text extras */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                    Additional Equipments
                  </p>
                  <p className="text-sm text-white whitespace-pre-line">
                    {viewRecord.additionalEquipments || "—"}
                  </p>
                </div>

                {/* Movement */}
                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Movement Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: "From Location", value: viewRecord.fromLocation },
                      { label: "Stopover", value: viewRecord.stopover },
                      { label: "To Location", value: viewRecord.toLocation },
                    ].map((item) => (
                      <div key={item.label} className="p-3 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-xs text-slate-400 font-semibold mb-1">{item.label}</p>
                        <p className="text-sm font-semibold text-white">{item.value || "—"}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-slate-400 font-semibold mb-1">Start Date</p>
                      <p className="text-sm font-semibold text-white">
                        {viewRecord.startDate
                          ? new Date(viewRecord.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-slate-400 font-semibold mb-1">Estimated End Date</p>
                      <p className="text-sm font-semibold text-white">
                        {viewRecord.estimatedEndDate
                          ? new Date(viewRecord.estimatedEndDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Remarks */}
                {viewRecord.remarks && (
                  <div className="pt-4 border-t border-white/10">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Remarks</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{viewRecord.remarks}</p>
                  </div>
                )}

                {/* Attachments */}
                {viewRecord.attachments && viewRecord.attachments.length > 0 && (
                  <div className="pt-4 border-t border-white/10">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Attachments</h4>
                    <div className="space-y-2">
                      {viewRecord.attachments.map((att, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <span className="text-sm text-white">{att.fileName || `File ${index + 1}`}</span>
                          </div>
                          <ActionDownloadIcon
                            onClick={() => handleDownload(viewRecord._id, index)}
                            title="Download attachment"
                            className="!p-2"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
