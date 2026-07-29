import { sendResendEmail } from "./sendResendEmail.js";
import { buildOilMajorApprovalConfirmedEmail } from "./templates/HR/oilMajorApprovalConfirmed.js";

function parseRecipientList() {
  // Prefer explicit list, then other HR notification inboxes. HR_TEAM_EMAIL is last —
  // it is sometimes mistakenly set to RESEND_FROM / noreply, which is not a real inbox.
  const raw =
    process.env.HR_OIL_MAJOR_APPROVAL_TO_EMAIL ||
    process.env.HR_CID_EXPIRY_REMINDER_TO ||
    process.env.HR_STATUTORY_CERTIFICATE_REMINDER_TO_EMAIL ||
    process.env.HR_TEAM_EMAIL ||
    "";
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Notify team when an Oil Major is set to Approved (create or first-time approval on update).
 * Fails soft: logs and returns false if misconfigured or send errors (caller should not block UX).
 *
 * @param {string} companyName
 * @returns {Promise<boolean>}
 */
export async function sendOilMajorApprovalConfirmedNotification(companyName) {
  const recipients = parseRecipientList();
  if (recipients.length === 0) {
    console.warn(
      "[oilMajorApproval] No recipients: set HR_OIL_MAJOR_APPROVAL_TO_EMAIL, or HR_CID_EXPIRY_REMINDER_TO / HR_STATUTORY_CERTIFICATE_REMINDER_TO_EMAIL / HR_TEAM_EMAIL"
    );
    return false;
  }

  const { subject, html, text } = buildOilMajorApprovalConfirmedEmail({
    companyName,
  });

  try {
    await sendResendEmail({ to: recipients, subject, html, text });
    return true;
  } catch (err) {
    console.error("[oilMajorApproval] Resend failed:", err?.message || err);
    return false;
  }
}
