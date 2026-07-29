import fs from "node:fs/promises";
import path from "node:path";
import {
  saveSignatureBufferToPublic as saveSignatureBufferToPublicCore,
  getSignatureAbsolutePathForRead,
} from "./signature-storage.js";

export { getSignatureAbsolutePathForRead };

/** @deprecated Use getSignatureAbsolutePathForRead */
export function getQhseSignatureAbsolutePathForRead(storedValue) {
  return getSignatureAbsolutePathForRead(storedValue);
}

/**
 * Sanitize a name for use in file/directory paths.
 * Replaces spaces and special characters with hyphens, collapses multiples.
 */
export function sanitizeName(name) {
  if (!name || typeof name !== "string") return "unknown";
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    || "unknown";
}

/**
 * Extract a short form code from a full form code string.
 * e.g. "QAF-OFD-004" -> "OFD-004", "HSE-001B" -> "HSE-001B"
 */
export function shortFormCode(fullCode) {
  if (!fullCode) return "UNKNOWN";
  const str = String(fullCode).trim();
  // Strip "QAF-" prefix if present
  if (str.startsWith("QAF-")) return str.slice(4);
  return str;
}

/**
 * Build a relative directory path for QHSE file storage.
 *
 * Structure: uploads/QHSE/{formCode}/{location?}/{YYYY}/{MM}/{DD}/{title}/{fileType}
 *
 * @param {object} opts
 * @param {string} opts.formCode  - Full or short form code (e.g. "QAF-OFD-004" or "OFD-004")
 * @param {string} [opts.location] - Location name (skip folder level if falsy)
 * @param {Date|string} opts.date  - Date for year/month/day folders
 * @param {string} opts.title      - Record title / identifier
 * @param {string} opts.fileType   - "documents" | "signatures" | "attachments"
 * @returns {string} Relative directory path
 */
export function buildQhsePath({ formCode, location, date, title, fileType }) {
  const code = shortFormCode(formCode);
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const safeTitle = sanitizeName(title || "untitled");
  const safeType = sanitizeName(fileType || "documents");

  const parts = ["uploads", "QHSE", code];
  if (location) parts.push(sanitizeName(location));
  parts.push(yyyy, mm, dd, safeTitle, safeType);

  return parts.join("/");
}

/**
 * Save a buffer to the QHSE file storage structure.
 *
 * @param {object} opts
 * @param {string} opts.formCode
 * @param {string} [opts.location]
 * @param {Date|string} opts.date
 * @param {string} opts.title
 * @param {string} opts.fileType  - "documents" | "signatures" | "attachments"
 * @param {string} opts.fileName  - Original filename
 * @param {Buffer} opts.buffer    - File contents
 * @returns {Promise<string>} Relative file path (e.g. "uploads/QHSE/OFD-004/Dubai/2026/02/12/Report/documents/17081234-file.docx")
 */
export async function saveQhseFile({ formCode, location, date, title, fileType, fileName, buffer }) {
  const dirRelative = buildQhsePath({ formCode, location, date, title, fileType });
  const dirAbsolute = path.join(process.cwd(), dirRelative);
  await fs.mkdir(dirAbsolute, { recursive: true });

  const safeName = `${Date.now()}-${sanitizeName(fileName || "file")}`;
  // Preserve original extension
  const ext = path.extname(fileName || "");
  const finalName = ext && !safeName.endsWith(ext) ? `${safeName}${ext}` : safeName;

  const filePath = path.join(dirRelative, finalName);
  const absPath = path.join(process.cwd(), filePath);
  await fs.writeFile(absPath, buffer);

  return filePath;
}

/**
 * QHSE signatures: public/signature/qhse/{submodule}/YYYY/MM/DD/
 *
 * @param {object} opts
 * @param {string} opts.formSlug - Submodule folder, e.g. "audit-sub-contractor"
 * @param {Date|string} opts.date
 * @param {string} opts.fileName
 * @param {Buffer} opts.buffer
 */
export async function saveSignatureBufferToPublic({ formSlug, date, fileName, buffer }) {
  return saveSignatureBufferToPublicCore({
    moduleName: "qhse",
    submoduleName: formSlug,
    date,
    fileName,
    buffer,
  });
}

/**
 * Decode a base64 data URL and save as a file.
 * Signature images (fileType "signatures") are stored under public/signature/qhse/{submodule}/YYYY/MM/DD/.
 * Other file types use uploads/QHSE/...
 *
 * @param {object} opts
 * @param {string} opts.formCode
 * @param {string} [opts.formSlug] - Required for signatures; e.g. "audit-sub-contractor". Falls back to lowercased short form code.
 * @param {string} [opts.location]
 * @param {Date|string} opts.date
 * @param {string} opts.title
 * @param {string} opts.fileType  - "documents" | "signatures" | "attachments"
 * @param {string} opts.fileName  - Desired filename (extension derived from mime when missing)
 * @param {string} opts.base64DataUrl - e.g. "data:image/png;base64,iVBOR..."
 * @returns {Promise<string|null>} Public URL for signatures (/signature/...) or relative uploads path for documents
 */
export async function saveBase64AsFile({
  formCode,
  formSlug,
  location,
  date,
  title,
  fileType,
  fileName,
  base64DataUrl,
}) {
  if (!base64DataUrl || typeof base64DataUrl !== "string") return null;

  let buffer;
  let ext = ".png";

  const dataUrlMatch = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1];
    const b64 = dataUrlMatch[2];
    buffer = Buffer.from(b64, "base64");
    const mimeToExt = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "application/pdf": ".pdf",
      "application/msword": ".doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
      "application/vnd.ms-excel": ".xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    };
    ext = mimeToExt[mime] || ".bin";
  } else if (/^[A-Za-z0-9+/=\r\n]+$/.test(base64DataUrl.trim())) {
    buffer = Buffer.from(base64DataUrl.trim(), "base64");
  } else {
    return null;
  }

  const ft = fileType || "signatures";
  const safeName = sanitizeName(fileName || "file");
  const fullFileName = `${safeName}${ext}`;

  if (ft === "signatures") {
    const rawSlug = typeof formSlug === "string" ? formSlug.trim() : "";
    const slug = rawSlug
      ? sanitizeName(rawSlug)
      : sanitizeName(shortFormCode(formCode)).toLowerCase();
    return saveSignatureBufferToPublic({
      formSlug: slug,
      date,
      fileName: fullFileName,
      buffer,
    });
  }

  return saveQhseFile({
    formCode,
    location,
    date,
    title,
    fileType: ft,
    fileName: fullFileName,
    buffer,
  });
}

/**
 * Check if a string looks like a base64 data URL (image or document).
 */
export function isBase64DataUrl(value) {
  if (!value || typeof value !== "string") return false;
  return /^data:[^;]+;base64,/.test(value);
}
