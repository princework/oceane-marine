/**
 * STS documentation emails — two modes:
 *
 * 1) DEFAULT (recommended): runs the real cron job logic against MongoDB — sends emails only when
 *    rules match (INPROGRESS 7d/30d, or COMPLETED + missing docs ≥7d). Lists ALL missing items from DB.
 *
 *    node scripts/test-sts-documentation-email.mjs
 *
 * 2) --sample: sends two tiny demo emails with FIXED bullet text (3 lines on the completed mail).
 *    Does NOT read operations from the database — only for checking Resend/template styling.
 *
 *    node scripts/test-sts-documentation-email.mjs --sample
 *
 * Requires in .env.local: MONGODB_URI, RESEND_API_KEY, RESEND_FROM_EMAIL,
 *   OPERATIONS_STS_DOCUMENTATION_FOLLOW_UP_TO_EMAIL (and CRON_SECRET not required for this script).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const isSample = process.argv.includes("--sample");

if (isSample) {
  console.warn(
    "\n[--sample] Sending DEMO emails only — the completed mail has 3 hardcoded bullets.\n" +
      "This is NOT your real missing-doc list. Run without --sample to use MongoDB + full checklist.\n"
  );

  const { buildStsInProgressDocumentationEmail, buildStsCompletedMissingDocumentsEmail } =
    await import("../src/lib/services/email/templates/operations/stsDocumentationFollowUp.js");
  const { sendResendEmail } = await import("../src/lib/services/email/sendResendEmail.js");

  const rawTo = process.env.OPERATIONS_STS_DOCUMENTATION_FOLLOW_UP_TO_EMAIL || "";
  const to = rawTo
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (to.length === 0) {
    console.error("Set OPERATIONS_STS_DOCUMENTATION_FOLLOW_UP_TO_EMAIL in .env.local");
    process.exit(1);
  }
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
    console.error("Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local");
    process.exit(1);
  }

  const sampleRef = "2026-010 (sample)";
  const sampleDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  try {
    const inProgress = buildStsInProgressDocumentationEmail({
      operationRef: sampleRef,
      operationDateFormatted: sampleDate,
      daysInProgress: 12,
    });
    await sendResendEmail({
      to,
      subject: `[TEST SAMPLE] ${inProgress.subject}`,
      html: inProgress.html,
      text: inProgress.text,
    });
    console.log("OK — sample in-progress email sent.");

    const completed = buildStsCompletedMissingDocumentsEmail({
      operationRef: sampleRef,
      operationDateFormatted: sampleDate,
      missingLabels: [
        "CHS — SSQ (Ship Standard Questionnaire)",
        "OPS-OFD-004 — Checklist 4A-F",
        "Joint Plan Operation",
      ],
    });
    await sendResendEmail({
      to,
      subject: `[TEST SAMPLE] ${completed.subject}`,
      html: completed.html,
      text: completed.text,
    });
    console.log("OK — sample completed/missing-docs email sent to:", to.join(", "));
  } catch (e) {
    console.error("Failed:", e.message || e);
    process.exit(1);
  }
  process.exit(0);
}

/* ----- Live job: real missing-doc list from MongoDB ----- */

if (!process.env.MONGODB_URI?.trim()) {
  console.error("Set MONGODB_URI in .env.local to run the real job (or use --sample for demo only).");
  process.exit(1);
}

const { runStsDocumentationFollowUpJob } = await import(
  "../src/lib/services/email/stsDocumentationFollowUp.js"
);

try {
  const result = await runStsDocumentationFollowUpJob();
  console.log("Job finished. Summary:\n");
  console.log(JSON.stringify(result, null, 2));
  if (result.errors?.length) {
    console.warn("\nWarnings/errors:", result.errors);
  }
} catch (e) {
  console.error("Job failed:", e.message || e);
  process.exit(1);
}
