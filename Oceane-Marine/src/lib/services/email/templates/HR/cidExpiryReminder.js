import { renderEmailShell, emailInfoRow } from "@/lib/services/email/emailShell";

export const CID_EXPIRY_REMINDER_SUBJECT = "Reminder: CID Validity Expiring Soon";

/**
 * HR — CID validity expiring in 5 days (content matches business copy).
 * @param {{ personName: string; location: string; expiryDateFormatted: string }} params
 * @returns {{ subject: string; html: string; text: string }}
 */
export function buildCidExpiryReminderEmail({ personName, location, expiryDateFormatted }) {
  const name = personName?.trim() || "the holder";
  const loc = location?.trim() || "the listed location";
  const when = expiryDateFormatted?.trim() || "the expiry date";

  const text = [
    "Dear Team,",
    "",
    `This is a formal reminder that the CID of ${name} for the location ${loc} is set to expire on ${when}.`,
    "",
    "To avoid any interruptions in Port Entry, please ensure that you renew it before the expiry date.",
    "",
    "For further queries and clarifications, please contact operations@oceanemarine.com. Thank you for your attention to this matter.",
    "",
    "Best regards,",
    "Helios Tech Labs",
  ].join("\n");

  const html = renderEmailShell({
    eyebrow: "HR — Certification Reminder",
    title: "CID validity expiring soon",
    preheader: `The CID of ${name} is set to expire on ${when}.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear Team,</p>
        <p style="margin:0 0 18px;">
          This is a formal reminder that the CID of <strong>${escapeHtml(name)}</strong>
          for the location <strong>${escapeHtml(loc)}</strong> is set to expire on
          <strong>${escapeHtml(when)}</strong>.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background-color:#f8fafc;border-radius:8px;">
          <tr><td style="padding:14px 18px;">
            ${emailInfoRow("Holder", escapeHtml(name))}
            ${emailInfoRow("Location", escapeHtml(loc))}
            ${emailInfoRow("Expires", escapeHtml(when))}
          </td></tr>
        </table>
        <p style="margin:0 0 16px;">
          To avoid any interruptions in Port Entry, please ensure that you renew it before the expiry date.
        </p>
        <p style="margin:0;">
          For further queries and clarifications, please contact
          <a href="mailto:operations@oceanemarine.com" style="color:#c2410c;font-weight:600;text-decoration:none;">operations@oceanemarine.com</a>.
          Thank you for your attention to this matter.
        </p>`,
  });

  return {
    subject: CID_EXPIRY_REMINDER_SUBJECT,
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
