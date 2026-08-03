import { renderEmailShell, emailInfoRow, emailAlertBox } from "@/lib/services/email/emailShell";

export const POAC_MEDICALS_EXPIRY_REMINDER_SUBJECT =
  "Reminder: POAC Valid Medicals Expiring Soon";

/**
 * HR — POAC matrix row: Valid Medicals expiring in 5 UTC calendar days.
 * @param {{
 *   poacName: string;
 *   stsServiceProvider: string;
 *   expiryDateFormatted: string;
 * }} params
 * @returns {{ subject: string; html: string; text: string }}
 */
export function buildPoacMedicalsExpiryReminderEmail({
  poacName,
  stsServiceProvider,
  expiryDateFormatted,
}) {
  const name = poacName?.trim() || "the POAC";
  const provider = stsServiceProvider?.trim() || "the listed STS service provider";
  const when = expiryDateFormatted?.trim() || "the expiry date";

  const text = [
    "Dear Team,",
    "",
    `This is a formal reminder that the Valid Medicals (seafarer medical fitness certificate) for POAC ${name} (STS Service Provider: ${provider}) is set to expire on ${when}.`,
    "",
    "Please renew the medical certificate and update the POAC Certification Matrix before the expiry date to avoid operational interruptions.",
    "",
    "For further queries and clarifications, please contact operations@oceanemarine.com. Thank you for your attention to this matter.",
    "",
    "Best regards,",
    "Helios Tech Labs",
  ].join("\n");

  const html = renderEmailShell({
    eyebrow: "HR — Certification Reminder",
    title: "Valid Medicals expiring soon",
    preheader: `The Valid Medicals for POAC ${name} is set to expire on ${when}.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear Team,</p>
        <p style="margin:0 0 18px;">
          This is a formal reminder that the <strong>Valid Medicals (seafarer medical fitness certificate)</strong> for
          the POAC listed below is set to expire soon.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background-color:#f8fafc;border-radius:8px;">
          <tr><td style="padding:14px 18px;">
            ${emailInfoRow("POAC", escapeHtml(name))}
            ${emailInfoRow("STS Service Provider", escapeHtml(provider))}
            ${emailInfoRow("Expires", escapeHtml(when))}
          </td></tr>
        </table>
        <p style="margin:0 0 16px;">
          Please renew the medical certificate and update the POAC Certification Matrix before the expiry date to avoid operational interruptions.
        </p>
        <p style="margin:0;">
          For further queries and clarifications, please contact
          <a href="mailto:operations@oceanemarine.com" style="color:#c2410c;font-weight:600;text-decoration:none;">operations@oceanemarine.com</a>.
          Thank you for your attention to this matter.
        </p>`,
  });

  return {
    subject: POAC_MEDICALS_EXPIRY_REMINDER_SUBJECT,
    html,
    text,
  };
}

export const POAC_MEDICALS_EXPIRED_NOTICE_SUBJECT =
  "Notice: POAC Valid Medicals Has Expired";

/**
 * HR — POAC matrix row: Valid Medicals expired (sent 1 UTC day after expiry).
 * @param {{
 *   poacName: string;
 *   stsServiceProvider: string;
 *   expiryDateFormatted: string;
 * }} params
 * @returns {{ subject: string; html: string; text: string }}
 */
export function buildPoacMedicalsExpiredNoticeEmail({
  poacName,
  stsServiceProvider,
  expiryDateFormatted,
}) {
  const name = poacName?.trim() || "the POAC";
  const provider = stsServiceProvider?.trim() || "the listed STS service provider";
  const when = expiryDateFormatted?.trim() || "the expiry date";

  const text = [
    "Dear Team,",
    "",
    `This is a formal notice that the Valid Medicals (seafarer medical fitness certificate) for POAC ${name} (STS Service Provider: ${provider}) expired on ${when}.`,
    "",
    "Please renew the medical certificate and update the POAC Certification Matrix as soon as possible to avoid operational interruptions.",
    "",
    "For further queries and clarifications, please contact operations@oceanemarine.com. Thank you for your attention to this matter.",
    "",
    "Best regards,",
    "Helios Tech Labs",
  ].join("\n");

  const html = renderEmailShell({
    eyebrow: "HR — Certification Notice",
    title: "Valid Medicals have expired",
    preheader: `The Valid Medicals for POAC ${name} expired on ${when}.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear Team,</p>
        <p style="margin:0 0 18px;">
          This is a formal notice that the <strong>Valid Medicals (seafarer medical fitness certificate)</strong> for
          the POAC listed below has expired.
        </p>
        ${emailAlertBox("Expired", `Valid Medicals for POAC ${escapeHtml(name)} (STS Service Provider: ${escapeHtml(provider)}) expired on ${escapeHtml(when)}.`, "danger")}
        <p style="margin:0 0 16px;">
          Please renew the medical certificate and update the POAC Certification Matrix as soon as possible to avoid operational interruptions.
        </p>
        <p style="margin:0;">
          For further queries and clarifications, please contact
          <a href="mailto:operations@oceanemarine.com" style="color:#c2410c;font-weight:600;text-decoration:none;">operations@oceanemarine.com</a>.
          Thank you for your attention to this matter.
        </p>`,
  });

  return {
    subject: POAC_MEDICALS_EXPIRED_NOTICE_SUBJECT,
    html,
    text,
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
