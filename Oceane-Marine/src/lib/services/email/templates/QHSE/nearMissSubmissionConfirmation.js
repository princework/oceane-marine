function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayOrDash(v) {
  const t = v?.trim?.() ?? (typeof v === "string" ? v.trim() : "");
  return t || "—";
}

/**
 * Near miss — confirmation to submitter after successful create (external form).
 *
 * @param {{
 *   recipientName: string;
 *   jobNo: string;
 *   locationLine: string;
 * }} p
 */
export function buildNearMissSubmissionConfirmationEmail({
  recipientName,
  jobNo,
  locationLine,
}) {
  const dear = displayOrDash(recipientName);
  const job = displayOrDash(jobNo);
  const loc = displayOrDash(locationLine);

  const subject = "Near miss report successfully submitted — Oceane Group";

  const text = [
    `Dear ${dear},`,
    "",
    "This is to inform you that your near miss report has been successfully submitted in Oceane Group database.",
    "",
    `Job No : ${job}`,
    `Location : ${loc}`,
    "",
    "Thank you for your proactive effort in reporting and contributing to a safer working environment. The report will be reviewed, and any necessary actions will be taken accordingly.",
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
        <p style="margin:0 0 16px;">Dear ${escapeHtml(dear)},</p>
        <p style="margin:0 0 16px;">
          This is to inform you that your near miss report has been successfully submitted in Oceane Group database.
        </p>
        <p style="margin:0 0 8px;"><strong>Job No :</strong> ${escapeHtml(job)}</p>
        <p style="margin:0 0 20px;"><strong>Location :</strong> ${escapeHtml(loc)}</p>
        <p style="margin:0 0 16px;">
          Thank you for your proactive effort in reporting and contributing to a safer working environment.
          The report will be reviewed, and any necessary actions will be taken accordingly.
        </p>
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
