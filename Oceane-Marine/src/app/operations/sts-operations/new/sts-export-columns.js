/**
 * Excel export: columns and values are taken from inside each record
 * in the exact order they appear in the record view (View STS Operation).
 * One row per record, one column per record field.
 */
import { STS_DOCUMENT_FIELDS, fieldStatus } from "./document-fields";

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function formatDateTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function barrels(mt) {
  if (mt == null || isNaN(mt)) return "";
  return (Number(mt) * 7.33).toFixed(2);
}
function str(op, key) {
  const v = op?.[key];
  if (v == null || v === "") return "";
  return String(v).trim();
}
function refName(op, key) {
  const ref = op?.[key];
  if (!ref || typeof ref !== "object") return "";
  return ref?.name ?? "";
}

/** Document field keys in the order they appear in the record view (Pre-STS, then CHS docs, then MS docs, then rest). */
const VIEW_DOCUMENT_KEYS = [
  "jpo", "riskAssessment", "mooringPlan",
  "chsSSQ", "chsQ88", "chsMooringArrangement", "chsGAPlan", "chsMSDS", "chsIndemnity",
  "msSSQ", "msQ88", "msMooringArrangement", "msGAPlan", "msMSDS", "msIndemnity",
  "DeclarationAtSea", "checklist1", "checklist2", "checklist3AB", "checklist4AF", "checklist5AC", "checklist6AB", "checklist7",
  "stsTimesheet", "standingOrder", "stsEquipChecklistPriorOps", "stsEquipChecklistAfterOps",
  "chsFeedback", "msFeedback", "hourlyChecks", "restHoursCKL", "incidentReporting",
  "documents",
];

function getDocLabel(key) {
  const e = STS_DOCUMENT_FIELDS.find((f) => f.key === key);
  return e ? e.label : key;
}

/**
 * Export columns in the exact order of the record view: Operation Details,
 * CHS/MS Information, Pre-STS + document Yes/No columns, Equipment Used, Remarks.
 */
export function getExportColumns() {
  // 1. Operation Details (view order: status in header, then grid fields)
  const operationDetailColumns = [
    { label: "Status", getValue: (op) => str(op, "operationStatus") },
    { label: "Operation Ref No", getValue: (op) => str(op, "Operation_Ref_No") },
    { label: "Type of Operation", getValue: (op) => str(op, "typeOfOperation") },
    { label: "Client", getValue: (op) => str(op, "client") },
    { label: "Agent", getValue: (op) => str(op, "agent") },
    { label: "Location", getValue: (op) => op?.location?.name ?? "" },
    { label: "Mooring Master", getValue: (op) => refName(op, "mooringMaster") },
    { label: "Type of Cargo", getValue: (op) => op?.typeOfCargo?.type ?? "" },
    { label: "Operation Type", getValue: (op) => str(op, "operationType") },
    { label: "Quantity (MT)", getValue: (op) => (op?.quantity != null ? String(op.quantity) : "") },
    { label: "Quantity (Barrels)", getValue: (op) => barrels(op?.quantity) },
    { label: "Flow Direction", getValue: (op) => str(op, "flowDirection") },
    { label: "Operation Start Time", getValue: (op) => formatDateTime(op?.operationStartTime) },
    { label: "Operation End Time", getValue: (op) => formatDateTime(op?.operationEndTime) },
    { label: "Created At", getValue: (op) => formatDate(op?.createdAt) },
  ];

  // 2. CHS / MS Information (view order: CHS Name, MS Name, Vessel Type CHS, Vessel Type MS, LOA CHS, LOA MS)
  const chsMsColumns = [
    { label: "CHS Name", getValue: (op) => str(op, "chs") },
    { label: "MS Name", getValue: (op) => str(op, "ms") },
    { label: "Vessel Type (CHS)", getValue: (op) => str(op, "vesselTypeCHS") },
    { label: "Vessel Type (MS)", getValue: (op) => str(op, "vesselTypeMS") },
    { label: "LOA (CHS)", getValue: (op) => str(op, "loaCHS") },
    { label: "LOA (MS)", getValue: (op) => str(op, "loaMS") },
  ];

  // 3. Pre-STS + document columns in view order (Yes/No)
  const documentColumns = VIEW_DOCUMENT_KEYS.map((key) => ({
    label: getDocLabel(key),
    getValue: (op) => fieldStatus(op, key),
  }));

  // 4. Equipment & Remarks (view order, last in view)
  const equipmentRemarksColumns = [
    {
      label: "Equipment Used",
      getValue: (op) => {
        const list = op?.equipments;
        if (!list || !Array.isArray(list) || list.length === 0) return "";
        return list
          .map((eq) => eq?.equipment?.equipmentName ?? eq?.equipment?.name ?? "Equipment")
          .filter(Boolean)
          .join(", ");
      },
    },
    { label: "Remarks", getValue: (op) => str(op, "remarks") },
  ];

  return [...operationDetailColumns, ...chsMsColumns, ...documentColumns, ...equipmentRemarksColumns];
}

export function buildExportRow(op, columns) {
  return columns.map((col) => col.getValue(op));
}

export function buildExportHeaders(columns) {
  return columns.map((c) => c.label);
}
