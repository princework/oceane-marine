/**
 * jsPDF built-in Helvetica has no glyphs for many Unicode chars (e.g. ≥, em dash).
 * Those render as broken per-character spacing and clipping. Use for all dynamic PDF text.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function pdfSafeText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\u2265/g, ">=") // ≥
    .replace(/\u2264/g, "<=") // ≤
    .replace(/\u2014/g, "-") // em dash
    .replace(/\u2013/g, "-") // en dash
    .replace(/\u2011/g, "-") // non-breaking hyphen
    .replace(/\u00a0/g, " "); // nbsp
}
