import { connectDB } from "../../config/connection.js";
import Cid from "../../mongodb/models/hr/Cid.js";
import { startOfUtcDay, addUtcDays, isSameUtcDate } from "../../utils/utcDate.js";
import { buildCidExpiryReminderEmail } from "./templates/HR/cidExpiryReminder.js";
import { sendResendEmail } from "./sendResendEmail.js";

export { startOfUtcDay, addUtcDays, isSameUtcDate } from "../../utils/utcDate.js";

function formatExpiryDate(validity) {
  try {
    return new Date(validity).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return String(validity);
  }
}

function parseRecipientList() {
  const raw = process.env.HR_CID_EXPIRY_REMINDER_TO || process.env.HR_TEAM_EMAIL || "";
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Find ACTIVE CIDs whose validity date is exactly 5 calendar days from today (UTC),
 * send one reminder per record (per validity date), then mark as sent.
 * @returns {Promise<{ checked: number; sent: number; skipped: number; errors: string[] }>}
 */
export async function runCidExpiryReminderJob() {
  await connectDB();

  const recipients = parseRecipientList();
  const result = { checked: 0, sent: 0, skipped: 0, errors: [] };

  if (recipients.length === 0) {
    result.errors.push("No recipients: set HR_CID_EXPIRY_REMINDER_TO (comma-separated) or HR_TEAM_EMAIL");
    return result;
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    result.errors.push("Resend not configured: RESEND_API_KEY and RESEND_FROM_EMAIL required");
    return result;
  }

  const todayStart = startOfUtcDay(new Date());
  const validityDayStart = addUtcDays(todayStart, 5);
  const validityDayEnd = addUtcDays(validityDayStart, 1);

  const candidates = await Cid.find({
    status: "ACTIVE",
    validity: { $gte: validityDayStart, $lt: validityDayEnd },
  }).lean();

  result.checked = candidates.length;

  for (const doc of candidates) {
    try {
      if (
        doc.lastCidExpiryReminder5dValidity &&
        isSameUtcDate(doc.lastCidExpiryReminder5dValidity, doc.validity)
      ) {
        result.skipped += 1;
        continue;
      }

      const { subject, html, text } = buildCidExpiryReminderEmail({
        personName: doc.name,
        location: doc.location,
        expiryDateFormatted: formatExpiryDate(doc.validity),
      });

      await sendResendEmail({
        to: recipients,
        subject,
        html,
        text,
      });

      await Cid.updateOne(
        { _id: doc._id },
        {
          $set: {
            lastCidExpiryReminder5dAt: new Date(),
            lastCidExpiryReminder5dValidity: doc.validity,
          },
        }
      );

      result.sent += 1;
    } catch (e) {
      result.errors.push(`${doc._id}: ${e.message || e}`);
    }
  }

  return result;
}
