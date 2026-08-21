/**
 * QHSE — Transfer Location Questionnaire decision (Approved/Rejected) sent back to the client.
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
    eyebrow: "QHSE — Transfer Location Questionnaire",
    title: `Operation ${escapeHtml(ref)} — ${isApproved ? "Approved" : "Not Approved"}`,
    preheader: statusLine,
    bodyHtml: `
        <p style="margin:0 0 14px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 16px;">${emailStatusBadge(isApproved ? "Approved" : "Rejected", isApproved)}</p>
        <p style="margin:0 0 16px;">${escapeHtml(statusLine)}</p>
        ${rejectionHtml}`,
  });

  return { subject, html, text };
}
