/**
 * Send one CID expiry reminder email (sample data) via Resend.
 * Does not touch MongoDB or the 5-day job logic.
 *
 * Usage (from project root):
 *   node scripts/test-cid-expiry-email.mjs
 *
 * Requires in .env.local: RESEND_API_KEY, RESEND_FROM_EMAIL,
 *   and HR_CID_EXPIRY_REMINDER_TO or HR_TEAM_EMAIL
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const { buildCidExpiryReminderEmail } = await import(
  "../src/lib/services/email/templates/HR/cidExpiryReminder.js"
);
const { sendResendEmail } = await import("../src/lib/services/email/sendResendEmail.js");

const rawTo = process.env.HR_CID_EXPIRY_REMINDER_TO || process.env.HR_TEAM_EMAIL || "";
const to = rawTo
  .split(/[,;]/)
  .map((s) => s.trim())
  .filter(Boolean);

if (to.length === 0) {
  console.error("Set HR_CID_EXPIRY_REMINDER_TO or HR_TEAM_EMAIL in .env.local");
  process.exit(1);
}
if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
  console.error("Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local");
  process.exit(1);
}

const expiry = new Date();
expiry.setUTCDate(expiry.getUTCDate() + 5);
const expiryDateFormatted = expiry.toLocaleDateString("en-GB", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const { subject, html, text } = buildCidExpiryReminderEmail({
  personName: "Test Seafarer (sample)",
  location: "Sample Terminal / Port",
  expiryDateFormatted,
});

try {
  const data = await sendResendEmail({ to, subject, html, text });
  console.log("OK — test CID reminder sent to:", to.join(", "));
  console.log("Resend:", data);
} catch (e) {
  console.error("Failed:", e.message || e);
  process.exit(1);
}
