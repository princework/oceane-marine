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
    "Oceane Group",
    "",
    "This is an automated email. Please do not reply.",
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
          This is an automated notification that the <strong>${escapeHtml(endD)}</strong> for
          <strong>${escapeHtml(equip)}</strong>, <strong>${escapeHtml(loc)}</strong>, scheduled on
          <strong>${escapeHtml(endD)}</strong>, has been exceeded by more than 2 days.
        </p>
        <p style="margin:0 0 16px;">
          Kindly review the status of this activity and take the necessary action. If the task has been completed,
          please update the system accordingly. If still in progress, ensure the timeline is revised and updated.
        </p>
        <p style="margin:0 0 16px;">
          Your prompt attention to this matter is highly appreciated to maintain accurate warehouse management records.
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
