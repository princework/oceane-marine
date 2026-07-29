import { connectDB } from "../../config/connection.js";
import WarehouseManagement from "../../mongodb/models/pms/WarehouseManagement";
import { diffUtcCalendarDays, isSameUtcDate, startOfUtcDay } from "../../utils/utcDate";
import { sendResendEmail } from "./sendResendEmail.js";
import { buildPmsWarehouseEstimatedEndOverdueEmail } from "./templates/Pms/warehouseEstimatedEndOverdue.js";

function parseRecipientList() {
  const raw =
    process.env.PMS_WAREHOUSE_OVERDUE_TO_EMAIL ||
    process.env.PMS_TEAM_EMAIL ||
    "";
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatDateUtcEnGb(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "—";
  }
}

/** Human-readable location from enum e.g. PORT_KHALIFA → Port Khalifa */
function formatLocationLabel(location) {
  if (!location || typeof location !== "string") return "—";
  return location
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * More than 2 full calendar days after estimated end (UTC): first eligible day is end + 3.
 * Override with PMS_WAREHOUSE_OVERDUE_MIN_DAYS_PAST_END (integer ≥ 1), default 3.
 */
function minDaysPastEstimatedEnd() {
  const raw = process.env.PMS_WAREHOUSE_OVERDUE_MIN_DAYS_PAST_END;
  if (raw == null || String(raw).trim() === "") return 3;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 1 ? n : 3;
}

/**
 * Daily job: NOT_COMPLETED warehouse rows with `estimatedEndDate` where today (UTC) is at least
 * N calendar days after that date; one email per record per `estimatedEndDate` (dedupe field on doc).
 *
 * @returns {Promise<{ candidates: number; sent: number; skipped: number; minDaysPastEnd: number; errors: string[] }>}
 */
export async function runPmsWarehouseEstimatedEndOverdueJob() {
  await connectDB();

  const recipients = parseRecipientList();
  const minDaysPastEnd = minDaysPastEstimatedEnd();
  const result = {
    candidates: 0,
    sent: 0,
    skipped: 0,
    minDaysPastEnd,
    errors: [],
  };

  if (recipients.length === 0) {
    result.errors.push(
      "No recipients: set PMS_WAREHOUSE_OVERDUE_TO_EMAIL (comma-separated) or PMS_TEAM_EMAIL"
    );
    return result;
  }

  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
    result.errors.push("Resend not configured: RESEND_API_KEY and RESEND_FROM_EMAIL required");
    return result;
  }

  const todayStart = startOfUtcDay(new Date());

  const rows = await WarehouseManagement.find({
    isDeleted: { $ne: true },
    status: "NOT_COMPLETED",
    estimatedEndDate: { $exists: true, $ne: null },
  }).lean();

  for (const row of rows) {
    const endRaw = row.estimatedEndDate;
    if (!endRaw) continue;

    const endStart = startOfUtcDay(endRaw);
    const daysPastEnd = diffUtcCalendarDays(endStart, todayStart);
    if (!Number.isFinite(daysPastEnd) || daysPastEnd < minDaysPastEnd) continue;

    result.candidates += 1;

    const sentFor = row.pmsWarehouseEndOverdueEmailSentForEstimatedEndDate;
    if (sentFor && isSameUtcDate(sentFor, endRaw)) {
      result.skipped += 1;
      continue;
    }

    const equipmentName = row.equipment?.trim() || "—";
    const locationLabel = formatLocationLabel(row.location);
    const estimatedEndDateFormatted = formatDateUtcEnGb(endRaw);

    try {
      const { subject, html, text } = buildPmsWarehouseEstimatedEndOverdueEmail({
        equipmentName,
        locationLabel,
        estimatedEndDateFormatted,
      });

      await sendResendEmail({ to: recipients, subject, html, text });

      await WarehouseManagement.updateOne(
        { _id: row._id },
        { $set: { pmsWarehouseEndOverdueEmailSentForEstimatedEndDate: endRaw } }
      );

      result.sent += 1;
    } catch (e) {
      result.errors.push(`${row._id}: ${e.message || e}`);
    }
  }

  return result;
}
