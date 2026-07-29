/**
 * Utilities for 24-hour date/time values (YYYY-MM-DDTHH:mm).
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toDateTimeLocalValue(dateValue) {
  if (!dateValue) return "";
  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function parseDateTimeLocalValue(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatDateTime24(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export const HOURS_24 = Array.from({ length: 24 }, (_, i) => pad2(i));
export const MINUTES_60 = Array.from({ length: 60 }, (_, i) => pad2(i));
