/**
 * STS Operations — documentation follow-up (in-progress duration or completed + missing docs).
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{ operationRef: string; operationDateFormatted: string; daysInProgress: number }} p
 */
export function buildStsInProgressDocumentationEmail({ operationRef, operationDateFormatted, daysInProgress }) {
  const ref = operationRef?.trim() || "—";
  const dateStr = operationDateFormatted?.trim() || "—";
  const days = Math.max(1, Number(daysInProgress) || 0);

  const subject = `Follow-up on Operation Status – ${ref}`;

  const text = [
    "Dear Team,",
    "",
    `Please note that the operation ${ref}, dated ${dateStr}, has been in "In Progress" status for ${days} days or more.`,
    "",
    "Kindly recheck and review the status. If the operation has been completed, please update the status accordingly.",
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
          Please note that the operation <strong>${escapeHtml(ref)}</strong>, dated <strong>${escapeHtml(dateStr)}</strong>,
          has been in &quot;In Progress&quot; status for <strong>${days}</strong> days or more.
        </p>
        <p style="margin:0 0 16px;">
          Kindly recheck and review the status. If the operation has been completed, please update the status accordingly.
        </p>
        <p style="margin:0;">
          Best regards,<br />
          <strong>Oceane Group</strong>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, html, text };
}

/**
 * @param {{ operationRef: string; operationDateFormatted: string; missingLabels: string[] }} p
 */
export function buildStsCompletedMissingDocumentsEmail({ operationRef, operationDateFormatted, missingLabels }) {
  const ref = operationRef?.trim() || "—";
  const dateStr = operationDateFormatted?.trim() || "—";
  const items = Array.isArray(missingLabels) ? missingLabels.filter(Boolean) : [];

  const subject = `Follow-up on Operation Status – ${ref}`;

  const listText = items.length
    ? items.map((l) => ` - ${l}`).join("\n")
    : " - (unspecified)";

  const text = [
    "Dear Team,",
    "",
    `Please note that the operation ${ref}, dated ${dateStr}, is marked as Completed, but the following required documentation is still missing or not linked in the system:`,
    "",
    listText,
    "",
    "Kindly upload or complete the outstanding items as soon as possible.",
    "",
    "Best regards,",
    "Oceane Group",
  ].join("\n");

  const listHtml =
    items.length > 0
      ? `<ul style="margin:0 0 16px;padding-left:20px;">${items
          .map((l) => `<li style="margin-bottom:6px;">${escapeHtml(l)}</li>`)
          .join("")}</ul>`
      : `<p style="margin:0 0 16px;">(No specific items listed — please review the operation in the STS documentation module.)</p>`;

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
          Please note that the operation <strong>${escapeHtml(ref)}</strong>, dated <strong>${escapeHtml(dateStr)}</strong>,
          is marked as <strong>Completed</strong>, but the following required documentation is still missing or not linked in the system:
        </p>
        ${listHtml}
        <p style="margin:0 0 16px;">
          Kindly upload or complete the outstanding items as soon as possible.
        </p>
        <p style="margin:0;">
          Best regards,<br />
          <strong>Oceane Group</strong>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, html, text };
}
