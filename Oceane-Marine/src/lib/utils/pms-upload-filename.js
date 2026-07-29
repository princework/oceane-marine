/**
 * Sanitize a path segment (folder / equipment code). Dots are not allowed.
 */
export function sanitizePmsPathSegment(str) {
  return String(str || "").replace(/[^a-zA-Z0-9-_]/g, "_");
}

/**
 * Sanitize an uploaded file basename but keep a real extension (e.g. `.pdf`).
 * Applying {@link sanitizePmsPathSegment} to the full name turns `a.pdf` into `a_pdf`.
 */
export function sanitizePmsUploadedFileName(fileName) {
  const name = String(fileName || "");
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === name.length - 1) {
    return sanitizePmsPathSegment(name);
  }
  const base = name.slice(0, lastDot);
  const ext = name.slice(lastDot + 1);
  const safeBase = sanitizePmsPathSegment(base);
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "");
  return safeExt ? `${safeBase}.${safeExt.toLowerCase()}` : safeBase;
}
