/**
 * QHSE — Vendor pipeline decision (Approved/Rejected) sent back to the vendor.
 * Shared template — parameterized by formLabel so both Due Diligence and
 * Sub-Contractor Audit stages reuse it.
 */

import { renderEmailShell, emailStatusBadge, emailAlertBox } from "@/lib/services/email/emailShell";

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
 *   formLabel: string;
 *   vendorName?: string;
 *   rejectionReason?: string;
 *   contextLine?: string;
 * }} p
 * `vendorName` doubles as "recipient name" — pass the auditor's name here
 * when emailing an auditor rather than the vendor, and use `contextLine` to
 * name the vendor the audit is for.
 */
export function buildVendorPipelineDecisionEmail({ decision, formLabel, vendorName, rejectionReason, contextLine }) {
  const label = formLabel?.trim() || "Form";
  const name = vendorName?.trim();
  const greeting = name ? `Dear ${name},` : "Dear Sir/Madam,";
  const isApproved = decision === "Approved";
  const reason = rejectionReason?.trim();
  const context = contextLine?.trim();

  const subject = isApproved
    ? `${label} approved — Oceane Group`
    : `${label} rejected — Oceane Group`;

  const statusLine = isApproved
    ? `Your ${label} has been reviewed and approved.`
    : `Your ${label} has been reviewed and was not approved.`;

  const text = [
    greeting,
    "",
    statusLine,
    ...(context ? [context] : []),
    ...(isApproved
      ? []
      : ["", "Reason for rejection:", reason || "—", "", "Please review the feedback above and resubmit using the same link."]),
    "",
    "Best regards,",
    "Helios Tech Labs",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const rejectionHtml = isApproved
    ? ""
    : `
        ${emailAlertBox("Reason for Rejection", escapeHtml(reason || "—"), "danger")}
        <p style="margin:0 0 16px;">
          Please review the feedback above and resubmit using the same link.
        </p>`;

  const html = renderEmailShell({
    eyebrow: "QHSE Notification",
    title: `${escapeHtml(label)} — ${isApproved ? "Approved" : "Not Approved"}`,
    preheader: statusLine,
    bodyHtml: `
        <p style="margin:0 0 14px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 16px;">${emailStatusBadge(isApproved ? "Approved" : "Rejected", isApproved)}</p>
        <p style="margin:0 0 16px;">
          ${escapeHtml(statusLine)}
          ${context ? `<br />${escapeHtml(context)}` : ""}
        </p>
        ${rejectionHtml}`,
  });

  return { subject, html, text };
}
