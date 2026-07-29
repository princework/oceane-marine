/**
 * Text positions on public/templates/Compatibility.pdf (A4, 3 pages).
 * Calibrated from a Word-generated reference PDF (correct layout baseline).
 * pdf-lib y = distance from bottom of page to text baseline.
 */
export const COMPATIBILITY_PDF_TEMPLATE = "public/templates/Compatibility.pdf";

/** @type {{ tag: string, page: number, x: number, y: number, size?: number, maxWidth?: number }[]} */
export const COMPATIBILITY_PDF_FIELDS = [
  // Page 1 — Hose calculations
  { tag: "JOB_REF", page: 0, x: 146.7, y: 708.7, size: 9 },
  { tag: "SS_NAME", page: 0, x: 103.3, y: 683.1, size: 9, maxWidth: 90 },
  { tag: "STBL_NAME", page: 0, x: 496.2, y: 683.4, size: 9, maxWidth: 90 },
  { tag: "POINT_A", page: 0, x: 153.9, y: 531.1, size: 9 },
  { tag: "POINT_B", page: 0, x: 464.3, y: 499.0, size: 9 },
  { tag: "POINT_C", page: 0, x: 306.3, y: 486.9, size: 9 },
  { tag: "SS_MAXFB", page: 0, x: 182.4, y: 390.4, size: 9 },
  { tag: "SS_MINFB", page: 0, x: 185.5, y: 360.9, size: 9 },
  { tag: "STBL_MAXFB", page: 0, x: 546.8, y: 388.6, size: 9 },
  { tag: "STBL_MINFB", page: 0, x: 548.9, y: 362.3, size: 9 },
  { tag: "HOSE_LEN", page: 0, x: 367.4, y: 234.1, size: 10 },
  // Page 2 — Fender calculations
  { tag: "SS_DWT", page: 1, x: 165.3, y: 638.6, size: 8, maxWidth: 70 },
  { tag: "SS_BEAM", page: 1, x: 174.4, y: 609.7, size: 8 },
  { tag: "SS_DISP", page: 1, x: 164.8, y: 581.4, size: 8, maxWidth: 70 },
  { tag: "SS_DRAFT", page: 1, x: 173.3, y: 553.1, size: 8 },
  { tag: "STBL_DWT", page: 1, x: 429.7, y: 641.6, size: 8, maxWidth: 70 },
  { tag: "STBL_BEAM", page: 1, x: 440.6, y: 613.4, size: 8 },
  { tag: "STBL_DISP", page: 1, x: 431.7, y: 584.5, size: 8, maxWidth: 70 },
  { tag: "STBL_DRAFT", page: 1, x: 441.5, y: 555.5, size: 8 },
  { tag: "EDC", page: 1, x: 242.6, y: 517.5, size: 7, maxWidth: 75 },
  { tag: "STBL_MASS", page: 1, x: 254.7, y: 492.7, size: 8 },
  { tag: "SS_MASS", page: 1, x: 255.4, y: 469.5, size: 8 },
  { tag: "VDISP_SS", page: 1, x: 241.7, y: 447.1, size: 7, maxWidth: 75 },
  { tag: "VDISP_STBL", page: 1, x: 241.5, y: 420.3, size: 7, maxWidth: 75 },
  { tag: "CVD", page: 1, x: 505.8, y: 519.1, size: 7, maxWidth: 65 },
  { tag: "E_CALM", page: 1, x: 510.7, y: 495.2, size: 7, maxWidth: 65 },
  { tag: "E_MOD", page: 1, x: 510.7, y: 472.7, size: 7, maxWidth: 65 },
  { tag: "E_ROUGH", page: 1, x: 510.5, y: 447.8, size: 7, maxWidth: 65 },
  { tag: "F_CALM", page: 1, x: 392, y: 127.1, size: 7, maxWidth: 180 },
  // Page 3 — Fenders required (moderate / rough)
  { tag: "F_MOD", page: 2, x: 387.1, y: 473.1, size: 7, maxWidth: 180 },
  { tag: "F_ROUGH", page: 2, x: 380.8, y: 153.7, size: 7, maxWidth: 180 },
];

export const COMPATIBILITY_REPORT_FIELDS = [
  "JOB_REF", "SS_NAME", "STBL_NAME", "POINT_A", "POINT_C", "POINT_B",
  "SS_MAXFB", "SS_MINFB", "STBL_MAXFB", "STBL_MINFB", "HOSE_LEN",
  "SS_DWT", "SS_BEAM", "SS_DISP", "SS_DRAFT", "STBL_DWT", "STBL_BEAM", "STBL_DISP", "STBL_DRAFT",
  "EDC", "STBL_MASS", "SS_MASS", "VDISP_STBL", "VDISP_SS", "CVD", "E_CALM", "E_MOD", "E_ROUGH",
  "F_CALM", "F_MOD", "F_ROUGH",
];

const overlayTags = new Set(COMPATIBILITY_PDF_FIELDS.map((f) => f.tag));
for (const tag of COMPATIBILITY_REPORT_FIELDS) {
  if (!overlayTags.has(tag)) {
    throw new Error(`Missing PDF overlay position for ${tag}`);
  }
}
