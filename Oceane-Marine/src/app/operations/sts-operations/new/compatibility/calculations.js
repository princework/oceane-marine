/**
 * Hose and Fender calculations - naming matches formulas.
 * All dimensions in meters; displacements in MT.
 */

const POINT_C = 3.5; // meters between ships

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Round to 2 decimal places for all result display */
const round2 = (x) => Math.round(Number(x) * 100) / 100;

/** Hose: MaxFreeboard, MinFreeboard, FreeboardDiff, HoseCal */
export function computeHose(STBL, SS) {
  const stbl = STBL || {};
  const ss = SS || {};
  const SS_MaxFreeboard = num(ss.MaxFreeboard);
  const STBL_Max_Freeboard = num(stbl.MaxFreeboard);
  const SS_MinFreeboard = num(ss.MinFreeboard);
  const STBL_MinFreeboard = num(stbl.MinFreeboard);
  const SS_Manifold_To_Rail = num(ss.ManifoldToRail);
  const STBL_Manifold_To_Rail = num(stbl.ManifoldToRail);

  const MaxFreeboard = SS_MaxFreeboard > STBL_Max_Freeboard ? SS_MaxFreeboard : STBL_Max_Freeboard;
  const MinFreeboard = SS_MinFreeboard < STBL_MinFreeboard ? SS_MinFreeboard : STBL_MinFreeboard;
  const FreeboardDiff = MaxFreeboard - MinFreeboard;
  const HoseCal = FreeboardDiff + SS_Manifold_To_Rail + STBL_Manifold_To_Rail + POINT_C;

  return {
    MaxFreeboard: round2(MaxFreeboard),
    MinFreeboard: round2(MinFreeboard),
    FreeboardDiff: round2(FreeboardDiff),
    PointA: round2(SS_Manifold_To_Rail),
    PointB: round2(STBL_Manifold_To_Rail),
    PointC: POINT_C,
    HoseCal: round2(HoseCal),
  };
}

/** Fender: EDC, mass coeffs, virtual disp, CVD, V, energy, fender selection */
function getV_Calm(CVD) {
  if (CVD < 10000) return 0.3;
  if (CVD <= 50000) return 0.25;
  if (CVD <= 100000) return 0.2;
  return 0.15;
}
function getV_Moderate(CVD) {
  if (CVD < 10000) return 0.4;
  if (CVD <= 50000) return 0.325;
  if (CVD <= 100000) return 0.25;
  return 0.2;
}
function getV_Rough(CVD) {
  if (CVD < 10000) return 0.5;
  if (CVD <= 50000) return 0.4;
  if (CVD <= 100000) return 0.3;
  return 0.25;
}

function fenderselectCalm(EDC) {
  if (EDC < 3000) return "3Nos x 1.5M x 3.0M";
  if (EDC < 6000) return "3Nos x 1.5M x 3.0M";
  if (EDC < 10000) return "3Nos x 2.5M x 5.5M";
  if (EDC < 30000) return "3Nos x 2.5M x 5.5M";
  if (EDC < 50000) return "4Nos x 3.3M x 6.5M";
  if (EDC < 100000) return "4Nos x 3.3M x 6.5M";
  if (EDC < 150000) return "4Nos x 3.3M x 6.5M";
  if (EDC < 200000) return "5Nos x 3.3M x 6.5M";
  if (EDC < 330000) return "5Nos x 3.3M x 6.5M";
  if (EDC < 500000) return "4Nos x 4.5M x 9.0M";
  return "4Nos x 4.5M x 9.0M";
}
function fenderselectModerate(EDC) {
  if (EDC < 3000) return "3Nos x 1.5M x 3.0M";
  if (EDC < 6000) return "3Nos x 1.5M x 3.0M";
  if (EDC < 10000) return "3Nos x 2.5M x 5.5M";
  if (EDC < 30000) return "3Nos x 2.5M x 5.5M";
  if (EDC < 50000) return "4Nos x 3.3M x 6.5M";
  if (EDC < 100000) return "4Nos x 3.3M x 6.5M";
  if (EDC < 150000) return "4Nos x 3.3M x 6.5M";
  if (EDC < 200000) return "5Nos x 3.3M x 6.5M";
  if (EDC < 330000) return "4Nos x 4.5M x 9.0M";
  if (EDC < 500000) return "4Nos x 4.5M x 9.0M";
  return "4Nos x 4.5M x 9.0M";
}
function fenderselectRough(EDC) {
  if (EDC < 3000) return "3Nos x 1.5M x 3.0M";
  if (EDC < 6000) return "3Nos x 2.5M x 5.5M";
  if (EDC < 10000) return "3Nos x 2.5M x 5.5M";
  if (EDC < 30000) return "3Nos x 2.5M x 5.5M";
  if (EDC < 50000) return "4Nos x 3.3M x 6.5M";
  if (EDC < 100000) return "5Nos x 3.3M x 6.5M";
  if (EDC < 150000) return "4Nos x 4.5M x 9.0M";
  if (EDC < 200000) return "4Nos x 4.5M x 9.0M";
  if (EDC < 330000) return "4Nos x 4.5M x 9.0M";
  if (EDC < 500000) return "5Nos x 4.5M x 9.0M";
  return "5Nos x 4.5M x 9.0M";
}

export function computeFender(STBL, SS) {
  const stbl = STBL || {};
  const ss = SS || {};
  const STBL_DISP = num(stbl.DISP);
  const SS_Disp = num(ss.DISP);
  // Support both Beam/beam and Draft/draft for API/form compatibility
  const STBL_Beam = num(stbl.Beam ?? stbl.beam);
  const SS_Beam = num(ss.Beam ?? ss.beam);
  const STBL_Draft = num(stbl.Draft ?? stbl.draft);
  const SS_Draft = num(ss.Draft ?? ss.draft);

  if (STBL_DISP + SS_Disp <= 0) {
    return {
      EDC: 0,
      STBLMassCoeff: 0,
      SSMassCoeff: 0,
      VirtDispSTBL: 0,
      VirtDispSS: 0,
      CVD: 0,
      V_Calm: 0,
      V_Moderate: 0,
      V_Rough: 0,
      VSqr_Calm: 0,
      Vsqr_Moderate: 0,
      Vsqr_Rough: 0,
      EnergyCoeff_Calm: 0,
      EnergyCoeff_Moderate: 0,
      EnergyCoeff_Rough: 0,
      Fenderselect_Calm: "",
      Fenderselect_Moderate: "",
      Fenderselect_Rough: "",
    };
  }

  const EDC = (2 * STBL_DISP * SS_Disp) / (STBL_DISP + SS_Disp);
  // Mass coefficient Cm = 1 + 2*(Draft/Beam) per standard; avoid division by zero
  const STBLMassCoeff = STBL_Beam > 0 ? 1 + (2 * STBL_Draft) / STBL_Beam : 0;
  const SSMassCoeff = SS_Beam > 0 ? 1 + (2 * SS_Draft) / SS_Beam : 0;
  const VirtDispSTBL = STBLMassCoeff * STBL_DISP;
  const VirtDispSS = SSMassCoeff * SS_Disp;
  const CVD =
    VirtDispSS + VirtDispSTBL > 0
      ? (VirtDispSS * VirtDispSTBL) / (VirtDispSS + VirtDispSTBL)
      : 0;

  const V_Calm = getV_Calm(CVD);
  const V_Moderate = getV_Moderate(CVD);
  const V_Rough = getV_Rough(CVD);
  const VSqr_Calm = V_Calm * V_Calm;
  const Vsqr_Moderate = V_Moderate * V_Moderate;
  const Vsqr_Rough = V_Rough * V_Rough;

  const EnergyCoeff_Calm = 0.5 * CVD * VSqr_Calm * 0.5 * 2;
  const EnergyCoeff_Moderate = 0.5 * CVD * Vsqr_Moderate * 0.5 * 2;
  const EnergyCoeff_Rough = 0.5 * CVD * Vsqr_Rough * 0.5 * 2;

  return {
    EDC: round2(EDC),
    STBLMassCoeff: round2(STBLMassCoeff),
    SSMassCoeff: round2(SSMassCoeff),
    VirtDispSTBL: round2(VirtDispSTBL),
    VirtDispSS: round2(VirtDispSS),
    CVD: round2(CVD),
    V_Calm: round2(V_Calm),
    V_Moderate: round2(V_Moderate),
    V_Rough: round2(V_Rough),
    VSqr_Calm: round2(VSqr_Calm),
    Vsqr_Moderate: round2(Vsqr_Moderate),
    Vsqr_Rough: round2(Vsqr_Rough),
    EnergyCoeff_Calm: round2(EnergyCoeff_Calm),
    EnergyCoeff_Moderate: round2(EnergyCoeff_Moderate),
    EnergyCoeff_Rough: round2(EnergyCoeff_Rough),
    Fenderselect_Calm: fenderselectCalm(EDC),
    Fenderselect_Moderate: fenderselectModerate(EDC),
    Fenderselect_Rough: fenderselectRough(EDC),
  };
}

export function computeAll(STBL, SS) {
  return {
    hose: computeHose(STBL, SS),
    fender: computeFender(STBL, SS),
  };
}
