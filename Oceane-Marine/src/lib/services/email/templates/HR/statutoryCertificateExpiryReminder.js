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
    "Oceane Group",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:#1e293b;background:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;">
    <tr>
      <td style="padding:28px 28px 8px;">
        <p style="margin:0 0 16px;">Dear Team,</p>
        <p style="margin:0 0 16px;">
          This is an automated reminder that the statutory certificate
          <strong>${escapeHtml(name)}</strong> is due to expire on <strong>${escapeHtml(when)}</strong>.
        </p>
        <p style="margin:0 0 16px;">
          Kindly take the necessary action to arrange for renewal before the expiry date to ensure compliance and avoid any operational disruptions.
        </p>
        <p style="margin:0 0 16px;">
          Please update the system once the renewal process is completed.
        </p>
        <p style="margin:0 0 16px;">Thank you for your prompt attention to this matter.</p>
        <p style="margin:0 0 16px;">
          Best regards,<br />
          <strong>Oceane Group</strong>
        </p>
        <p style="margin:0;font-size:13px;color:#64748b;">
          This is an automated email. Please do not reply.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, html, text };
}
