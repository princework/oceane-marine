export const POAC_MASTERS_COC_EXPIRY_REMINDER_SUBJECT =
  "Reminder: POAC Valid Master's COC Expiring Soon";

/**
 * HR — POAC matrix row: Valid Master's COC expiring in 5 UTC calendar days.
 * @param {{
 *   poacName: string;
 *   stsServiceProvider: string;
 *   expiryDateFormatted: string;
 * }} params
 * @returns {{ subject: string; html: string; text: string }}
 */
export function buildPoacMastersCocExpiryReminderEmail({
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
    `This is a formal reminder that the Valid Master's COC (Certificate of Competency) for POAC ${name} (STS Service Provider: ${provider}) is set to expire on ${when}.`,
    "",
    "Please renew the Master's COC and update the POAC Certification Matrix before the expiry date to avoid operational interruptions.",
    "",
    "For further queries and clarifications, please contact operations@oceanemarine.com. Thank you for your attention to this matter.",
    "",
    "Best regards,",
    "Oceane Group",
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
          This is a formal reminder that the <strong>Valid Master's COC (Certificate of Competency)</strong> for POAC
          <strong>${escapeHtml(name)}</strong>
          (STS Service Provider: <strong>${escapeHtml(provider)}</strong>)
          is set to expire on <strong>${escapeHtml(when)}</strong>.
        </p>
        <p style="margin:0 0 16px;">
          Please renew the Master's COC and update the POAC Certification Matrix before the expiry date to avoid operational interruptions.
        </p>
        <p style="margin:0 0 16px;">
          For further queries and clarifications, please contact
          <a href="mailto:operations@oceanemarine.com" style="color:#0f766e;text-decoration:underline;">operations@oceanemarine.com</a>.
          Thank you for your attention to this matter.
          <br /><br />
          Best regards,<br />
          <strong>Oceane Group</strong>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return {
    subject: POAC_MASTERS_COC_EXPIRY_REMINDER_SUBJECT,
    html,
    text,
  };
}

export const POAC_MASTERS_COC_EXPIRED_NOTICE_SUBJECT =
  "Notice: POAC Valid Master's COC Has Expired";

/**
 * HR — POAC matrix row: Valid Master's COC expired (sent 1 UTC day after expiry).
 * @param {{
 *   poacName: string;
 *   stsServiceProvider: string;
 *   expiryDateFormatted: string;
 * }} params
 * @returns {{ subject: string; html: string; text: string }}
 */
export function buildPoacMastersCocExpiredNoticeEmail({
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
    `This is a formal notice that the Valid Master's COC (Certificate of Competency) for POAC ${name} (STS Service Provider: ${provider}) expired on ${when}.`,
    "",
    "Please renew the Master's COC and update the POAC Certification Matrix as soon as possible to avoid operational interruptions.",
    "",
    "For further queries and clarifications, please contact operations@oceanemarine.com. Thank you for your attention to this matter.",
    "",
    "Best regards,",
    "Oceane Group",
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
          This is a formal notice that the <strong>Valid Master's COC (Certificate of Competency)</strong> for POAC
          <strong>${escapeHtml(name)}</strong>
          (STS Service Provider: <strong>${escapeHtml(provider)}</strong>)
          <strong>expired</strong> on <strong>${escapeHtml(when)}</strong>.
        </p>
        <p style="margin:0 0 16px;">
          Please renew the Master's COC and update the POAC Certification Matrix as soon as possible to avoid operational interruptions.
        </p>
        <p style="margin:0 0 16px;">
          For further queries and clarifications, please contact
          <a href="mailto:operations@oceanemarine.com" style="color:#0f766e;text-decoration:underline;">operations@oceanemarine.com</a>.
          Thank you for your attention to this matter.
          <br /><br />
          Best regards,<br />
          <strong>Oceane Group</strong>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return {
    subject: POAC_MASTERS_COC_EXPIRED_NOTICE_SUBJECT,
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
