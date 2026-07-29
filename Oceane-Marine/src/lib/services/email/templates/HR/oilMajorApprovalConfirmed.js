function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * HR — Oil Major: team notification when a company is recorded as Approved.
 *
 * @param {{ companyName: string }} p
 */
export function buildOilMajorApprovalConfirmedEmail({ companyName }) {
  const name = companyName?.trim() || "—";

  const subject = "Approval Confirmed – Thanks to Our Amazing Team!";

  const text = [
    "Dear Team,",
    "",
    `We are thrilled to share that we are now officially approved by the ${name}! 🎉`,
    "",
    "This milestone is a testament to the hard work, dedication, and commitment of our entire team. We look forward to leveraging this approval to deliver even greater value in our operations and future projects.",
    "",
    "Keep up the fantastic work, and let's continue to achieve excellence together!",
    "",
    "Warm regards,",
    "Oceane Group",
    "",
    "This is an automated notification. No reply is necessary.",
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
          We are thrilled to share that we are now officially approved by the
          <strong>${escapeHtml(name)}</strong>! 🎉
        </p>
        <p style="margin:0 0 16px;">
          This milestone is a testament to the hard work, dedication, and commitment of our entire team.
          We look forward to leveraging this approval to deliver even greater value in our operations and future projects.
        </p>
        <p style="margin:0 0 16px;">
          Keep up the fantastic work, and let's continue to achieve excellence together!
        </p>
        <p style="margin:0 0 16px;">
          Warm regards,<br />
          <strong>Oceane Group</strong>
        </p>
        <p style="margin:0;font-size:13px;color:#64748b;">
          This is an automated notification. No reply is necessary.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, html, text };
}
