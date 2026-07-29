/**
 * Canonical QHSE form codes (aligned with controlled document register).
 * Used by Mongoose models and API routes via getQhseFormCode(key).
 */
export const QHSE_FORM_CODES = {
  NEAR_MISS: "QAF-OFD-015",
  DRILL_REPORT: "QAF-OFD-040",
  DRILL_PLAN: "QAF-OFD-040",
  POAC_CROSS_COMPETENCY: "QAF-OFD-009",
  MOC_MANAGEMENT_CHANGE: "QAF-OFD-058",
  TRAINING_RECORD: "QAF-OFD-039",
  TRAINING_PLAN: "QAF-OFD-038",
  RISK_ASSESSMENT: "QAF-OFD-006",
  TARGET_KPI: "HSE-001A",
  KPI_UPLOAD: "HSE-001B",
  VENDOR_SUPPLIER_APPROVAL: "QAF-OFD-037",
  STS_TRANSFER_LOCATION_QUEST: "QAF-OFD-049",
  STS_TRANSFER_AUDIT: "QAF-OFD-003",
  STS_EQUIPMENT_BASE_STOCK: "QAF-OFD-013",
  STS_BASE_AUDIT: "QAF-OFD-004",
  NEW_BASE_SETUP: "QAF-OFD-051",
  HSE_INDUCTION_CHECKLIST: "QAF-OFD-008",
  SUPPLIER_DUE_DILIGENCE: "QAF-OFD-043",
  SUB_CONTRACTOR_AUDIT: "QAF-OFD-055",
  EQUIPMENT_DEFECT: "QAF-OFD-025",
  BEST_PRACTICE: "QAF-BP",
  AUDIT_INSPECTION_PLANNER: "QAF-OFD-048",
};

/**
 * @param {keyof typeof QHSE_FORM_CODES} key
 * @returns {string | null}
 */
export function getQhseFormCode(key) {
  if (!key || typeof key !== "string") return null;
  return QHSE_FORM_CODES[key] ?? null;
}
