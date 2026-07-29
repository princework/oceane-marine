/**
 * Shared helper for archiving QHSE documents from list views.
 * Archived items appear in QHSE Archive, filterable by module (submodule folder).
 */

const ARCHIVE_MODULES = {
  EQUIPMENT_DEFECTS: "Equipment Defects",
  BEST_PRACTICE: "Best Practice",
  RISK_ASSESSMENT: "Risk Assessment",
  POAC_CROSS_COMPETENCY: "POAC Cross Competency",
  TARGET_KPI: "Target KPI",
  KPI_UPLOAD: "KPI",
  MOC_MANAGEMENT_CHANGE: "MOC Management Change",
  MOC_RISK_ASSESSMENT: "MOC Risk Assessment",
  BASE_AUDIT: "Base Audit",
  TRANSFER_AUDIT: "Transfer Audit",
  TRANSFER_LOCATION_QUEST: "Transfer Location Questionnaire",
  NEW_BASE_SETUP: "New Base Setup",
  HSE_INDUCTION_CHECKLIST: "HSE Induction Checklist",
  EQUIPMENT_BASE_STOCK: "Equipment Base Stock Level",
  AUDIT_INSPECTION_PLANNER: "Audit & Inspection Planner",
  NEAR_MISS: "Near Miss",
  DRILLS: "Drills",
  TRAINING: "Training",
  DUE_DILIGENCE_QUESTIONNAIRE: "Due Diligence Questionnaire",
  AUDIT_SUB_CONTRACTOR: "Audit Sub Contractor",
  VENDOR_SUPPLY: "Vendor Supply",
};

/**
 * Maps human-readable module labels (ARCHIVE_MODULES values) to
 * the stable registry key used by the generic archive-record API.
 * Lets the server also flip `isArchived = true` on the source document
 * so the record disappears from its module's active list after archiving.
 * Modules not listed here (e.g. Drills, Training) only create an archive
 * catalog entry and are NOT removed from their active lists.
 */
const ARCHIVE_LABEL_TO_MODULE_KEY = {
  "Equipment Defects": "equipment-defect",
  "Best Practice": "best-practice",
  "Risk Assessment": "risk-assessment",
  "POAC Cross Competency": "poac-cross-competency",
  "Target KPI": "target-kpi",
  KPI: "kpi-upload",
  "MOC Management Change": "moc-management-change",
  "MOC Risk Assessment": "moc-risk-assessment",
  "Base Audit": "base-audit",
  "Transfer Audit": "transfer-audit",
  "Transfer Location Questionnaire": "transfer-location-quest",
  "New Base Setup": "new-base-setup",
  "HSE Induction Checklist": "hse-induction-checklist",
  "Equipment Base Stock Level": "equipment-base-stock",
  "Audit & Inspection Planner": "audit-inspection-planner",
  "Near Miss": "near-miss",
  "Due Diligence Questionnaire": "due-diligence-questionnaire",
  "Audit Sub Contractor": "audit-sub-contractor",
  "Vendor Supply": "vendor-supply",
};

/**
 * Build payload for archive create API.
 * @param {string} moduleName - One of ARCHIVE_MODULES values or custom label
 * @param {object} item - The list row document (must have _id)
 * @param {string} [title] - Optional title override; otherwise derived from item
 * @param {string} [formCode] - Optional formCode override
 */
export function buildArchivePayload(moduleName, item, title = "", formCode = "") {
  const originalId = item?._id ? String(item._id) : "";
  const year = new Date().getFullYear();
  const firstAtt = Array.isArray(item?.attachments) && item.attachments[0];
  const filePath =
    item?.filePath ||
    item?.localPath ||
    item?.attachment?.filePath ||
    firstAtt?.filePath ||
    firstAtt?.path ||
    "";
  const fileUrl = item?.fileUrl || item?.attachment?.fileUrl || "";
  const label = String(moduleName).trim();
  return {
    year,
    module: label,
    documentType: label,
    formCode: formCode || item?.formCode || "",
    title: title || item?.equipmentDefect || item?.description || item?.locationName || item?.nameOfPOAC || item?.proposedChange || item?.formCode || originalId || "Archived document",
    originalId,
    filePath: filePath ? String(filePath).trim() : "",
    fileUrl: fileUrl ? String(fileUrl).trim() : "",
    metadata: item ? { ...item } : undefined,
    // Registry key used by the server to flip isArchived on the source doc.
    sourceModuleKey: ARCHIVE_LABEL_TO_MODULE_KEY[label] || null,
  };
}

/**
 * Call the archive API to store a document.
 * @param {object} payload - From buildArchivePayload()
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function archiveDocument(payload) {
  const res = await fetch("/api/qhse/archive/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error || "Failed to archive" };
  }
  return { success: true };
}

export { ARCHIVE_MODULES, ARCHIVE_LABEL_TO_MODULE_KEY };
