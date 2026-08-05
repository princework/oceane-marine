import PoacMatrix from "@/lib/mongodb/models/hr/PoacMatrix";

/**
 * A mooring master (Operations' name) is the same person as a POAC (OCIMF's
 * regulatory name) — this maps a MooringMaster to their POAC Certification
 * Matrix row (HR) so Operations can warn before assigning someone whose
 * documents are incomplete or expired.
 */

const REQUIRED_YES_KEYS = ["validPassport", "validMastersCOC"];

const FIELD_LABELS = {
  validPassport: "Passport",
  validMastersCOC: "Master's COC",
  dangerousCargoEndorsementOil: "Dangerous cargo endorsement (Oil)",
  dangerousCargoEndorsementChem: "Dangerous cargo endorsement (Chem)",
  dangerousCargoEndorsementGas: "Dangerous cargo endorsement (Gas)",
  oilSpillResponseTraining: "Oil spill response training",
  stsSimulatorTraining: "STS Simulator training",
  vesselSizeLimitations: "Vessel Size Limitations",
  underwayOperations: "Underway operations",
  validMedicals: "Medicals",
};

const ALL_YES_NO_KEYS = Object.keys(FIELD_LABELS);

/**
 * @param {object|null} row - a PoacMatrix row (or null if the person has no POAC record at all)
 * @returns {{ compliant: boolean, issues: string[] }}
 */
export function evaluatePoacRowCompliance(row) {
  if (!row) {
    return { compliant: false, issues: ["No POAC Certification Matrix record on file"] };
  }

  const issues = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const key of ALL_YES_NO_KEYS) {
    const value = row[key];

    if (REQUIRED_YES_KEYS.includes(key) && value !== "Yes") {
      issues.push(`${FIELD_LABELS[key]} missing`);
      continue;
    }

    if (value === "Yes") {
      const expiry = row[`${key}Expiry`];
      if (expiry) {
        const expiryDate = new Date(expiry);
        if (!Number.isNaN(expiryDate.getTime()) && expiryDate < today) {
          issues.push(`${FIELD_LABELS[key]} expired`);
        }
      }
    }
  }

  return { compliant: issues.length === 0, issues };
}

/**
 * Resolves compliance for a set of mooring masters in one query. Where a person
 * appears in more than one POAC Matrix submission, the most recently updated
 * one wins.
 *
 * @param {Array<string|import("mongoose").Types.ObjectId>} mooringMasterIds
 * @returns {Promise<Map<string, { compliant: boolean, issues: string[] }>>}
 */
export async function getMooringMasterComplianceMap(mooringMasterIds) {
  const ids = [...new Set(mooringMasterIds.map(String))].filter(Boolean);
  const map = new Map();
  if (ids.length === 0) return map;

  const docs = await PoacMatrix.find({ "rows.mooringMasterId": { $in: ids } })
    .sort({ updatedAt: -1 })
    .lean();

  for (const doc of docs) {
    for (const row of doc.rows || []) {
      if (!row.mooringMasterId) continue;
      const key = String(row.mooringMasterId);
      if (map.has(key)) continue; // docs are sorted newest-first; first hit wins
      map.set(key, evaluatePoacRowCompliance(row));
    }
  }

  return map;
}
