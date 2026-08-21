import { renderEmailShell, emailStatusBadge } from "@/lib/services/email/emailShell";

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
    "Helios Tech Labs",
    "",
    "This is an automated notification. No reply is necessary.",
  ].join("\n");

  const html = renderEmailShell({
    eyebrow: "HR — Oil Major Approval",
    title: "Approval confirmed — great work, team!",
    preheader: `We are now officially approved by ${name}.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear Team,</p>
        <p style="margin:0 0 16px;">${emailStatusBadge("Approved", true)}</p>
        <p style="margin:0 0 16px;">
          We are thrilled to share that we are now officially approved by
          <strong>${escapeHtml(name)}</strong>!
        </p>
        <p style="margin:0 0 16px;">
          This milestone is a testament to the hard work, dedication, and commitment of our entire team.
          We look forward to leveraging this approval to deliver even greater value in our operations and future projects.
        </p>
        <p style="margin:0;">
          Keep up the fantastic work, and let's continue to achieve excellence together!
        </p>`,
  });

  return { subject, html, text };
}
