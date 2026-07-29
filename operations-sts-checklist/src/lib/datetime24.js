/**
 * Utilities for 24-hour date/time values compatible with datetime-local format (YYYY-MM-DDTHH:mm).
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Convert Date or ISO string to local YYYY-MM-DDTHH:mm for form controls. */
export function toDateTimeLocalValue(dateValue) {
  if (!dateValue) return "";
  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Parse YYYY-MM-DDTHH:mm (local) to Date for API payloads. */
export function parseDateTimeLocalValue(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export const HOURS_24 = Array.from({ length: 24 }, (_, i) => pad2(i));
export const MINUTES_60 = Array.from({ length: 60 }, (_, i) => pad2(i));
