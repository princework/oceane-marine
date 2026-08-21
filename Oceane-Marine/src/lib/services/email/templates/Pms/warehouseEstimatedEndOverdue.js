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
 * PMS Warehouse — estimated end date exceeded by more than 2 calendar days (UTC).
 *
 * @param {{
 *   equipmentName: string;
 *   locationLabel: string;
 *   estimatedEndDateFormatted: string;
 * }} p
 */
export function buildPmsWarehouseEstimatedEndOverdueEmail({
  equipmentName,
  locationLabel,
  estimatedEndDateFormatted,
}) {
  const equip = displayOrDash(equipmentName);
  const loc = displayOrDash(locationLabel);
  const endD = estimatedEndDateFormatted?.trim() || "—";

  const subject = `PMS Warehouse — Estimated end date exceeded — ${equip}`;

  const text = [
    "Dear Team,",
    "",
    `This is an automated notification that the ${endD} for ${equip}, ${loc}, scheduled on ${endD}, has been exceeded by more than 2 days.`,
    "",
    "Kindly review the status of this activity and take the necessary action. If the task has been completed, please update the system accordingly. If still in progress, ensure the timeline is revised and updated.",
    "",
    "Your prompt attention to this matter is highly appreciated to maintain accurate warehouse management records.",
    "",
    "Best regards,",
    "Helios Tech Labs",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const html = renderEmailShell({
    eyebrow: "PMS — Warehouse",
    title: "Estimated end date exceeded",
    preheader: `${equip} at ${loc} was scheduled to end on ${endD} — overdue by more than 2 days.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear Team,</p>
        <p style="margin:0 0 18px;">
          This is an automated notification that the estimated end date for the item below has been exceeded by more than 2 days.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;background-color:#f8fafc;border-radius:8px;">
          <tr><td style="padding:14px 18px;">
            ${emailInfoRow("Equipment", escapeHtml(equip))}
            ${emailInfoRow("Location", escapeHtml(loc))}
            ${emailInfoRow("Estimated End Date", escapeHtml(endD))}
          </td></tr>
        </table>
        <p style="margin:0 0 16px;">
          Kindly review the status of this activity and take the necessary action. If the task has been completed,
          please update the system accordingly. If still in progress, ensure the timeline is revised and updated.
        </p>
        <p style="margin:0;">
          Your prompt attention to this matter is highly appreciated to maintain accurate warehouse management records.
        </p>`,
  });

  return { subject, html, text };
}
