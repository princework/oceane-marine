import { renderEmailShell, emailInfoRow } from "@/lib/services/email/emailShell";

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
    return `<p style="margin:0 0 14px;color:#94a3b8;font-style:italic;">—</p>`;
  }
  const lines = escapeHtml(t).split(/\r?\n/);
  return `<p style="margin:0 0 14px;white-space:pre-wrap;line-height:1.5;">${lines.join("<br />")}</p>`;
}

function sectionLabel(text) {
  return `<p style="margin:18px 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11.5px;font-weight:700;color:#c2410c;letter-spacing:0.6px;text-transform:uppercase;">${text}</p>`;
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
    "Helios Tech Labs",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const html = renderEmailShell({
    eyebrow: "QHSE — Near Miss Report",
    title: "Your near miss report has been reviewed",
    preheader: "Your near miss report has been reviewed and actioned.",
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear ${escapeHtml(dear)},</p>
        <p style="margin:0 0 18px;">
          This is to inform you that the near miss report you submitted has been successfully reviewed.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;background-color:#f8fafc;border-radius:8px;">
          <tr><td style="padding:14px 18px;">
            ${emailInfoRow("Job No", escapeHtml(job))}
            ${emailInfoRow("Date", escapeHtml(dateStr))}
          </td></tr>
        </table>

        ${sectionLabel("Near Miss Description")}
        ${blockToHtml(description)}

        ${sectionLabel("Immediate Cause")}
        ${blockToHtml(immediateCause)}

        ${sectionLabel("Root Cause")}
        ${blockToHtml(rootCause)}

        ${sectionLabel("Corrective Action")}
        ${blockToHtml(correctiveAction)}

        ${sectionLabel("Remarks by Reviewer")}
        ${blockToHtml(remarksByReviewer)}

        <p style="margin:20px 0 16px;">
          Thank you for your proactive effort in reporting and contributing to a safer working environment.
          Appropriate actions have been taken based on your report.
        </p>
        <p style="margin:0;">
          We encourage you to continue reporting any near misses going forward, as this helps us maintain and improve safety standards across all operations.
        </p>`,
  });

  return { subject, html, text };
}
