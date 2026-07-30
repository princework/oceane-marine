/**
 * Send sample POAC Valid Passport emails via Resend (no MongoDB).
 *
 * Usage (from Oceane-Marine root):
 *   npm run test:poac-passport-email
 *   npm run test:poac-passport-email -- expired
 *
 * Default: 5-day "expiring soon" sample.
 * Pass `expired` as argv: 1-day-after "has expired" sample.
 *
 * Requires in .env.local: RESEND_API_KEY, RESEND_FROM_EMAIL,
 *   and HR_POAC_PASSPORT_EXPIRY_REMINDER_TO (or HR_CID_EXPIRY_REMINDER_TO / HR_TEAM_EMAIL)
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const {
  buildPoacPassportExpiryReminderEmail,
  buildPoacPassportExpiredNoticeEmail,
} = await import(
  "../src/lib/services/email/templates/HR/poacPassportExpiryReminder.js"
);
const { sendResendEmail } = await import(
  "../src/lib/services/email/sendResendEmail.js"
);

const rawTo =
  process.env.HR_POAC_PASSPORT_EXPIRY_REMINDER_TO ||
  process.env.HR_CID_EXPIRY_REMINDER_TO ||
  process.env.HR_TEAM_EMAIL ||
  "";
const to = rawTo
  .split(/[,;]/)
  .map((s) => s.trim())
  .filter(Boolean);

if (to.length === 0) {
  console.error(
    "Set HR_POAC_PASSPORT_EXPIRY_REMINDER_TO or HR_CID_EXPIRY_REMINDER_TO / HR_TEAM_EMAIL in .env.local"
  );
  process.exit(1);
}
if (
  !process.env.RESEND_API_KEY?.trim() ||
  !process.env.RESEND_FROM_EMAIL?.trim()
) {
  console.error("Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local");
  process.exit(1);
}

const mode = (process.argv[2] || "reminder").toLowerCase();
const isExpired = mode === "expired" || mode === "1d";

const expiry = new Date();
if (isExpired) {
  expiry.setUTCDate(expiry.getUTCDate() - 1);
} else {
  expiry.setUTCDate(expiry.getUTCDate() + 5);
}
const expiryDateFormatted = expiry.toLocaleDateString("en-GB", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const emailParams = {
  poacName: "Test POAC (sample)",
  stsServiceProvider: "Sample STS Service Provider",
  expiryDateFormatted,
};

const { subject, html, text } = isExpired
  ? buildPoacPassportExpiredNoticeEmail(emailParams)
  : buildPoacPassportExpiryReminderEmail(emailParams);

try {
  const data = await sendResendEmail({ to, subject, html, text });
  console.log(
    isExpired
      ? "OK — test POAC passport EXPIRED notice sent to:"
      : "OK — test POAC passport 5d reminder sent to:",
    to.join(", ")
  );
  console.log("Resend:", data);
} catch (e) {
  console.error("Failed:", e.message || e);
  process.exit(1);
}
