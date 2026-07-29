/**
 * All STS operation document/file fields to check for data existence (Yes/No).
 * Used in Documentation list table and Excel export.
 * Each entry: { key: field path on StsOperation, label: short header for table/CSV }
 */
export const STS_DOCUMENT_FIELDS = [
  // Pre-STS & core
  { key: "jpo", label: "JPO" },
  { key: "riskAssessment", label: "Risk Assessment" },
  { key: "mooringPlan", label: "Mooring Plan" },
  { key: "DeclarationAtSea", label: "Declaration at Sea" },
  // Checklists
  { key: "checklist1", label: "Checklist 1" },
  { key: "checklist2", label: "Checklist 2" },
  { key: "checklist3AB", label: "Checklist 3A&B" },
  { key: "checklist4AF", label: "Checklist 4A-F" },
  { key: "checklist5AC", label: "Checklist 5A-C" },
  { key: "checklist6AB", label: "Checklist 6A&B" },
  { key: "checklist7", label: "Checklist 7" },
  // Timesheet & orders
  { key: "stsTimesheet", label: "STS Timesheet" },
  { key: "standingOrder", label: "Standing Order" },
  // Equipment
  { key: "stsEquipChecklistPriorOps", label: "Equip CKL Before" },
  { key: "stsEquipChecklistAfterOps", label: "Equip CKL After" },
  // Feedback & logs
  { key: "chsFeedback", label: "CHS Feedback" },
  { key: "msFeedback", label: "MS Feedback" },
  { key: "hourlyChecks", label: "Hourly Checks" },
  { key: "restHoursCKL", label: "Rest Hours CKL" },
  { key: "incidentReporting", label: "Incident Reporting" },
  // CHS vessel documents
  { key: "chsSSQ", label: "CHS SSQ" },
  { key: "chsQ88", label: "CHS Q88" },
  { key: "chsMooringArrangement", label: "CHS Mooring Arr" },
  { key: "chsGAPlan", label: "CHS GA Plan" },
  { key: "chsMSDS", label: "CHS MSDS" },
  { key: "chsIndemnity", label: "CHS Indemnity" },
  // MS vessel documents
  { key: "msSSQ", label: "MS SSQ" },
  { key: "msQ88", label: "MS Q88" },
  { key: "msMooringArrangement", label: "MS Mooring Arr" },
  { key: "msGAPlan", label: "MS GA Plan" },
  { key: "msMSDS", label: "MS MSDS" },
  { key: "msIndemnity", label: "MS Indemnity" },
  // Generated/attached documents (op.documents array)
  { key: "documents", label: "Attached Docs", isArray: true },
];

/** Whether a value counts as "data exists" (Yes) */
export function hasData(value, isArray) {
  if (value == null) return false;
  if (isArray && Array.isArray(value)) return value.length > 0 && value.some((d) => d?.filePath?.trim?.());
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0 && value.some((d) => d?.filePath?.trim?.());
  return true;
}

/** Get display value Yes/No for a field on an operation record */
export function fieldStatus(op, fieldKey) {
  const entry = STS_DOCUMENT_FIELDS.find((e) => e.key === fieldKey);
  if (!entry) return "No";
  const value = entry.key === "documents" ? op?.documents : op?.[entry.key];
  return hasData(value, entry.isArray) ? "Yes" : "No";
}
