/**
 * STS Operations — checklist form links sent to the mooring master assigned to an operation.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{
 *   operationRef: string;
 *   mooringMasterName?: string;
 *   operationDateFormatted?: string;
 *   rows: { code: string; name: string; url: string }[];
 * }} p
 */
export function buildStsChecklistLinksEmail({
  operationRef,
  mooringMasterName,
  operationDateFormatted,
  rows,
}) {
  const ref = operationRef?.trim() || "—";
  const name = mooringMasterName?.trim();
  const greeting = name ? `Dear ${name},` : "Dear Mooring Master,";
  const dateStr = operationDateFormatted?.trim();
  const items = Array.isArray(rows) ? rows.filter((r) => r && r.url) : [];

  const subject = `STS Checklist Forms – Operation ${ref}`;

  const introLine = dateStr
    ? `Please find below the checklist forms for operation ${ref}, dated ${dateStr}.`
    : `Please find below the checklist forms for operation ${ref}.`;

  const text = [
    greeting,
    "",
    introLine,
    "Each link opens the form with the operation reference already filled in.",
    "",
    ...items.map((r) => `${r.code} — ${r.name}\n${r.url}\n`),
    "Please complete the applicable forms during the operation.",
    "",
    "Best regards,",
    "Oceane Group",
  ].join("\n");

  const rowsHtml = items
    .map(
      (r) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;font-family:Consolas,Monaco,monospace;font-size:13px;color:#c2410c;font-weight:bold;">
            ${escapeHtml(r.code)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:14px;">
            ${escapeHtml(r.name)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">
            <a href="${escapeHtml(r.url)}" style="color:#1d4ed8;text-decoration:underline;font-size:14px;">Open form</a>
          </td>
        </tr>`
    )
    .join("");

  const tableHtml = items.length
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th align="left" style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;">Form</th>
            <th align="left" style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;">Title</th>
            <th align="left" style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;">Link</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`
    : `<p style="margin:0 0 16px;">(No forms available for this operation.)</p>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:#1e293b;background:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;">
    <tr>
      <td style="padding:28px 28px 8px;">
        <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 16px;">
          ${escapeHtml(introLine)}
          Each link opens the form with the operation reference already filled in.
        </p>
        ${tableHtml}
        <p style="margin:0 0 16px;">
          Please complete the applicable forms during the operation.
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
