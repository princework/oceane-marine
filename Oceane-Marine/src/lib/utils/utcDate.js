/** Start of calendar day in UTC */
export function startOfUtcDay(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

/** Add calendar days in UTC */
export function addUtcDays(utcDayStart, days) {
  const x = new Date(utcDayStart);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

/** Whole UTC calendar days from `from` to `to` (non-negative). */
export function diffUtcCalendarDays(from, to) {
  const a = startOfUtcDay(from).getTime();
  const b = startOfUtcDay(to).getTime();
  return Math.floor((b - a) / 86400000);
}

/** Same UTC calendar day */
export function isSameUtcDate(a, b) {
  if (!a || !b) return false;
  return startOfUtcDay(a).getTime() === startOfUtcDay(b).getTime();
}
