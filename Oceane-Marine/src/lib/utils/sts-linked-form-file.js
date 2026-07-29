/** Stored on StsOperation.documents.documentType for paper uploads (must not equal raw OPS-OFD-xxx or jobs will replace them). */
export const HARDCOPY_DOC_PREFIX = "HARDCOPY:";

/**
 * Latest hardcopy file path for a linked form row (paper upload from STS Checklist).
 *
 * @param {Array<{ documentType?: string, filePath?: string, source?: string, uploadedAt?: Date | string }>|undefined} documents
 * @param {string} formCode — e.g. OPS-OFD-001, OPS-OFD-014-B
 * @returns {string|null}
 */
export function resolveChecklistHardcopyPath(documents, formCode) {
  if (!documents?.length || !formCode) return null;
  const keysToMatch = new Set([`${HARDCOPY_DOC_PREFIX}${formCode}`]);
  if (formCode === "OPS-OFD-014-B" || formCode === "OPS-OFD-014-A") {
    keysToMatch.add(`${HARDCOPY_DOC_PREFIX}OPS-OFD-014`);
  }
  const matched = documents.filter(
    (d) =>
      d?.filePath &&
      d.source === "CHECKLIST_HARDCOPY" &&
      typeof d.documentType === "string" &&
      keysToMatch.has(d.documentType)
  );
  if (!matched.length) return null;
  const sorted = [...matched].sort(
    (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
  );
  return sorted[0].filePath;
}

/**
 * Resolve file URL/path for a linked checklist row from STS operation.documents.
 * Prefers entry tied to the specific checklist Mongo _id, else latest uploadedAt for that documentType.
 *
 * @param {Array<{ documentType?: string, filePath?: string, checklistId?: import("mongoose").Types.ObjectId | string, uploadedAt?: Date | string }>|undefined} documents
 * @param {string} formCode
 * @param {string|import("mongoose").Types.ObjectId|undefined|null} checklistDocId - latest linked checklist _id from linked-forms API
 * @returns {string|null}
 */
export function resolveLinkedFormFilePath(documents, formCode, checklistDocId) {
  if (!documents?.length || !formCode) return null;
  const list = documents.filter((d) => d?.filePath && d.documentType === formCode);
  if (!list.length) return null;
  const sid = checklistDocId != null ? String(checklistDocId) : null;
  if (sid) {
    const byChecklist = list.find(
      (d) => d.checklistId != null && String(d.checklistId) === sid
    );
    if (byChecklist) return byChecklist.filePath;
  }
  const sorted = [...list].sort(
    (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
  );
  return sorted[0].filePath;
}
