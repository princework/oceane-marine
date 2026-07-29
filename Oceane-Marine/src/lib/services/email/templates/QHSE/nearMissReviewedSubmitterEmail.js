function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayBlock(v) {
  const t = v?.trim?.() ?? (typeof v === "string" ? v.trim() : "");
  return t || "—";
}

function blockToText(v) {
  const t = displayBlock(v);
  return t === "—" ? "—" : t;
}

function blockToHtml(v) {
  const t = displayBlock(v);
  if (t === "—") {
    return `<p style="margin:0 0 12px;color:#64748b;font-style:italic;">—</p>`;
  }
  const lines = escapeHtml(t).split(/\r?\n/);
  return `<p style="margin:0 0 12px;white-space:pre-wrap;line-height:1.5;">${lines.join("<br />")}</p>`;
}

/**
 * Near miss — notify original submitter when office marks report as Reviewed.
 *
 * @param {{
 *   recipientName: string;
 *   jobNo: string;
 *   incidentDateFormatted: string;
 *   description: string;
 *   immediateCause: string;
 *   rootCause: string;
 *   correctiveAction: string;
 *   remarksByReviewer: string;
 * }} p
 */
export function buildNearMissReviewedSubmitterEmail({
  recipientName,
  jobNo,
  incidentDateFormatted,
  description,
  immediateCause,
  rootCause,
  correctiveAction,
  remarksByReviewer,
}) {
  const dear = displayBlock(recipientName);
  const job = displayBlock(jobNo);
  const dateStr = displayBlock(incidentDateFormatted);

  const subject = "Near miss report reviewed — Oceane Group";

  const text = [
    `Dear ${dear},`,
    "",
    "This is to inform you that the near miss report you submitted has been successfully reviewed.",
    "",
    `Job No : ${job}`,
    `Date : ${dateStr}`,
    "",
    "Near miss Description:",
    blockToText(description),
    "",
    "Immediate cause :",
    blockToText(immediateCause),
    "",
    "Root cause :",
    blockToText(rootCause),
    "",
    "Corrective action :",
    blockToText(correctiveAction),
    "",
    "Remarks by reviewer :",
    blockToText(remarksByReviewer),
    "",
    "Thank you for your proactive effort in reporting and contributing to a safer working environment. Appropriate actions have been taken based on your report.",
    "We encourage you to continue reporting any near misses going forward, as this helps us maintain and improve safety standards across all operations.",
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;">
    <tr>
      <td style="padding:28px 28px 8px;">
        <p style="margin:0 0 16px;">Dear ${escapeHtml(dear)},</p>
        <p style="margin:0 0 20px;">
          This is to inform you that the near miss report you submitted has been successfully reviewed.
        </p>
        <p style="margin:0 0 6px;"><strong>Job No :</strong> ${escapeHtml(job)}</p>
        <p style="margin:0 0 20px;"><strong>Date :</strong> ${escapeHtml(dateStr)}</p>

        <p style="margin:16px 0 8px;font-weight:700;">Near miss Description:</p>
        ${blockToHtml(description)}

        <p style="margin:16px 0 8px;font-weight:700;">Immediate cause :</p>
        ${blockToHtml(immediateCause)}

        <p style="margin:16px 0 8px;font-weight:700;">Root cause :</p>
        ${blockToHtml(rootCause)}

        <p style="margin:16px 0 8px;font-weight:700;">Corrective action :</p>
        ${blockToHtml(correctiveAction)}

        <p style="margin:16px 0 8px;font-weight:700;">Remarks by reviewer :</p>
        ${blockToHtml(remarksByReviewer)}

        <p style="margin:20px 0 16px;">
          Thank you for your proactive effort in reporting and contributing to a safer working environment.
          Appropriate actions have been taken based on your report.
        </p>
        <p style="margin:0 0 20px;">
          We encourage you to continue reporting any near misses going forward, as this helps us maintain and improve safety standards across all operations.
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
