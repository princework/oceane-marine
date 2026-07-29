import {
  computeHose,
  computeFender,
} from "@/app/operations/sts-operations/new/compatibility/calculations";

/** Format a numeric value for display (trim trailing zeros, blank for null). */
export function formatCompatibilityNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 100) / 100);
}

export function buildCompatibilityDocumentValues(doc) {
  const STBL = doc.STBL || {};
  const SS = doc.SS || {};
  const hose = computeHose(STBL, SS);
  const fender = computeFender(STBL, SS);

  return {
    JOB_REF: doc.operationNumber || "",
    YEAR: doc.year != null ? String(doc.year) : "",
    LOCATION: doc.location?.name || "",
    SS_NAME: SS.name || "",
    STBL_NAME: STBL.name || "",

    // Hose
    POINT_A: formatCompatibilityNumber(hose.PointA),
    POINT_B: formatCompatibilityNumber(hose.PointB),
    POINT_C: formatCompatibilityNumber(hose.PointC),
    SS_MAXFB: formatCompatibilityNumber(SS.MaxFreeboard),
    SS_MINFB: formatCompatibilityNumber(SS.MinFreeboard),
    STBL_MAXFB: formatCompatibilityNumber(STBL.MaxFreeboard),
    STBL_MINFB: formatCompatibilityNumber(STBL.MinFreeboard),
    HOSE_LEN: formatCompatibilityNumber(hose.HoseCal),

    // Fender particulars
    SS_DWT: formatCompatibilityNumber(SS.DWT),
    SS_BEAM: formatCompatibilityNumber(SS.Beam),
    SS_DISP: formatCompatibilityNumber(SS.DISP),
    SS_DRAFT: formatCompatibilityNumber(SS.Draft),
    STBL_DWT: formatCompatibilityNumber(STBL.DWT),
    STBL_BEAM: formatCompatibilityNumber(STBL.Beam),
    STBL_DISP: formatCompatibilityNumber(STBL.DISP),
    STBL_DRAFT: formatCompatibilityNumber(STBL.Draft),

    // Fender coefficients
    EDC: formatCompatibilityNumber(fender.EDC),
    STBL_MASS: formatCompatibilityNumber(fender.STBLMassCoeff),
    SS_MASS: formatCompatibilityNumber(fender.SSMassCoeff),
    VDISP_STBL: formatCompatibilityNumber(fender.VirtDispSTBL),
    VDISP_SS: formatCompatibilityNumber(fender.VirtDispSS),
    CVD: formatCompatibilityNumber(fender.CVD),
    E_CALM: formatCompatibilityNumber(fender.EnergyCoeff_Calm),
    E_MOD: formatCompatibilityNumber(fender.EnergyCoeff_Moderate),
    E_ROUGH: formatCompatibilityNumber(fender.EnergyCoeff_Rough),

    // Fender selections
    F_CALM: fender.Fenderselect_Calm || "",
    F_MOD: fender.Fenderselect_Moderate || "",
    F_ROUGH: fender.Fenderselect_Rough || "",
  };
}

export function sanitizeCompatibilityFilename(name) {
  return String(name || "Compatibility").replace(/[^\w.-]+/g, "_").slice(0, 80);
}
