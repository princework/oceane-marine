import { connectDB } from "../../config/connection.js";
import StatutoryCertificate from "../../mongodb/models/hr/StatutoryCertificate";
import { diffUtcCalendarDays, isSameUtcDate, startOfUtcDay } from "../../utils/utcDate";
import { sendResendEmail } from "./sendResendEmail.js";
import { buildStatutoryCertificateExpiryReminderEmail } from "./templates/HR/statutoryCertificateExpiryReminder.js";

function parseRecipientList() {
  const raw =
    process.env.HR_STATUTORY_CERTIFICATE_REMINDER_TO_EMAIL ||
    process.env.HR_TEAM_EMAIL ||
    "";
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatExpiryDateUtcEnGb(d) {
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
 * Daily job: ACTIVE statutory certificates — send at **30** and **15** UTC calendar days before `validity`.
 * Dedupe per certificate per milestone per `validity` date.
 */
export async function runHrStatutoryCertificateExpiryReminderJob() {
  await connectDB();

  const recipients = parseRecipientList();
  const result = {
    days30: { candidates: 0, sent: 0, skipped: 0 },
    days15: { candidates: 0, sent: 0, skipped: 0 },
    errors: [],
  };

  if (recipients.length === 0) {
    result.errors.push(
      "No recipients: set HR_STATUTORY_CERTIFICATE_REMINDER_TO_EMAIL (comma-separated) or HR_TEAM_EMAIL"
    );
    return result;
  }

  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
    result.errors.push("Resend not configured: RESEND_API_KEY and RESEND_FROM_EMAIL required");
    return result;
  }

  const todayStart = startOfUtcDay(new Date());

  const certs = await StatutoryCertificate.find({
    status: "ACTIVE",
    validity: { $exists: true, $ne: null },
  }).lean();

  for (const cert of certs) {
    const validityRaw = cert.validity;
    if (!validityRaw) continue;

    const validityStart = startOfUtcDay(validityRaw);
    const daysUntil = diffUtcCalendarDays(todayStart, validityStart);
    if (!Number.isFinite(daysUntil) || daysUntil < 0) continue;

    const certificateName = cert.typeOfDocs?.trim() || "—";
    const expiryDateFormatted = formatExpiryDateUtcEnGb(cert.validity);

    const sendForMilestone = async (milestoneDays, sentForField) => {
      if (daysUntil !== milestoneDays) return;

      const bucket = milestoneDays === 30 ? "days30" : "days15";
      result[bucket].candidates += 1;

      const priorSent = cert[sentForField];
      if (priorSent && isSameUtcDate(priorSent, cert.validity)) {
        result[bucket].skipped += 1;
        return;
      }

      const { subject, html, text } = buildStatutoryCertificateExpiryReminderEmail({
        daysPrior: milestoneDays,
        certificateName,
        expiryDateFormatted,
      });

      await sendResendEmail({ to: recipients, subject, html, text });

      await StatutoryCertificate.updateOne(
        { _id: cert._id },
        { $set: { [sentForField]: cert.validity } }
      );

      result[bucket].sent += 1;
    };

    try {
      await sendForMilestone(30, "hrStatutoryReminder30dSentForValidity");
      await sendForMilestone(15, "hrStatutoryReminder15dSentForValidity");
    } catch (e) {
      result.errors.push(`${cert._id}: ${e.message || e}`);
    }
  }

  return result;
}
