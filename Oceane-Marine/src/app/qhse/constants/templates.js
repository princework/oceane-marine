/**
 * QHSE form template paths (public/templates/controlled-register/).
 * Use for Template download links on form, list, and view pages.
 */
const TEMPLATE_BASE = "/templates/controlled-register";

export const QHSE_FORM_TEMPLATES = {
  "QAF-OFD-003": `${TEMPLATE_BASE}/QAF-OFD-003.docx`,
  "QAF-OFD-004": `${TEMPLATE_BASE}/QAF-OFD-004.docx`,
  "QAF-OFD-006": `${TEMPLATE_BASE}/QAF-OFD-006.xlsx`,
  /** Sub Contractor audit (blank file on disk remains QAF-OFD-055.docx) */
  "QAF-OFD-008": `${TEMPLATE_BASE}/QAF-OFD-055.docx`,
  "QAF-OFD-009": `${TEMPLATE_BASE}/QAF-OFD-009.docx`,
  "QAF-OFD-013": `${TEMPLATE_BASE}/QAF-OFD-013.docx`,
  "QAF-OFD-015": `${TEMPLATE_BASE}/QAF-OFD-015.docx`,
  "QAF-OFD-025": `${TEMPLATE_BASE}/QAF-OFD-025.xlsx`,
  "QAF-OFD-037": `${TEMPLATE_BASE}/QAF-OFD-037.xlsx`,
  "QAF-OFD-038": `${TEMPLATE_BASE}/QAF-OFD-038.docx`,
  "QAF-OFD-039": `${TEMPLATE_BASE}/QAF-OFD-039.docx`,
  "QAF-OFD-040": `${TEMPLATE_BASE}/QAF-OFD-040.docx`,
  "QAF-OFD-043": `${TEMPLATE_BASE}/QAF-OFD-043.docx`,
  "QAF-OFD-048": `${TEMPLATE_BASE}/QAF-OFD-048.xlsx`,
  "QAF-OFD-049": `${TEMPLATE_BASE}/QAF-OFD-049.docx`,
  "QAF-OFD-051": `${TEMPLATE_BASE}/QAF-OFD-051.docx`,
  "QAF-OFD-055": `${TEMPLATE_BASE}/QAF-OFD-055.docx`,
  "QAF-OFD-058": `${TEMPLATE_BASE}/QAF-OFD-058.docx`,
  "QAF-OFD-058A": `${TEMPLATE_BASE}/QAF-OFD-058A.docx`,
  "HSE-001A": `${TEMPLATE_BASE}/HSE-001-Objectives-Targets.xlsx`,
  "HSE-001B": `${TEMPLATE_BASE}/HSE-001-Objectives-Targets.xlsx`,
};

/** Get template path by form code, or null if not available */
export function getQhseTemplatePath(formCode) {
  return QHSE_FORM_TEMPLATES[formCode] ?? null;
}
