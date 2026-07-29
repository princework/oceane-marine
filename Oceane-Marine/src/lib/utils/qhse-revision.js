/**
 * QHSE revision number helper.
 * New form = 1.0; each revision = 1.1, 1.2, 1.3, ...
 *
 * @param {string} current - Current revision (e.g. "1.0", "1.1")
 * @returns {string} Next revision (e.g. "1.1", "1.2")
 */
export function getNextRevisionNumber(current) {
  if (!current || typeof current !== "string") return "1.1";
  const parts = current.trim().split(".");
  const major = parseInt(parts[0], 10) || 1;
  const minor = parseInt(parts[1], 10) || 0;
  return `${major}.${minor + 1}`;
}

/**
 * Default revision for a new form.
 */
export const DEFAULT_REVISION = "1.0";
