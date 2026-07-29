import fs from "node:fs/promises";
import path from "node:path";

/**
 * Sanitize a single path segment (folder name).
 */
export function sanitizePathSegment(name) {
  if (!name || typeof name !== "string") return "unknown";
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "") || "unknown"
  );
}

/**
 * @param {object} opts
 * @param {string} opts.moduleName - e.g. "qhse", "operations"
 * @param {string} opts.submoduleName - e.g. "audit-sub-contractor", "sts-checklist-ops-ofd-028"
 * @param {Date|string} [opts.date]
 * @returns {{ physicalDir: string, urlDir: string }}
 */
export function buildSignatureDirs({ moduleName, submoduleName, date = new Date() }) {
  const mod = sanitizePathSegment(moduleName || "general");
  const sub = sanitizePathSegment(submoduleName || "general");
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const physicalDir = path.join("public", "signature", mod, sub, yyyy, mm, dd);
  const urlDir = `/signature/${mod}/${sub}/${yyyy}/${mm}/${dd}`;
  return { physicalDir, urlDir };
}

/**
 * Operations STS checklist: submodule folder from form code (e.g. OPS-OFD-028 → sts-checklist-ops-ofd-028).
 * @param {string} formCode
 */
export function operationsStsSubmoduleFolder(formCode) {
  const s = String(formCode).trim().toLowerCase().replace(/_/g, "-");
  return `sts-checklist-${s}`;
}

/**
 * @param {string} formCode - e.g. "OPS-OFD-028"
 * @param {Date} [date]
 */
export function buildOperationsStsSignatureDirs(formCode, date = new Date()) {
  return buildSignatureDirs({
    moduleName: "operations",
    submoduleName: operationsStsSubmoduleFolder(formCode),
    date,
  });
}

/**
 * Save a signature image buffer. Returns public URL path /signature/{module}/{submodule}/...
 *
 * @param {object} opts
 * @param {string} opts.moduleName
 * @param {string} opts.submoduleName
 * @param {Date|string} opts.date
 * @param {string} opts.fileName
 * @param {Buffer} opts.buffer
 * @returns {Promise<string>}
 */
export async function saveSignatureBufferToPublic({
  moduleName,
  submoduleName,
  date,
  fileName,
  buffer,
}) {
  const { physicalDir, urlDir } = buildSignatureDirs({
    moduleName,
    submoduleName,
    date,
  });
  const extFromName = path.extname(fileName || "");
  const stem = extFromName
    ? sanitizePathSegment(path.basename(fileName, extFromName)) || "signature"
    : sanitizePathSegment(fileName || "signature") || "signature";
  const ext = extFromName || ".png";
  const finalName = `${Date.now()}-${stem}${ext}`;
  const dirAbs = path.join(process.cwd(), physicalDir);
  await fs.mkdir(dirAbs, { recursive: true });
  const absFile = path.join(dirAbs, finalName);
  await fs.writeFile(absFile, buffer);
  return `${urlDir}/${finalName}`;
}

/**
 * Resolve a stored signature path to an absolute filesystem path for server reads (PDF, etc.).
 * Supports /signature/... and legacy uploads/...
 *
 * @param {string | null | undefined} storedValue
 * @returns {string | null}
 */
export function getSignatureAbsolutePathForRead(storedValue) {
  if (!storedValue || typeof storedValue !== "string") return null;
  const t = storedValue.trim();
  if (!t || t.startsWith("data:")) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) return null;
  if (t.startsWith("/signature/") || t.startsWith("signature/")) {
    const rel = t.startsWith("/") ? t.slice(1) : t;
    return path.join(process.cwd(), "public", rel);
  }
  if (t.startsWith("/uploads/") || t.startsWith("uploads/")) {
    const rel = t.replace(/^\/+/, "");
    return path.join(process.cwd(), rel);
  }
  return null;
}
