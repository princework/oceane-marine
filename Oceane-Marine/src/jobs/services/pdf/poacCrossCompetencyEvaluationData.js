/**
 * Shared checklist structure for POAC Cross Competency (Word + PDF exports).
 */

/**
 * Word/PDF header meta (4th line): workflow status.
 * @param {object} record – PoacCrossCompetency document
 * @returns {string}
 */
export function poacCrossStatusForHeader(record) {
  const s = record?.status;
  if (s == null || String(s).trim() === "") return "Draft";
  return String(s).trim();
}

export const EVALUATION_CATEGORIES = [
  { name: "Prior to commencement of Operations", start: 1, end: 9 },
  { name: "Mobilization", start: 10, end: 15 },
  { name: "Rigging of vessel", start: 16, end: 23 },
  { name: "Approach and mooring operation", start: 24, end: 42 },
  { name: "Hose connection", start: 43, end: 48 },
  { name: "Cargo operations", start: 49, end: 51 },
  { name: "Hose draining and disconnection", start: 52, end: 56 },
  { name: "Unmooring", start: 57, end: 62 },
  { name: "De-Mobilization", start: 63, end: 66 },
  { name: "General", start: 67, end: 71 },
  { name: "Office Requirements", start: 72, end: 75 },
];

const AREA_STRINGS = [
  "Suitability of vessels checked. (Mooring plans, STS plans and Q88s reviewed)",
  "Risk assessments and JPO reviewed",
  "Ship standard Questionnaire reviewed",
  "Checked if nighttime berthing is allowed",
  "Weather forecasts reviewed",
  "Traffic Density with regards to STS Location Considered",
  "Suitable anchoring location with regard to vessel draft etc",
  "Length of hose string requirements checked",
  "Copies of valid STS gear equipment certification",
  "Information shared with the vessel for arrival and POAC boarding",
  "Safety meeting with support craft crew",
  "Condition of Fender and Hoses checked",
  "Moorings and additional equipment checked (i.e., split pins, bolts, nuts, gaskets, personnel basket)",
  "Conditions of hose lifting slings used",
  "Transfer of equipment on support craft",
  "Safety meeting conducted with crew and Master",
  "Communication skills with crew",
  "Inspection of Mooring Winches and associated mooring gears",
  "Safety awareness",
  "Communication with support craft",
  "Rigging of Primary /Secondary Fenders",
  "Readiness to heave up anchor /Readiness of Mooring stations",
  "Navigation warning broadcast",
  "Safety Meeting conducted with crew. (Including snap back zone awareness)",
  "Approach and Mooring Plan discussed with Master",
  "ME Testing prior to use",
  "Agreed means of communication VHF Channel",
  "Discussed emergency procedures and ME speed -Manoeuvring",
  "OCIMF Checklist complied with",
  "Proper handover of command",
  "Communication with bridge team / exchange of information",
  "Regular monitoring of traffic and vessel's speed",
  "Control of mooring operation",
  "Check status of impressed current system",
  "Interaction",
  "Status of radars",
  "Parallel landing",
  "Angle of approach",
  "Positioning of vessel",
  "Checking helm indicator",
  "Manoeuvring vessels to anchor",
  "Communication during approach and mooring",
  "Safety Meeting conducted with crew",
  "Crane's operational readiness and condition",
  "Checking manifold connection",
  "Cargo hazard precautions explained to crew. (i.e., H2S monitors for personnel)",
  "MSDS for the cargo obtained",
  "Hose String and gasket connections",
  "Safety Meeting conducted with crew. (Including instruction to regularly tend vessel and fender moorings)",
  "OCIMF STS Checklists complied",
  "Deck rounds and Manifold pressure monitored",
  "Authorities informed of completion of transfer",
  "Safety meeting conducted with crew",
  "Cargo hose draining and hose disconnection",
  "Hoses blanked with bolts inward",
  "Informed office to arrange support craft for demobilisation",
  "Safety Meeting conducted with crew",
  "Avoided crossing ahead",
  "OCIMF STS Checklists completed",
  "Ship handling skills",
  "Regular monitoring of Swell and wind direction",
  "Unmooring plan discussed",
  "Safety meeting conducted with crew",
  "Communication skills with crew",
  "Offloading hoses to the support craft",
  "De-rigging Primary /Secondary Fenders",
  "Control during operations",
  "Weather forecasts reviewed regularly",
  "Care of STS equipment",
  "Use of PPE",
  "General Safety awareness",
  "Regular operational updates",
  "Timely reporting of issues (Advisement of issues in good time to allow for prompt action)",
  "General communication with Operations Team",
  "Correctly completing and efficiently submitting STS documentation",
];

/** srNo (1–75) → default area text */
export const POAC_CROSS_DEFAULT_AREAS = {};
AREA_STRINGS.forEach((area, i) => {
  POAC_CROSS_DEFAULT_AREAS[i + 1] = area;
});
