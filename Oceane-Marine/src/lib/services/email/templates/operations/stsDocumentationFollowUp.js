/**
 * STS Operations — documentation follow-up (in-progress duration or completed + missing docs).
 */

import { renderEmailShell, emailAlertBox } from "@/lib/services/email/emailShell";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{ operationRef: string; operationDateFormatted: string; daysInProgress: number }} p
 */
export function buildStsInProgressDocumentationEmail({ operationRef, operationDateFormatted, daysInProgress }) {
  const ref = operationRef?.trim() || "—";
  const dateStr = operationDateFormatted?.trim() || "—";
  const days = Math.max(1, Number(daysInProgress) || 0);

  const subject = `Follow-up on Operation Status – ${ref}`;

  const text = [
    "Dear Team,",
    "",
    `Please note that the operation ${ref}, dated ${dateStr}, has been in "In Progress" status for ${days} days or more.`,
    "",
    "Kindly recheck and review the status. If the operation has been completed, please update the status accordingly.",
    "",
    "Best regards,",
    "Helios Tech Labs",
  ].join("\n");

  const html = renderEmailShell({
    eyebrow: "Operations — Follow-up",
    title: `Operation ${escapeHtml(ref)} still In Progress`,
    preheader: `Operation ${ref} has been In Progress for ${days} days or more.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear Team,</p>
        <p style="margin:0 0 16px;">
          Please note that the operation <strong>${escapeHtml(ref)}</strong>, dated <strong>${escapeHtml(dateStr)}</strong>,
          has been in &quot;In Progress&quot; status for <strong>${days}</strong> days or more.
        </p>
        <p style="margin:0;">
          Kindly recheck and review the status. If the operation has been completed, please update the status accordingly.
        </p>`,
  });

  return { subject, html, text };
}

/**
 * @param {{ operationRef: string; operationDateFormatted: string; missingLabels: string[] }} p
 */
export function buildStsCompletedMissingDocumentsEmail({ operationRef, operationDateFormatted, missingLabels }) {
  const ref = operationRef?.trim() || "—";
  const dateStr = operationDateFormatted?.trim() || "—";
  const items = Array.isArray(missingLabels) ? missingLabels.filter(Boolean) : [];

  const subject = `Follow-up on Operation Status – ${ref}`;

  const listText = items.length
    ? items.map((l) => ` - ${l}`).join("\n")
    : " - (unspecified)";

  const text = [
    "Dear Team,",
    "",
    `Please note that the operation ${ref}, dated ${dateStr}, is marked as Completed, but the following required documentation is still missing or not linked in the system:`,
    "",
    listText,
    "",
    "Kindly upload or complete the outstanding items as soon as possible.",
    "",
    "Best regards,",
    "Helios Tech Labs",
  ].join("\n");

  const listHtml =
    items.length > 0
      ? `<ul style="margin:0;padding-left:20px;">${items
          .map((l) => `<li style="margin-bottom:6px;">${escapeHtml(l)}</li>`)
          .join("")}</ul>`
      : "(No specific items listed — please review the operation in the STS documentation module.)";

  const html = renderEmailShell({
    eyebrow: "Operations — Follow-up",
    title: `Missing documentation — Operation ${escapeHtml(ref)}`,
    preheader: `Operation ${ref} is marked Completed but documentation is still missing.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear Team,</p>
        <p style="margin:0 0 18px;">
          Please note that the operation <strong>${escapeHtml(ref)}</strong>, dated <strong>${escapeHtml(dateStr)}</strong>,
          is marked as <strong>Completed</strong>, but the following required documentation is still missing or not linked in the system:
        </p>
        ${emailAlertBox("Missing Documentation", listHtml, "warning")}
        <p style="margin:0;">
          Kindly upload or complete the outstanding items as soon as possible.
        </p>`,
  });

  return { subject, html, text };
}
