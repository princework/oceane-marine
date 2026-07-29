/**
 * STS operation reference: calendar year + monotonic counter per year.
 * Examples: 2026-001 … 2026-099, then 2026-100, 2026-101 (no leading zeros beyond 3-digit minimum width).
 */
export function formatStsOperationRef(year, seq) {
  return `${year}-${String(seq).padStart(3, "0")}`;
}
