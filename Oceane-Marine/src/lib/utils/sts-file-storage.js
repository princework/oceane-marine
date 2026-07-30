import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

/**
 * Shared disk storage for STS operation documents.
 *
 * Previously duplicated verbatim in the create and update routes; extracted so the
 * email import path writes files exactly the same way the form does. Path shape and
 * filename scheme are unchanged, so paths already stored on existing records stay valid.
 */

const PUBLIC_PREFIX = "/uploads/sts-operations";

/** Date-partitioned sub-path, e.g. "chs/2026/07/29". */
function datedSubPath(subfolder) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${subfolder}/${y}/${m}/${d}`;
}

/** Strip anything that could escape the upload directory or confuse the web server. */
export function sanitizeFileName(name) {
  const safe = String(name || "").replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || "attachment";
}

/**
 * Map a document field name to the folder its file belongs in.
 * Mirrors the branching the create/update routes used inline.
 */
export function subfolderForField(field) {
  if (field === "mooringPlan") return "mooring-plan";
  if (String(field).startsWith("ms")) return "ms";
  if (String(field).startsWith("chs")) return "chs";
  return field;
}

/**
 * Persist raw bytes and return the public path to store on the operation record.
 * @returns {Promise<string>} e.g. "/uploads/sts-operations/chs/2026/07/29/1753…-Q88.pdf"
 */
export async function saveBufferAsFile(buffer, originalName, subfolder) {
  const relDir = datedSubPath(subfolder);
  const uploadDir = path.join(process.cwd(), "public", PUBLIC_PREFIX.slice(1), relDir);
  await fs.mkdir(uploadDir, { recursive: true });

  const fileName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(originalName)}`;
  await fs.writeFile(path.join(uploadDir, fileName), buffer);

  return `${PUBLIC_PREFIX}/${relDir}/${fileName}`;
}

/**
 * Persist a multipart `File` from a submitted form.
 * @returns {Promise<string>} public path
 */
export async function saveUploadedFile(file, subfolder) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return saveBufferAsFile(buffer, file.name, subfolder);
}
