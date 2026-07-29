"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionViewIcon,
  ActionDownloadIcon,
  ActionEditIcon,
  ActionDeleteIcon,
} from "@/app/components/RecordActionIcons";
import { usePmsRole } from "@/hooks/usePmsRole";
import { useOperationsClientPagination } from "@/app/operations/hooks/useOperationsClientPagination";
import OperationsListPaginationFooter from "@/app/operations/components/OperationsListPaginationFooter";
import OperationsSelectField from "@/app/operations/components/OperationsSelectField";

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

// Calculate AGE in years from firstUseDate or dateOfPurchase
function calculateAge(firstUseDate, dateOfPurchase) {
  const startDate = firstUseDate ? new Date(firstUseDate) : (dateOfPurchase ? new Date(dateOfPurchase) : null);
  if (!startDate || Number.isNaN(startDate.getTime())) return null;
  const now = new Date();
  const diffTime = Math.abs(now - startDate);
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
  return diffYears.toFixed(2);
}

// Calculate Days Remaining until nextTestDate
function calculateDaysRemaining(nextTestDate) {
  if (!nextTestDate) return null;
  const testDate = new Date(nextTestDate);
  if (Number.isNaN(testDate.getTime())) return null;
  const now = new Date();
  const diffTime = testDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function formatPlacedIn(eq) {
  const parts = [];
  if (eq?.placedInOffice) parts.push("Office");
  if (eq?.placedInBase) parts.push("Base");
  if (eq?.placedInBay) parts.push("Bay");
  return parts.length > 0 ? parts.join(", ") : "—";
}

function toDateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Certificate download via API so Save As uses the stored original file name and correct Content-Type.
 * Direct `/uploads/...` links use the on-disk name (legacy `_docx` / `_pdf`).
 */
function primaryEquipmentCertificateDownloadUrl(equipmentId, kind) {
  const id =
    equipmentId != null && equipmentId !== "" ? String(equipmentId) : "";
  if (!id) return "";
  const type = kind === "manufacturing" ? "manufacturing" : "test";
  return `/api/pms/equipment-inventory/primary-equipment/${id}/certificate/${type}`;
}

/** Export columns for one Primary Equipment record, in the order they appear in the detail view. */
function getPrimaryEquipmentExportColumns() {
  return [
    { label: "Equipment Code", getValue: (eq) => eq?.equipmentCode ?? "" },
    { label: "Serial Code", getValue: (eq) => eq?.serialCode ?? "" },
    { label: "Equipment Name", getValue: (eq) => eq?.equipmentName ?? "" },
    { label: "Equipment Type", getValue: (eq) => eq?.equipmentType ?? "" },
    { label: "Placed in", getValue: (eq) => formatPlacedIn(eq) },
    { label: "Entity", getValue: (eq) => eq?.entity ?? "" },
    { label: "Location", getValue: (eq) => eq?.locationName ?? "" },
    { label: "Status", getValue: (eq) => eq?.status ?? "" },
    { label: "Ownership", getValue: (eq) => (eq?.ownershipType === "THIRD_PARTY" ? "Third Party" : eq?.ownershipType === "OWNED" ? "Owned" : eq?.ownershipType ?? "") },
    { label: "In Operations", getValue: (eq) => (eq?.isInUse ? "Yes" : "No") },
    { label: "Specification", getValue: (eq) => eq?.specification ?? "" },
    { label: "Manufacturer", getValue: (eq) => eq?.manufacturer ?? "" },
    { label: "Year of Manufacturing", getValue: (eq) => (eq?.yearOfManufacturing != null ? String(eq.yearOfManufacturing) : "") },
    { label: "Quantity Transferred", getValue: (eq) => (eq?.quantityTransferred != null ? String(eq.quantityTransferred) : "0") },
    { label: "Date of Purchase", getValue: (eq) => (eq?.dateOfPurchase ? formatDate(eq.dateOfPurchase) : "") },
    { label: "First Use Date", getValue: (eq) => (eq?.firstUseDate ? formatDate(eq.firstUseDate) : "") },
    { label: "Last Test Date", getValue: (eq) => (eq?.lastTestDate ? formatDate(eq.lastTestDate) : "") },
    { label: "Next Test Date", getValue: (eq) => (eq?.nextTestDate ? formatDate(eq.nextTestDate) : "") },
    { label: "Retirement Period", getValue: (eq) => (eq?.retirementPeriodYears != null ? `${eq.retirementPeriodYears} years` : "") },
    { label: "Date to be Retired", getValue: (eq) => (eq?.dateToBeRetired ? formatDate(eq.dateToBeRetired) : "") },
    {
      label: "Age (years)",
      getValue: (eq) => {
        const age = calculateAge(eq?.firstUseDate, eq?.dateOfPurchase);
        return age != null ? `${age} years` : "";
      },
    },
    {
      label: "Days Remaining (Next Test)",
      getValue: (eq) => {
        const days = calculateDaysRemaining(eq?.nextTestDate);
        return days != null ? `${days} days` : "";
      },
    },
    { label: "Remarks", getValue: (eq) => eq?.remarks ?? "" },
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

/** Calendar year used for primary list filter / yearly export (purchase → first use → record created). */
function getPrimaryEquipmentInventoryYear(eq) {
  const raw = eq?.dateOfPurchase ?? eq?.firstUseDate ?? eq?.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
}

/** Download all primary equipment rows as a single CSV (no year filter). */
function downloadPrimaryInventoryAllCsv(rows) {
  if (!rows?.length) return;
  const columns = getPrimaryEquipmentExportColumns();
  const headers = columns.map((c) => c.label);
  const headerLine = headers.map(escapeCsvCell).join(",");
  const lines = rows.map((eq) =>
    columns.map((c) => escapeCsvCell(c.getValue(eq))).join(",")
  );
  const csv = "\uFEFF" + headerLine + "\r\n" + lines.join("\r\n") + "\r\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Primary_Equipment_Inventory_All.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download current equipment record as CSV (opens in Excel). One row of headers, one row of data. */
function downloadEquipmentExcel(equipment) {
  if (!equipment) return;
  const columns = getPrimaryEquipmentExportColumns();
  const headers = columns.map((c) => c.label);
  const values = columns.map((c) => c.getValue(equipment));
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLine = values.map(escapeCsvCell).join(",");
  const csv = "\uFEFF" + headerLine + "\r\n" + dataLine + "\r\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Primary_Equipment_${(equipment.equipmentCode || "export").replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PMS_MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // keep under proxyClientMaxBodySize (30mb)

function pickValidPmsFile(file, setError) {
  if (!file) return null;
  if (file.size > PMS_MAX_UPLOAD_BYTES) {
    setError(
      `File "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum allowed is 25 MB.`
    );
    return null;
  }
  return file;
}

export default function PrimaryEquipment({ activeTab: controlledActiveTab, onChangeTab }) {
  const { canCreate, canEdit, canDelete, canDownload } = usePmsRole();

  // Allow parent to control active tab; fall back to internal state if not provided
  const [internalActiveTab, setInternalActiveTab] = useState("form");
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = onChangeTab ?? setInternalActiveTab;

  const [editingEquipmentId, setEditingEquipmentId] = useState(null);
  const [editingSerialCode, setEditingSerialCode] = useState("");
  const [deletingEquipmentId, setDeletingEquipmentId] = useState(null);

  const canUseForm = editingEquipmentId ? canEdit : canCreate;

  // ----- Form state -----
  const [form, setForm] = useState({
    equipmentCode: "",
    equipmentName: "",
    equipmentType: "",
    specification: "",
    manufacturer: "",
    yearOfManufacturing: "",
    ownershipType: "OWNED",
    dateOfPurchase: "",
    firstUseDate: "",
    lastTestDate: "",
    nextTestDate: "",
    retirementPeriodYears: 10,
    remarks: "",
    placedInOffice: true,
    placedInBase: false,
    placedInBay: false,
    entity: "",
    locationName: "",
  });
  const [pmsLocations, setPmsLocations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  /** 'manufacturing' | 'test' while a single-cert archive request is in flight */
  const [archivingCertScope, setArchivingCertScope] = useState(null);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [manufacturingCertificateFile, setManufacturingCertificateFile] = useState(null);
  const [testCertificateFile, setTestCertificateFile] = useState(null);
  const [existingManufacturingCert, setExistingManufacturingCert] = useState(null);
  const [existingTestCert, setExistingTestCert] = useState(null);

  // ----- History state -----
  const [equipments, setEquipments] = useState([]);
  const [equipmentsLoading, setEquipmentsLoading] = useState(false);
  const [equipmentsError, setEquipmentsError] = useState(null);

  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyMeta, setHistoryMeta] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // List tab detail view state
  const [selectedEquipmentDetail, setSelectedEquipmentDetail] = useState(null);

  /** Inventory year for list tab + yearly CSV (aligned with date of purchase / first use / created). */
  const [listYear, setListYear] = useState(() => new Date().getFullYear());

  const primaryInventoryYearOptions = useMemo(() => {
    const set = new Set();
    for (const eq of equipments) {
      const y = getPrimaryEquipmentInventoryYear(eq);
      if (y != null) set.add(y);
    }
    const arr = Array.from(set).sort((a, b) => b - a);
    return arr.length > 0 ? arr : [new Date().getFullYear()];
  }, [equipments]);

  const equipmentsForListYear = useMemo(
    () =>
      equipments.filter((eq) => getPrimaryEquipmentInventoryYear(eq) === listYear),
    [equipments, listYear]
  );

  useEffect(() => {
    if (activeTab !== "list" || equipments.length === 0) return;
    if (!primaryInventoryYearOptions.includes(listYear)) {
      setListYear(primaryInventoryYearOptions[0]);
    }
  }, [activeTab, equipments.length, listYear, primaryInventoryYearOptions]);

  const listTabPagination = useOperationsClientPagination(
    activeTab === "list" ? equipmentsForListYear : [],
    activeTab === "list" ? `list-${listYear}-${equipmentsForListYear.length}` : "list-off"
  );
  const { paginatedItems: paginatedListEquipments, ...listPaginationFooterProps } =
    listTabPagination;

  const historyEquipPagination = useOperationsClientPagination(
    activeTab === "history" ? equipments : [],
    activeTab === "history" ? `hist-eq-${equipments.length}` : "hist-eq-off"
  );
  const {
    paginatedItems: paginatedHistoryEquipments,
    ...historyEquipPaginationFooterProps
  } = historyEquipPagination;

  const historyRowsPagination = useOperationsClientPagination(
    activeTab === "history" && selectedEquipment ? history : [],
    `${selectedEquipmentId || ""}-${history.length}`
  );
  const {
    paginatedItems: paginatedHistoryRows,
    ...historyRowsPaginationFooterProps
  } = historyRowsPagination;

  const primaryEquipmentLocationNames = useMemo(() => {
    const names = (pmsLocations || [])
      .map((l) => (typeof l?.name === "string" ? l.name.trim() : ""))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    const set = new Set(names);
    const cur = (form.locationName || "").trim();
    if (cur && !set.has(cur)) {
      names.push(cur);
      names.sort((a, b) => a.localeCompare(b));
    }
    return names;
  }, [pmsLocations, form.locationName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/pms/locations/list");
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data.locations)) {
          setPmsLocations(data.locations);
        }
      } catch {
        /* dropdown stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load equipments list when list or history tab first opened
  useEffect(() => {
    if ((activeTab === "list" || activeTab === "history") && equipments.length === 0 && !equipmentsLoading) {
      fetchEquipments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchEquipments = async () => {
    setEquipmentsLoading(true);
    setEquipmentsError(null);
    try {
      const res = await fetch(
        "/api/pms/equipment-inventory/primary-equipment/list"
      );

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        throw new Error("Server returned an invalid response. Please try again.");
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to load equipments");
      }
      setEquipments(data.equipments || []);
    } catch (err) {
      console.error("Fetch equipments error:", err);
      setEquipmentsError(err.message || "Failed to load equipments");
    } finally {
      setEquipmentsLoading(false);
    }
  };

  const fetchHistory = async (equipment) => {
    if (!equipment?._id) return;

    setSelectedEquipmentId(equipment._id);
    setSelectedEquipment(equipment);
    setHistory([]);
    setHistoryMeta(null);
    setHistoryError(null);
    setHistoryLoading(true);

    try {
      const res = await fetch(
        `/api/pms/equipment-inventory/primary-equipment/${equipment._id}/history`
      );

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        throw new Error("Server returned an invalid response. Please try again.");
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to load equipment history");
      }

      // New API shape: { equipmentId, totalJobs, records: [...] }
      setHistory(data.records || []);
      setHistoryMeta({
        equipmentId: data.equipmentId,
        totalJobs: data.totalJobs || 0,
      });
      // Clear error if we got a successful response (even if empty)
      setHistoryError(null);
    } catch (err) {
      console.error("Fetch history error:", err);
      // Only show error if it's not a "no records" case
      if (err.message && !err.message.includes("Invalid equipment id")) {
        setHistoryError(err.message || "Failed to load equipment history");
      } else {
        setHistoryError(null);
        setHistory([]);
        setHistoryMeta({ equipmentId: equipment._id, totalJobs: 0 });
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value === "" ? "" : Number(value),
    }));
  };

  const resetFormToNew = () => {
    setEditingEquipmentId(null);
    setEditingSerialCode("");
    setForm((prev) => ({
      ...prev,
      equipmentCode: "",
      equipmentName: "",
      equipmentType: "",
      specification: "",
      manufacturer: "",
      yearOfManufacturing: "",
      dateOfPurchase: "",
      firstUseDate: "",
      lastTestDate: "",
      nextTestDate: "",
      remarks: "",
      placedInOffice: true,
      placedInBase: false,
      placedInBay: false,
      entity: "",
      locationName: "",
    }));
    setManufacturingCertificateFile(null);
    setTestCertificateFile(null);
    setExistingManufacturingCert(null);
    setExistingTestCert(null);
    const manufacturingInput = document.querySelector(
      'input[type="file"][name="manufacturingCertificate"]'
    );
    const testInput = document.querySelector('input[type="file"][name="testCertificate"]');
    if (manufacturingInput) manufacturingInput.value = "";
    if (testInput) testInput.value = "";
  };

  const startEditFromEquipment = (eq) => {
    if (!eq?._id || !canEdit) return;
    setEditingEquipmentId(eq._id);
    setEditingSerialCode(eq.serialCode?.trim() || "");
    setForm((prev) => ({
      ...prev,
      equipmentCode: eq.equipmentCode || "",
      equipmentName: eq.equipmentName || "",
      equipmentType: eq.equipmentType || "",
      specification: eq.specification || "",
      manufacturer: eq.manufacturer || "",
      yearOfManufacturing:
        eq.yearOfManufacturing != null && eq.yearOfManufacturing !== ""
          ? String(eq.yearOfManufacturing)
          : "",
      ownershipType: eq.ownershipType || "OWNED",
      dateOfPurchase: toDateInputValue(eq.dateOfPurchase),
      firstUseDate: toDateInputValue(eq.firstUseDate),
      lastTestDate: toDateInputValue(eq.lastTestDate),
      nextTestDate: toDateInputValue(eq.nextTestDate),
      retirementPeriodYears: eq.retirementPeriodYears ?? 10,
      remarks: eq.remarks || "",
      placedInOffice: !!eq.placedInOffice,
      placedInBase: !!eq.placedInBase,
      placedInBay: !!eq.placedInBay,
      entity: eq.entity || "",
      locationName: eq.locationName || "",
    }));
    setManufacturingCertificateFile(null);
    setTestCertificateFile(null);
    setExistingManufacturingCert(
      eq.manufacturingCertificate?.fileUrl
        ? {
            fileUrl: eq.manufacturingCertificate.fileUrl,
            originalFileName:
              eq.manufacturingCertificate.originalFileName || "",
          }
        : null
    );
    setExistingTestCert(
      eq.testCertificate?.fileUrl
        ? {
            fileUrl: eq.testCertificate.fileUrl,
            originalFileName: eq.testCertificate.originalFileName || "",
          }
        : null
    );
    const manufacturingInput = document.querySelector(
      'input[type="file"][name="manufacturingCertificate"]'
    );
    const testInput = document.querySelector('input[type="file"][name="testCertificate"]');
    if (manufacturingInput) manufacturingInput.value = "";
    if (testInput) testInput.value = "";
    setFormError(null);
    setFormSuccess(null);
    setActiveTab("form");
  };

  const handleArchiveCertificate = async (scope) => {
    if (!editingEquipmentId || !canEdit) return;
    const scopeLabel =
      scope === "manufacturing"
        ? "manufacturing certificate"
        : "test certificate";
    if (
      !confirm(
        `Archive the current ${scopeLabel} to QHSE Archive? A snapshot with equipment details and archive time will be stored. The equipment record will not change.`
      )
    ) {
      return;
    }
    setArchivingCertScope(scope);
    setFormError(null);
    setFormSuccess(null);
    try {
      const res = await fetch(
        `/api/pms/equipment-inventory/primary-equipment/${editingEquipmentId}/archive-certificates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to archive certificate");
      }
      setFormSuccess(data.message || "Archived to QHSE Archive.");
    } catch (err) {
      setFormError(err.message || "Failed to archive certificate");
    } finally {
      setArchivingCertScope(null);
    }
  };

  const handleDeleteEquipment = async (eq) => {
    if (!eq?._id || !canDelete) return;
    if (
      !confirm(
        `Delete equipment "${eq.equipmentName || eq.equipmentCode}"? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingEquipmentId(eq._id);
    setEquipmentsError(null);
    try {
      const res = await fetch(
        `/api/pms/equipment-inventory/primary-equipment/${eq._id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete equipment");
      }
      if (editingEquipmentId === eq._id) {
        resetFormToNew();
      }
      if (selectedEquipmentDetail?._id === eq._id) {
        setSelectedEquipmentDetail(null);
      }
      if (selectedEquipmentId === eq._id) {
        setSelectedEquipmentId(null);
        setSelectedEquipment(null);
        setHistory([]);
        setHistoryMeta(null);
      }
      await fetchEquipments();
    } catch (err) {
      setEquipmentsError(err.message || "Failed to delete equipment");
    } finally {
      setDeletingEquipmentId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canUseForm) return;
    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      if (!form.placedInOffice && !form.placedInBase && !form.placedInBay) {
        throw new Error("Placed in: select at least one of Office, Base, or Bay");
      }

      const formData = new FormData();
      
      // Add all form fields
      formData.append("equipmentCode", form.equipmentCode);
      formData.append("equipmentName", form.equipmentName);
      formData.append("equipmentType", form.equipmentType || "");
      formData.append("specification", form.specification || "");
      formData.append("manufacturer", form.manufacturer || "");
      if (form.yearOfManufacturing) {
        formData.append("yearOfManufacturing", form.yearOfManufacturing);
      }
      formData.append("ownershipType", form.ownershipType);
      if (form.dateOfPurchase) formData.append("dateOfPurchase", form.dateOfPurchase);
      if (form.firstUseDate) formData.append("firstUseDate", form.firstUseDate);
      if (form.lastTestDate) formData.append("lastTestDate", form.lastTestDate);
      if (form.nextTestDate) formData.append("nextTestDate", form.nextTestDate);
      formData.append("retirementPeriodYears", form.retirementPeriodYears || 10);
      formData.append("remarks", form.remarks || "");
      formData.append("placedInOffice", form.placedInOffice ? "true" : "false");
      formData.append("placedInBase", form.placedInBase ? "true" : "false");
      formData.append("placedInBay", form.placedInBay ? "true" : "false");
      formData.append("entity", (form.entity || "").trim());
      formData.append("locationName", (form.locationName || "").trim());

      // Add certificate files if selected
      if (manufacturingCertificateFile) {
        formData.append("manufacturingCertificate", manufacturingCertificateFile);
      }
      if (testCertificateFile) {
        formData.append("testCertificate", testCertificateFile);
      }

      const url = editingEquipmentId
        ? `/api/pms/equipment-inventory/primary-equipment/${editingEquipmentId}`
        : "/api/pms/equipment-inventory/primary-equipment/create";
      const method = editingEquipmentId ? "PATCH" : "POST";

      let res;
      try {
        res = await fetch(url, {
          method,
          body: formData,
        });
      } catch (networkErr) {
        throw new Error(
          `Upload request failed before the server responded${
            networkErr?.message ? `: ${networkErr.message}` : ""
          }. If a file was attached, try a smaller file or retry.`
        );
      }

      const rawText = await res.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { message: rawText?.slice(0, 300) };
      }

      if (!res.ok) {
        throw new Error(
          data.message ||
            `Request failed with status ${res.status}${
              editingEquipmentId
                ? " (update equipment)"
                : " (create equipment)"
            }`
        );
      }

      if (editingEquipmentId) {
        setFormSuccess("Equipment updated successfully");
      } else {
        const createdSerial = data.data?.serialCode?.trim();
        setFormSuccess(
          createdSerial
            ? `Equipment created successfully. Serial code: ${createdSerial}`
            : "Equipment created successfully"
        );
      }
      setFormError(null);
      resetFormToNew();

      fetchEquipments();
    } catch (err) {
      setFormError(
        err.message ||
          (editingEquipmentId
            ? "Failed to update equipment"
            : "Failed to create equipment")
      );
      setFormSuccess(null);
    } finally {
      setSubmitting(false);
      // Auto-scroll to top of card for messages
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Section header (tabs are now rendered in parent PMS header) */}
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-sky-300">
          PMS / Equipment Inventory
        </p>
        <h2 className="text-xl font-bold text-white mt-1">Primary Equipment</h2>
        <p className="text-xs text-slate-200 mt-1">
          Manage primary equipment master data and view operation history.
        </p>
      </div>

      {/* Feedback messages for form */}
      {activeTab === "form" && (formError || formSuccess) && (
        <div>
          {formError && (
            <div className="mb-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
              {formSuccess}
            </div>
          )}
        </div>
      )}

      {/* Tab content */}
      {activeTab === "list" && (
        <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0b2740]/75 backdrop-blur-[2px] p-6 shadow-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
            <h3 className="text-sm font-semibold text-white">Equipment List</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-slate-200">
                  Year
                </span>
                <OperationsSelectField
                  variant="pill"
                  ariaLabel="Inventory year"
                  value={String(listYear)}
                  onChange={(v) => setListYear(Number(v))}
                  options={primaryInventoryYearOptions.map((y) => ({
                    value: String(y),
                    label: String(y),
                  }))}
                  className="min-w-0 w-[6.25rem] sm:w-32"
                  triggerClassName="ops-select-trigger w-full rounded-full px-3 py-1 text-xs tracking-widest uppercase"
                />
              </div>
              {canDownload && (
                <button
                  type="button"
                  onClick={() => downloadPrimaryInventoryAllCsv(equipments)}
                  disabled={equipments.length === 0 || equipmentsLoading}
                  title="Download all equipment records as CSV"
                  className="text-xs px-3 py-1.5 rounded-lg border border-orange-400/50 text-orange-100 bg-orange-500/10 hover:bg-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Download All
                </button>
              )}
              <button
                type="button"
                onClick={fetchEquipments}
                disabled={equipmentsLoading}
                className="text-xs px-3 py-1.5 rounded-lg border border-sky-400/40 text-sky-200 hover:bg-sky-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {equipmentsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {equipmentsError && (
            <div className="mb-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
              {equipmentsError}
            </div>
          )}

          <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5">
            <div className="rounded-t-2xl border-b border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 bg-white/5">
              Primary Equipments
            </div>
            <div className="min-h-0 min-w-0 overflow-auto styled-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-300 border-b border-white/10 bg-white/5">
                    <th className="px-4 py-2 font-semibold">Code</th>
                    <th className="px-4 py-2 font-semibold">Serial</th>
                    <th className="px-4 py-2 font-semibold">Name</th>
                    <th className="px-4 py-2 font-semibold">Type</th>
                    <th className="px-4 py-2 font-semibold">Placed in</th>
                    <th className="px-4 py-2 font-semibold">Entity</th>
                    <th className="px-4 py-2 font-semibold">Location</th>
                    <th className="px-4 py-2 font-semibold">Ownership</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    <th className="px-4 py-2 font-semibold">In Use</th>
                    <th className="px-4 py-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {equipments.length === 0 && !equipmentsLoading && (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-4 text-center text-slate-400"
                      >
                        No equipments found
                      </td>
                    </tr>
                  )}
                  {paginatedListEquipments.map((eq) => (
                    <tr
                      key={eq._id}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="px-4 py-2 font-mono text-sky-300">
                        {eq.equipmentCode}
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-200">
                        {eq.serialCode || "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-100">
                        {eq.equipmentName}
                      </td>
                      <td className="px-4 py-2 text-slate-200">
                        {eq.equipmentType}
                      </td>
                      <td className="px-4 py-2 text-slate-300 text-[11px]">
                        {formatPlacedIn(eq)}
                      </td>
                      <td className="px-4 py-2 text-slate-300 max-w-[120px] truncate" title={eq.entity || ""}>
                        {eq.entity?.trim() ? eq.entity : "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-300 max-w-[120px] truncate" title={eq.locationName || ""}>
                        {eq.locationName?.trim() ? eq.locationName : "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-200">
                        {eq.ownershipType}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${eq.status === "ACTIVE"
                              ? "bg-emerald-500/10 border-emerald-400/60 text-emerald-200"
                              : eq.status === "RETIRED"
                                ? "bg-slate-500/10 border-slate-400/60 text-slate-200"
                                : "bg-amber-500/10 border-amber-400/60 text-amber-200"
                            }`}
                        >
                          {eq.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {eq.isInUse ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 border border-emerald-400/60">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">No</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <ActionViewIcon onClick={() => setSelectedEquipmentDetail(eq)} title="View equipment" />
                          {canEdit && (
                            <ActionEditIcon
                              onClick={() => startEditFromEquipment(eq)}
                              title="Edit equipment"
                            />
                          )}
                          {canDelete && (
                            <ActionDeleteIcon
                              loading={deletingEquipmentId === eq._id}
                              onClick={() => handleDeleteEquipment(eq)}
                              title="Delete equipment"
                            />
                          )}
                          {canDownload && (
                            <ActionDownloadIcon onClick={() => downloadEquipmentExcel(eq)} title="Download as Excel" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <OperationsListPaginationFooter
              {...listPaginationFooterProps}
              className="rounded-b-2xl overflow-visible"
            />
          </div>

          {/* Detail View Card - Right Side */}
          {selectedEquipmentDetail && (
            <div className="relative self-center-safe inset-0 z-30 flex justify-center  pt-10 pb-30">
             <div className="relative w-full max-w-[1200px] h-[110vh] flex flex-col rounded-3xl border border-sky-400/40 bg-[#0b2740]/88 backdrop-blur-[2px] shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-6 bg-[#0b2740]/65 backdrop-blur-[2px] flex-shrink-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedEquipmentDetail(null)}
                        className="text-sky-300 hover:text-sky-200 transition"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-sky-300">
                        Dashboard
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-white">
                        {selectedEquipmentDetail.equipmentCode || "Equipment Details"}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Serial:{" "}
                      <span className="font-mono text-slate-200">
                        {selectedEquipmentDetail.serialCode || "—"}
                      </span>
                      {" · "}
                      Type:{" "}
                      <span className="text-slate-200">{selectedEquipmentDetail.equipmentType || "—"}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status pill */}
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold border ${selectedEquipmentDetail.status === "ACTIVE"
                          ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-200"
                          : selectedEquipmentDetail.status === "RETIRED"
                            ? "bg-slate-500/20 border-slate-400/60 text-slate-200"
                            : "bg-amber-500/20 border-amber-400/60 text-amber-200"
                        }`}
                    >
                      {selectedEquipmentDetail.status}
                    </span>

                    {/* Ownership */}
                    <div className="rounded-full bg-slate-800/90 px-3 py-1 text-[11px] text-slate-100 border border-white/10">
                      Ownership:{" "}
                      <span className="font-semibold">
                        {selectedEquipmentDetail.ownershipType === "OWNED" ? "Owned" : "Third Party"}
                      </span>
                    </div>

                    {/* In use indicator */}
                    {selectedEquipmentDetail.isInUse && (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-200 border border-emerald-400/60">
                        In Operations
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedEquipmentDetail(null)}
                      className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white border border-white/10 transition"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 styled-scrollbar">
                  {/* Top grid: basic info */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                        Basic Information
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-[11px] text-slate-400">Equipment Code</p>
                          <p className="font-semibold text-white">
                            {selectedEquipmentDetail.equipmentCode || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Serial Code</p>
                          <p className="font-mono font-semibold text-white">
                            {selectedEquipmentDetail.serialCode || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Equipment Name</p>
                          <p className="font-semibold text-white">
                            {selectedEquipmentDetail.equipmentName || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Equipment Type</p>
                          <p className="text-slate-100">
                            {selectedEquipmentDetail.equipmentType || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Placed in</p>
                          <p className="text-slate-100">
                            {formatPlacedIn(selectedEquipmentDetail)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Entity</p>
                          <p className="text-slate-100">
                            {selectedEquipmentDetail.entity?.trim()
                              ? selectedEquipmentDetail.entity
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Location</p>
                          <p className="text-slate-100">
                            {selectedEquipmentDetail.locationName?.trim()
                              ? selectedEquipmentDetail.locationName
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Specification</p>
                          <p className="text-slate-100 break-words">
                            {selectedEquipmentDetail.specification || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Manufacturer</p>
                          <p className="text-slate-100">
                            {selectedEquipmentDetail.manufacturer || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Year of Manufacturing</p>
                          <p className="text-slate-100">
                            {selectedEquipmentDetail.yearOfManufacturing || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Quantity Transferred</p>
                          <p className="text-slate-100">
                            {selectedEquipmentDetail.quantityTransferred || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Lifecycle / dates */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                        Lifecycle & Dates
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-[11px] text-slate-400">Date of Purchase</p>
                          <p className="text-slate-100">
                            {formatDate(selectedEquipmentDetail.dateOfPurchase)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">First Use Date</p>
                          <p className="text-slate-100">
                            {formatDate(selectedEquipmentDetail.firstUseDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Last Test Date</p>
                          <p className="text-slate-100">
                            {formatDate(selectedEquipmentDetail.lastTestDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Next Test Date</p>
                          <p className="text-slate-100">
                            {formatDate(selectedEquipmentDetail.nextTestDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Retirement Period</p>
                          <p className="text-slate-100">
                            {selectedEquipmentDetail.retirementPeriodYears || 10} years
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Date to be Retired</p>
                          <p className="text-slate-100">
                            {formatDate(selectedEquipmentDetail.dateToBeRetired)}
                          </p>
                        </div>
                        {selectedEquipmentDetail.lastUsedAt && (
                          <div>
                            <p className="text-[11px] text-slate-400">Last Used At</p>
                            <p className="text-slate-100">
                              {formatDateTime(selectedEquipmentDetail.lastUsedAt)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Calculated metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4 shadow-inner">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-sky-200 mb-2">
                        Age
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold text-sky-100">
                        {(() => {
                          const age = calculateAge(
                            selectedEquipmentDetail.firstUseDate,
                            selectedEquipmentDetail.dateOfPurchase
                          );
                          return age ? `${age} years` : "—";
                        })()}
                      </p>
                      <p className="mt-1 text-[11px] text-sky-100/80">
                        Based on first-use or purchase date.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 shadow-inner">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200 mb-2">
                        Days Remaining (Next Test)
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold text-emerald-100">
                        {(() => {
                          const days = calculateDaysRemaining(
                            selectedEquipmentDetail.nextTestDate
                          );
                          return days !== null ? `${days} days` : "—";
                        })()}
                      </p>
                      <p className="mt-1 text-[11px] text-emerald-100/80">
                        Calculated from today to the planned next test date.
                      </p>
                    </div>
                  </div>

                  {/* Certificates */}
                  {(selectedEquipmentDetail.manufacturingCertificate?.fileUrl ||
                    selectedEquipmentDetail.testCertificate?.fileUrl) && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                          Certificates
                        </h4>
                        <div className="space-y-2">
                          {selectedEquipmentDetail.manufacturingCertificate?.fileUrl && (
                            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-100">
                                  Manufacturing Certificate
                                </p>
                                {selectedEquipmentDetail.manufacturingCertificate.originalFileName && (
                                  <p className="text-[11px] text-slate-400">
                                    {selectedEquipmentDetail.manufacturingCertificate.originalFileName}
                                  </p>
                                )}
                              </div>
                              {canDownload ? (
                              <a
                                href={
                                  primaryEquipmentCertificateDownloadUrl(
                                    selectedEquipmentDetail._id,
                                    "manufacturing"
                                  ) || selectedEquipmentDetail.manufacturingCertificate.fileUrl
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open or download"
                                aria-label="Open or download"
                                className="inline-flex items-center justify-center rounded-lg border border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/15 p-1.5 transition"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </a>
                              ) : (
                                <span className="text-[10px] text-white/35">No download access</span>
                              )}
                            </div>
                          )}
                          {selectedEquipmentDetail.testCertificate?.fileUrl && (
                            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-100">
                                  Test Certificate
                                </p>
                                {selectedEquipmentDetail.testCertificate.originalFileName && (
                                  <p className="text-[11px] text-slate-400">
                                    {selectedEquipmentDetail.testCertificate.originalFileName}
                                  </p>
                                )}
                              </div>
                              {canDownload ? (
                              <a
                                href={
                                  primaryEquipmentCertificateDownloadUrl(
                                    selectedEquipmentDetail._id,
                                    "test"
                                  ) || selectedEquipmentDetail.testCertificate.fileUrl
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open or download"
                                aria-label="Open or download"
                                className="inline-flex items-center justify-center rounded-lg border border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/15 p-1.5 transition"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </a>
                              ) : (
                                <span className="text-[10px] text-white/35">No download access</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Remarks */}
                  {selectedEquipmentDetail.remarks && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                        Remarks
                      </h4>
                      <p className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-50">
                        {selectedEquipmentDetail.remarks}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="border-t border-white/10 bg-[#0b2740]/65 backdrop-blur-[2px] px-6 py-4 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEquipmentDetail(null);
                      setActiveTab("history");
                      setTimeout(() => {
                        const eq = equipments.find(
                          (e) => e._id === selectedEquipmentDetail._id
                        );
                        if (eq) fetchHistory(eq);
                      }, 120);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-100 border border-sky-400/60 hover:bg-sky-500/30 transition"
                  >
                    <span>View Past Operations</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          const d = selectedEquipmentDetail;
                          setSelectedEquipmentDetail(null);
                          startEditFromEquipment(d);
                        }}
                        className="inline-flex items-center rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-100 border border-amber-400/60 hover:bg-amber-500/30 transition"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        disabled={deletingEquipmentId === selectedEquipmentDetail._id}
                        onClick={() => handleDeleteEquipment(selectedEquipmentDetail)}
                        className="inline-flex items-center rounded-lg bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-100 border border-rose-400/60 hover:bg-rose-500/30 transition disabled:opacity-50"
                      >
                        {deletingEquipmentId === selectedEquipmentDetail._id
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedEquipmentDetail(null)}
                      className="inline-flex items-center rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-600 border border-white/10 transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "form" && (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-white/10 bg-[#0b2740]/85 backdrop-blur-[2px] p-6 shadow-2xl overflow-x-hidden max-w-6xl mx-auto"
        >
          {!canUseForm && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
              You do not have permission to create or edit equipment records. Form is view-only.
            </div>
          )}
          {editingEquipmentId && canEdit && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-950/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-amber-100">
                Editing this record — serial code is not changed.
              </p>
              <button
                type="button"
                onClick={resetFormToNew}
                className="text-xs px-3 py-1.5 rounded-lg border border-amber-400/50 text-amber-200 hover:bg-amber-500/15"
              >
                Cancel edit
              </button>
            </div>
          )}
          <fieldset
            disabled={!canUseForm}
            className="border-0 p-0 m-0 min-w-0 space-y-6 disabled:opacity-[0.88]"
          >
          {/* Basic details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Equipment Code<span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="equipmentCode"
                value={form.equipmentCode}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="E.g., EQ-001"
                required
              />
              {editingEquipmentId && editingSerialCode && (
                <p className="mt-1 text-[11px] text-sky-200/90">
                  Current serial code:{" "}
                  <span className="font-mono font-semibold">{editingSerialCode}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Equipment Name<span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="equipmentName"
                value={form.equipmentName}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="E.g., Transfer Hose"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Equipment Type
              </label>
              <input
                type="text"
                name="equipmentType"
                value={form.equipmentType}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="E.g., Lifting Gear, Hose"
              />
            </div>
          </div>

          {/* Specification / Manufacturer / Year */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Specification
              </label>
              <input
                type="text"
                name="specification"
                value={form.specification}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="Size, capacity, rating, etc."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Manufacturer
              </label>
              <input
                type="text"
                name="manufacturer"
                value={form.manufacturer}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="Manufacturer name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Year of Manufacturing
              </label>
              <input
                type="number"
                name="yearOfManufacturing"
                value={form.yearOfManufacturing}
                onChange={handleNumberChange}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="e.g., 2022"
                min="1900"
                max={new Date().getFullYear() + 1}
              />
            </div>
          </div>

          {/* Ownership & dates */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <OperationsSelectField
                label={
                  <>
                    Ownership Type<span className="text-red-400">*</span>
                  </>
                }
                value={form.ownershipType}
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, ownershipType: v }))
                }
                options={[
                  { value: "OWNED", label: "Owned" },
                  { value: "THIRD_PARTY", label: "Third Party" },
                ]}
                triggerClassName="w-full min-h-[2.75rem] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Date of Purchase
              </label>
              <input
                type="date"
                name="dateOfPurchase"
                value={form.dateOfPurchase}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                First Use Date
              </label>
              <input
                type="date"
                name="firstUseDate"
                value={form.firstUseDate}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Retirement Period (years)
              </label>
              <input
                type="number"
                name="retirementPeriodYears"
                value={form.retirementPeriodYears}
                onChange={handleNumberChange}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                min="1"
              />
            </div>
          </div>

          {/* Placed in + Entity + Location (same row on large screens) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
            <div className="lg:col-span-5 space-y-2">
              <span className="block text-xs font-medium text-slate-200">
                Placed in<span className="text-red-400">*</span>
              </span>
              <p className="text-[11px] text-slate-400">
                Select one or more: Office, Base, Bay.
              </p>
              <div className="flex flex-wrap gap-6">
                {[
                  { key: "placedInOffice", label: "Office" },
                  { key: "placedInBase", label: "Base" },
                  { key: "placedInBay", label: "Bay" },
                ].map(({ key, label }) => (
                  <label key={key} className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={!!form[key]}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-white/30 bg-white/5 text-sky-500 focus:ring-sky-500/50"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Entity
              </label>
              <input
                type="text"
                name="entity"
                value={form.entity}
                onChange={handleInputChange}
                placeholder="e.g. cost centre / company"
                autoComplete="off"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              />
            </div>
            <div className="lg:col-span-4">
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Location
              </label>
              <select
                name="locationName"
                value={form.locationName}
                onChange={handleInputChange}
                className="w-full min-h-[2.75rem] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              >
                <option value="">Select location</option>
                {primaryEquipmentLocationNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Test dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Last Test Date
              </label>
              <input
                type="date"
                name="lastTestDate"
                value={form.lastTestDate}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Next Test Date
              </label>
              <input
                type="date"
                name="nextTestDate"
                value={form.nextTestDate}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              />
            </div>
          </div>

          {/* Certificates */}
          <p className="text-[11px] text-slate-400">
            Uploading a new file and saving archives the previous file to QHSE Archive automatically.
            Use the buttons below to archive the current manufacturing or test certificate without
            replacing it.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Manufacturing Certificate
              </label>
              {existingManufacturingCert?.fileUrl &&
                !manufacturingCertificateFile && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <span className="text-[11px] uppercase tracking-wider text-emerald-300 shrink-0">
                      Current
                    </span>
                    <a
                      href={
                        primaryEquipmentCertificateDownloadUrl(
                          editingEquipmentId,
                          "manufacturing"
                        ) || existingManufacturingCert.fileUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-xs text-emerald-200 hover:text-emerald-100 underline"
                      title={
                        existingManufacturingCert.originalFileName ||
                        existingManufacturingCert.fileUrl
                      }
                    >
                      {existingManufacturingCert.originalFileName ||
                        existingManufacturingCert.fileUrl.split("/").pop()}
                    </a>
                    <a
                      href={
                        primaryEquipmentCertificateDownloadUrl(
                          editingEquipmentId,
                          "manufacturing"
                        ) || existingManufacturingCert.fileUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-semibold text-sky-300 hover:text-sky-200 underline shrink-0"
                    >
                      View / Download
                    </a>
                  </div>
                )}
              {editingEquipmentId &&
                canEdit &&
                existingManufacturingCert?.fileUrl && (
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleArchiveCertificate("manufacturing")}
                      disabled={archivingCertScope !== null}
                      className="rounded-lg border border-amber-400/45 bg-amber-500/15 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {archivingCertScope === "manufacturing"
                        ? "Archiving…"
                        : "Archive manufacturing cert"}
                    </button>
                  </div>
                )}
              <input
                type="file"
                name="manufacturingCertificate"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const picked = e.target.files?.[0] || null;
                  const valid = pickValidPmsFile(picked, setFormError);
                  if (picked && !valid) e.target.value = "";
                  setManufacturingCertificateFile(valid);
                  if (valid) setFormError(null);
                }}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer"
              />
              {existingManufacturingCert?.fileUrl && (
                <p className="mt-1 text-[10px] text-slate-400">
                  {manufacturingCertificateFile
                    ? "New upload replaces the current file on save; the previous version is saved to QHSE Archive first."
                    : "Leave empty to keep the current certificate."}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Test Certificate
              </label>
              {existingTestCert?.fileUrl && !testCertificateFile && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                  <span className="text-[11px] uppercase tracking-wider text-emerald-300 shrink-0">
                    Current
                  </span>
                  <a
                    href={
                      primaryEquipmentCertificateDownloadUrl(
                        editingEquipmentId,
                        "test"
                      ) || existingTestCert.fileUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate text-xs text-emerald-200 hover:text-emerald-100 underline"
                    title={
                      existingTestCert.originalFileName ||
                      existingTestCert.fileUrl
                    }
                  >
                    {existingTestCert.originalFileName ||
                      existingTestCert.fileUrl.split("/").pop()}
                  </a>
                  <a
                    href={
                      primaryEquipmentCertificateDownloadUrl(
                        editingEquipmentId,
                        "test"
                      ) || existingTestCert.fileUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-semibold text-sky-300 hover:text-sky-200 underline shrink-0"
                  >
                    View / Download
                  </a>
                </div>
              )}
              {editingEquipmentId && canEdit && existingTestCert?.fileUrl && (
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleArchiveCertificate("test")}
                    disabled={archivingCertScope !== null}
                    className="rounded-lg border border-amber-400/45 bg-amber-500/15 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {archivingCertScope === "test"
                      ? "Archiving…"
                      : "Archive test cert"}
                  </button>
                </div>
              )}
              <input
                type="file"
                name="testCertificate"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const picked = e.target.files?.[0] || null;
                  const valid = pickValidPmsFile(picked, setFormError);
                  if (picked && !valid) e.target.value = "";
                  setTestCertificateFile(valid);
                  if (valid) setFormError(null);
                }}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer"
              />
              {existingTestCert?.fileUrl && (
                <p className="mt-1 text-[10px] text-slate-400">
                  {testCertificateFile
                    ? "New upload replaces the current file on save; the previous version is saved to QHSE Archive first."
                    : "Leave empty to keep the current certificate."}
                </p>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-medium text-slate-200 mb-1">
              Remarks
            </label>
            <textarea
              name="remarks"
              value={form.remarks}
              onChange={handleInputChange}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500/50 resize-none"
              placeholder="Any additional notes about this equipment"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={!canUseForm || submitting}
              className="inline-flex items-center px-6 py-2.5 rounded-lg bg-emerald-500 text-sm font-semibold text-white shadow shadow-emerald-500/40 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {submitting ? "Saving..." : editingEquipmentId ? "Save changes" : "Save Equipment"}
            </button>
          </div>
          </fieldset>
        </form>
      )}

      {activeTab === "history" && (
        <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0b2740]/75 backdrop-blur-[2px] p-6 shadow-2xl">
          {/* Equipments list */}
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="text-sm font-semibold text-white">
              Equipment List
            </h3>
            <button
              type="button"
              onClick={fetchEquipments}
              disabled={equipmentsLoading}
              className="text-xs px-3 py-1.5 rounded-lg border border-sky-400/40 text-sky-200 hover:bg-sky-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {equipmentsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {equipmentsError && (
            <div className="mb-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
              {equipmentsError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: equipments table */}
            <div className="flex max-h-[420px] flex-col rounded-2xl border border-white/10 bg-white/5">
              <div className="shrink-0 border-b border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 bg-white/5">
                Primary Equipments
              </div>
              <div className="min-h-0 min-w-0 flex-1 overflow-auto styled-scrollbar">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-300 border-b border-white/10 bg-white/5">
                      <th className="px-4 py-2 font-semibold">Code</th>
                      <th className="px-4 py-2 font-semibold">Serial</th>
                      <th className="px-4 py-2 font-semibold">Name</th>
                      <th className="px-4 py-2 font-semibold">Type</th>
                      <th className="px-4 py-2 font-semibold">Placed</th>
                      <th className="px-4 py-2 font-semibold text-right">
                        Status
                      </th>
                      <th className="px-4 py-2 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipments.length === 0 && !equipmentsLoading && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-4 text-center text-slate-400"
                        >
                          No equipments found
                        </td>
                      </tr>
                    )}
                    {paginatedHistoryEquipments.map((eq) => (
                      <tr
                        key={eq._id}
                        className={`border-b border-white/5 transition ${selectedEquipmentId === eq._id
                            ? "bg-sky-500/20"
                            : "hover:bg-white/5"
                          }`}
                      >
                        <td className="px-4 py-2 font-mono text-sky-300">
                          {eq.equipmentCode}
                        </td>
                        <td className="px-4 py-2 font-mono text-slate-200">
                          {eq.serialCode || "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-100">
                          {eq.equipmentName}
                        </td>
                        <td className="px-4 py-2 text-slate-200">
                          {eq.equipmentType}
                        </td>
                        <td className="px-4 py-2 text-slate-300 text-[11px]">
                          {formatPlacedIn(eq)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${eq.status === "ACTIVE"
                                ? "bg-emerald-500/10 border-emerald-400/60 text-emerald-200"
                                : eq.status === "RETIRED"
                                  ? "bg-slate-500/10 border-slate-400/60 text-slate-200"
                                  : "bg-amber-500/10 border-amber-400/60 text-amber-200"
                              }`}
                          >
                            {eq.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchHistory(eq);
                            }}
                            className="text-xs px-3 py-1 rounded-lg border border-sky-400/40 text-sky-200 hover:bg-sky-500/10 hover:border-sky-400/60 transition"
                          >
                            View History
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <OperationsListPaginationFooter
                {...historyEquipPaginationFooterProps}
                className="shrink-0 overflow-visible"
              />
            </div>

            {/* Right: history details */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
              {!selectedEquipment && !historyLoading && (
                <p className="text-xs text-slate-300">
                  Select an equipment from the list to view its usage history.
                </p>
              )}

              {selectedEquipment && (
                <div className="space-y-2 border-b border-white/10 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-400">Selected Equipment</p>
                      <p className="text-sm font-semibold text-white">
                        {selectedEquipment.equipmentName}
                      </p>
                      <p className="text-[11px] text-slate-300">
                        {selectedEquipment.equipmentCode}
                        {selectedEquipment.serialCode
                          ? ` · ${selectedEquipment.serialCode}`
                          : ""}{" "}
                        • {selectedEquipment.equipmentType}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400 mb-1">
                        Ownership
                      </p>
                      <p className="text-xs font-semibold text-slate-100">
                        {selectedEquipment.ownershipType}
                      </p>
                      {selectedEquipment.isInUse && (
                        <p className="mt-1 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 border border-emerald-400/60">
                          In Use
                        </p>
                      )}
                    </div>
                  </div>

                  {historyMeta && (
                    <p className="text-[11px] text-slate-300">
                      Total jobs:{" "}
                      <span className="font-semibold text-sky-200">
                        {historyMeta.totalJobs}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {historyError && (
                <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-[11px] text-red-100">
                  {historyError}
                </div>
              )}

              {historyLoading && (
                <p className="text-xs text-slate-300">Loading history...</p>
              )}

              {!historyLoading && selectedEquipment && history.length === 0 && !historyError && (
                <p className="text-xs text-slate-300">
                  No history records found for this equipment. This equipment has not been used in any STS operations yet.
                </p>
              )}

              {!historyLoading && history.length > 0 && (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/5 overflow-auto max-h-[320px] styled-scrollbar">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-left text-slate-100 border-b border-white/10 bg-white/10">
                          <th className="px-4 py-3 font-semibold text-xs tracking-wide">
                            Job No
                          </th>
                          <th className="px-4 py-3 font-semibold text-xs tracking-wide">
                            CHS
                          </th>
                          <th className="px-4 py-3 font-semibold text-xs tracking-wide">
                            MS
                          </th>
                          <th className="px-4 py-3 font-semibold text-xs tracking-wide">
                            Cargo Type
                          </th>
                          <th className="px-4 py-3 font-semibold text-xs tracking-wide">
                            Date of Job
                          </th>
                          <th className="px-4 py-3 font-semibold text-xs tracking-wide">
                            Client
                          </th>
                          <th className="px-4 py-3 font-semibold text-xs tracking-wide">
                            Agent
                          </th>
                          <th className="px-4 py-3 font-semibold text-xs tracking-wide">
                            Quantity cargo
                          </th>
                          <th className="px-4 py-3 font-semibold text-xs tracking-wide">
                            Used Hours
                          </th>
                          <th className="px-4 py-3 font-semibold text-xs tracking-wide">
                            Usage Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedHistoryRows.map((h, idx) => (
                          <tr
                            key={`${h.jobNo || idx}-${idx}`}
                            className="border-b border-white/5 hover:bg-white/5 transition"
                          >
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center rounded-full bg-sky-500/15 px-3 py-1 text-[10px] font-semibold text-sky-100 border border-sky-400/70">
                                {h.jobNo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-50 font-medium">
                              {h.chs}
                            </td>
                            <td className="px-4 py-3 text-slate-50 font-medium">
                              {h.ms}
                            </td>
                            <td className="px-4 py-3 text-slate-100">
                              {h.typeOfCargo}
                            </td>
                            <td className="px-4 py-3 text-slate-100">
                              {formatDateTime(h.dateOfJob)}
                            </td>
                            <td className="px-4 py-3 text-slate-100">
                              {h.client}
                            </td>
                            <td className="px-4 py-3 text-slate-100">
                              {h.agent}
                            </td>
                            <td className="px-4 py-3 text-slate-100">
                              {h.quantityCargo}
                            </td>
                            <td className="px-4 py-3 text-slate-100">
                              {h.usedHours ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 border border-emerald-400/60 text-emerald-200">
                                {h.usageStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <OperationsListPaginationFooter
                    {...historyRowsPaginationFooterProps}
                    className="overflow-visible"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}