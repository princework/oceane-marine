/**
 * Trigger a simple test email via Resend (same path the app uses).
 *
 * Usage (from project root):
 *   node scripts/send-test-email.mjs recipient@example.com
 *   TEST_EMAIL_TO=you@example.com node scripts/send-test-email.mjs
 *   npm run test:email -- you@example.com
 *
 * Requires in .env.local: RESEND_API_KEY, RESEND_FROM_EMAIL
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const { sendResendEmail } = await import("../src/lib/services/email/sendResendEmail.js");

const to =
  process.argv[2]?.trim() ||
  process.env.TEST_EMAIL_TO?.trim() ||
  "";

if (!to) {
  console.error(
    "Usage: node scripts/send-test-email.mjs <email>\n   or set TEST_EMAIL_TO in the environment"
  );
  process.exit(1);
}
if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
  console.error("Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local");
  process.exit(1);
}

const subject = process.env.TEST_EMAIL_SUBJECT?.trim() || "Oceane Marine — test email";
const html = `
  <p>This is a <strong>test email</strong> from the Oceane Marine app (Resend).</p>
  <p>If you received this, <code>sendResendEmail</code> is configured correctly.</p>
`.trim();
const text =
  "This is a test email from the Oceane Marine app (Resend). If you received this, sendResendEmail is configured correctly.";

try {
  const data = await sendResendEmail({ to, subject, html, text });
  console.log("Sent OK to:", to);
  console.log("Resend response:", data);
} catch (e) {
  console.error("Failed:", e.message || e);
  process.exit(1);
}
