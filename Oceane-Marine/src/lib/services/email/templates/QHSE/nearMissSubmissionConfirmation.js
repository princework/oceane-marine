import { renderEmailShell, emailInfoRow } from "@/lib/services/email/emailShell";

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
    "Helios Tech Labs",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const html = renderEmailShell({
    eyebrow: "QHSE — Near Miss Report",
    title: "Your near miss report has been submitted",
    preheader: "Thank you for reporting — your near miss report was received successfully.",
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear ${escapeHtml(dear)},</p>
        <p style="margin:0 0 16px;">
          This is to inform you that your near miss report has been successfully submitted in the Oceane Group database.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background-color:#f8fafc;border-radius:8px;">
          <tr><td style="padding:14px 18px;">
            ${emailInfoRow("Job No", escapeHtml(job))}
            ${emailInfoRow("Location", escapeHtml(loc))}
          </td></tr>
        </table>
        <p style="margin:0 0 16px;">
          Thank you for your proactive effort in reporting and contributing to a safer working environment.
          The report will be reviewed, and any necessary actions will be taken accordingly.
        </p>`,
  });

  return { subject, html, text };
}
