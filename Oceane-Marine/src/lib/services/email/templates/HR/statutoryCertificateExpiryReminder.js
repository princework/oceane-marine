import { renderEmailShell, emailInfoRow } from "@/lib/services/email/emailShell";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * HR — statutory certificate validity: automated reminder N calendar days before expiry (UTC).
 *
 * @param {{
 *   daysPrior: number;
 *   certificateName: string;
 *   expiryDateFormatted: string;
 * }} p
 */
export function buildStatutoryCertificateExpiryReminderEmail({
  daysPrior,
  certificateName,
  expiryDateFormatted,
}) {
  const days = Number(daysPrior) || 0;
  const name = certificateName?.trim() || "—";
  const when = expiryDateFormatted?.trim() || "—";

  const subject = `HR — Statutory certificate expires in ${days} days — ${name}`;

  const text = [
    "Dear Team,",
    "",
    `This is an automated reminder that the statutory certificate ${name} is due to expire on ${when}.`,
    "",
    "Kindly take the necessary action to arrange for renewal before the expiry date to ensure compliance and avoid any operational disruptions.",
    "",
    "Please update the system once the renewal process is completed.",
    "",
    "Thank you for your prompt attention to this matter.",
    "",
    "Best regards,",
    "Helios Tech Labs",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const html = renderEmailShell({
    eyebrow: "HR — Certification Reminder",
    title: "Statutory certificate expiring soon",
    preheader: `${name} is due to expire on ${when}.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear Team,</p>
        <p style="margin:0 0 18px;">
          This is an automated reminder that the statutory certificate
          <strong>${escapeHtml(name)}</strong> is due to expire on <strong>${escapeHtml(when)}</strong>.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background-color:#f8fafc;border-radius:8px;">
          <tr><td style="padding:14px 18px;">
            ${emailInfoRow("Certificate", escapeHtml(name))}
            ${emailInfoRow("Expires", escapeHtml(when))}
            ${emailInfoRow("Days Remaining", escapeHtml(String(days)))}
          </td></tr>
        </table>
        <p style="margin:0 0 16px;">
          Kindly take the necessary action to arrange for renewal before the expiry date to ensure compliance and avoid any operational disruptions.
        </p>
        <p style="margin:0 0 16px;">
          Please update the system once the renewal process is completed.
        </p>
        <p style="margin:0;">Thank you for your prompt attention to this matter.</p>`,
  });

  return { subject, html, text };
}
