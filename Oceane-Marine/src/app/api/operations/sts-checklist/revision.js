/**
 * Revision number logic for STS checklist forms:
 * - New form created → 1.0, next new form → 2.0, then 3.0, ...
 * - Edit existing form → 1.0 → 1.1 → 1.2, 2.0 → 2.1, ...
 * @param {import('mongoose').Model} Model - Mongoose model for the form collection
 * @returns {Promise<string>} e.g. "1.0", "2.0"
 */
export async function getNextRevisionForCreate(Model) {
  const count = await Model.countDocuments();
  const major = count + 1;
  return `${major}.0`;
}

/**
 * Increment revision minor for an update (edit): 1.0 → 1.1, 1.1 → 1.2, 1.2 → 1.3
 * @param {string|number} currentRevisionNo - e.g. "1.0", "1.2", "2.0", or 1 (will be converted to "1.0")
 * @returns {string} e.g. "1.1", "1.3", "2.1"
 */
export function incrementRevisionForUpdate(currentRevisionNo) {
  // Handle null/undefined
  if (!currentRevisionNo) {
    return "1.1";
  }

  // Convert to string if it's a number
  let revisionStr = typeof currentRevisionNo === "string" 
    ? currentRevisionNo.trim() 
    : String(currentRevisionNo).trim();

  // If it's just a number without decimal, add ".0"
  if (!revisionStr.includes(".")) {
    revisionStr = `${revisionStr}.0`;
  }

  const parts = revisionStr.split(".");
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);

  // Validate major version
  if (Number.isNaN(major) || major < 1) {
    return "1.1";
  }

  // Increment minor version (default to 0 if missing)
  const nextMinor = Number.isNaN(minor) || minor < 0 ? 1 : minor + 1;
  return `${major}.${nextMinor}`;
}
