/**
 * Parse manual "Rev No" for Controlled Document Register entries (major.minor).
 * @param {unknown} raw
 * @returns {{ ok: true, revMajor: number, revMinor: number } | { ok: false, error: string }}
 */
export function parseControlledDocumentRevNo(raw) {
  const s = String(raw ?? "").trim();
  if (!s) {
    return { ok: false, error: "Rev No is required" };
  }
  const m = /^(\d{1,4})\.(\d{1,4})$/.exec(s);
  if (!m) {
    return {
      ok: false,
      error: "Rev No must be major.minor (e.g. 1.0 or 2.15)",
    };
  }
  const revMajor = Number.parseInt(m[1], 10);
  const revMinor = Number.parseInt(m[2], 10);
  if (!Number.isFinite(revMajor) || !Number.isFinite(revMinor)) {
    return { ok: false, error: "Invalid Rev No" };
  }
  if (revMajor < 0 || revMinor < 0) {
    return { ok: false, error: "Invalid Rev No" };
  }
  return { ok: true, revMajor, revMinor };
}
