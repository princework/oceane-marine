import { connectDB } from "../../config/connection.js";
import Equipment from "../../mongodb/models/pms/Equipment";
import { diffUtcCalendarDays, isSameUtcDate, startOfUtcDay } from "../../utils/utcDate";
import { sendResendEmail } from "./sendResendEmail.js";
import { buildPmsEquipmentTestingReminderEmail } from "./templates/Pms/equipmentTestingReminder.js";

function parseRecipientList() {
  const raw =
    process.env.PMS_TESTING_REMINDER_TO_EMAIL ||
    process.env.PMS_TEAM_EMAIL ||
    "";
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatTestDate(d) {
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

/**
 * Daily job: ACTIVE primary equipment with `nextTestDate` — send at 30 and 15 UTC calendar days before due date.
 * Dedupe per equipment per milestone per `nextTestDate` (fields on Equipment).
 */
export async function runPmsEquipmentTestingReminderJob() {
  await connectDB();

  const recipients = parseRecipientList();
  const result = {
    days30: { candidates: 0, sent: 0, skipped: 0 },
    days15: { candidates: 0, sent: 0, skipped: 0 },
    errors: [],
  };

  if (recipients.length === 0) {
    result.errors.push(
      "No recipients: set PMS_TESTING_REMINDER_TO_EMAIL (comma-separated) or PMS_TEAM_EMAIL"
    );
    return result;
  }

  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
    result.errors.push("Resend not configured: RESEND_API_KEY and RESEND_FROM_EMAIL required");
    return result;
  }

  const now = new Date();
  const todayStart = startOfUtcDay(now);

  const equipments = await Equipment.find({
    status: "ACTIVE",
    nextTestDate: { $exists: true, $ne: null },
  }).lean();

  for (const eq of equipments) {
    const nextRaw = eq.nextTestDate;
    if (!nextRaw) continue;

    const nextStart = startOfUtcDay(nextRaw);
    const daysUntil = diffUtcCalendarDays(todayStart, nextStart);
    if (!Number.isFinite(daysUntil) || daysUntil < 0) continue;

    const name = eq.equipmentName?.trim() || "—";
    const equipmentType = eq.equipmentType?.trim() || "";
    const serialCode = eq.serialCode?.trim() || "";
    const equipmentCode = eq.equipmentCode?.trim() || "";
    const lastFormatted = formatTestDate(eq.lastTestDate);
    const nextFormatted = formatTestDate(eq.nextTestDate);

    const sendForMilestone = async (milestoneDays, sentForField) => {
      if (daysUntil !== milestoneDays) return;

      result[milestoneDays === 30 ? "days30" : "days15"].candidates += 1;

      const priorSent = eq[sentForField];
      if (priorSent && isSameUtcDate(priorSent, eq.nextTestDate)) {
        result[milestoneDays === 30 ? "days30" : "days15"].skipped += 1;
        return;
      }

      const { subject, html, text } = buildPmsEquipmentTestingReminderEmail({
        daysPrior: milestoneDays,
        equipmentName: name,
        equipmentType,
        serialCode,
        equipmentCode,
        lastTestDateFormatted: lastFormatted,
        nextTestDateFormatted: nextFormatted,
      });

      await sendResendEmail({ to: recipients, subject, html, text });

      await Equipment.updateOne(
        { _id: eq._id },
        { $set: { [sentForField]: eq.nextTestDate } }
      );

      result[milestoneDays === 30 ? "days30" : "days15"].sent += 1;
    };

    try {
      await sendForMilestone(30, "pmsTestReminder30dSentForNextTestDate");
      await sendForMilestone(15, "pmsTestReminder15dSentForNextTestDate");
    } catch (e) {
      result.errors.push(
        `${eq.serialCode || eq.equipmentCode || eq._id}: ${e.message || e}`
      );
    }
  }

  return result;
}
