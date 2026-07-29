/**
 * Send one sample PMS equipment testing reminder (does not touch MongoDB).
 *
 *   node scripts/test-pms-testing-email.mjs
 *
 * Requires: RESEND_API_KEY, RESEND_FROM_EMAIL,
 *   PMS_TESTING_REMINDER_TO_EMAIL or PMS_TEAM_EMAIL
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const { buildPmsEquipmentTestingReminderEmail } = await import(
  "../src/lib/services/email/templates/Pms/equipmentTestingReminder.js"
);
const { sendResendEmail } = await import("../src/lib/services/email/sendResendEmail.js");

const rawTo =
  process.env.PMS_TESTING_REMINDER_TO_EMAIL || process.env.PMS_TEAM_EMAIL || "";
const to = rawTo
  .split(/[,;]/)
  .map((s) => s.trim())
  .filter(Boolean);

if (to.length === 0) {
  console.error("Set PMS_TESTING_REMINDER_TO_EMAIL or PMS_TEAM_EMAIL in .env.local");
  process.exit(1);
}
if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
  console.error("Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local");
  process.exit(1);
}

const { subject, html, text } = buildPmsEquipmentTestingReminderEmail({
  daysPrior: 30,
  equipmentName: "Sample fender set (demo)",
  equipmentType: "Fender",
  serialCode: "2026-001",
  equipmentCode: "EQ-FND-01",
  lastTestDateFormatted: "15 Jan 2025",
  nextTestDateFormatted: "18 May 2026",
});

try {
  await sendResendEmail({
    to,
    subject: `[TEST] ${subject}`,
    html,
    text,
  });
  console.log("OK — sample PMS testing reminder sent to:", to.join(", "));
} catch (e) {
  console.error("Failed:", e.message || e);
  process.exit(1);
}
