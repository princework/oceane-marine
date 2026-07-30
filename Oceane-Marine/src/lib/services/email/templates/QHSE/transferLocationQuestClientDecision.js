/**
 * QHSE — Transfer Location Questionnaire decision (Approved/Rejected) sent back to the client.
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
 *   decision: "Approved" | "Rejected";
 *   operationRef: string;
 *   clientName?: string;
 *   rejectionReason?: string;
 * }} p
 */
export function buildTransferLocationQuestClientDecisionEmail({
  decision,
  operationRef,
  clientName,
  rejectionReason,
}) {
  const ref = operationRef?.trim() || "—";
  const name = clientName?.trim();
  const greeting = name ? `Dear ${name},` : "Dear Sir/Madam,";
  const isApproved = decision === "Approved";
  const reason = rejectionReason?.trim();

  const subject = isApproved
    ? `Transfer Location Questionnaire approved – Operation ${ref}`
    : `Transfer Location Questionnaire rejected – Operation ${ref}`;

  const statusLine = isApproved
    ? `Your Transfer Location Questionnaire for operation ${ref} has been reviewed and approved.`
    : `Your Transfer Location Questionnaire for operation ${ref} has been reviewed and was not approved.`;

  const text = [
    greeting,
    "",
    statusLine,
    ...(isApproved
      ? []
      : ["", "Reason for rejection:", reason || "—", "", "Please review the feedback above and resubmit using the same link."]),
    "",
    "Best regards,",
    "Oceane Group",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const rejectionHtml = isApproved
    ? ""
    : `
        <p style="margin:16px 0 8px;font-weight:700;">Reason for rejection:</p>
        <p style="margin:0 0 16px;white-space:pre-wrap;">${escapeHtml(reason || "—")}</p>
        <p style="margin:0 0 16px;">
          Please review the feedback above and resubmit using the same link.
        </p>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:#1e293b;background:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;">
    <tr>
      <td style="padding:28px 28px 8px;">
        <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 16px;">${escapeHtml(statusLine)}</p>
        ${rejectionHtml}
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
