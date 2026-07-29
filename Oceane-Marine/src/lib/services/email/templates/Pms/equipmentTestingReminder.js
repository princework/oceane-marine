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
 * PMS — automated reminder N calendar days before equipment `nextTestDate` (UTC).
 *
 * @param {{
 *   daysPrior: number;
 *   equipmentName: string;
 *   equipmentType?: string;
 *   serialCode?: string;
 *   equipmentCode?: string;
 *   lastTestDateFormatted: string;
 *   nextTestDateFormatted: string;
 * }} p
 */
export function buildPmsEquipmentTestingReminderEmail({
  daysPrior,
  equipmentName,
  equipmentType = "",
  serialCode = "",
  equipmentCode = "",
  lastTestDateFormatted,
  nextTestDateFormatted,
}) {
  const days = Number(daysPrior) || 0;
  const name = displayOrDash(equipmentName);
  const type = displayOrDash(equipmentType);
  const serial = displayOrDash(serialCode);
  const code = displayOrDash(equipmentCode);
  const lastD = lastTestDateFormatted?.trim() || "—";
  const nextD = nextTestDateFormatted?.trim() || "—";

  const subjectSuffix =
    serialCode?.trim() ||
    equipmentCode?.trim() ||
    equipmentName?.trim() ||
    "Equipment";

  const subject = `PMS — Equipment testing reminder (${days} days before next test) — ${subjectSuffix}`;

  const text = [
    "Dear Team,",
    "",
    `This is an automated reminder for the upcoming testing schedule (${days} days prior to the next test date).`,
    "",
    `Equipment Name: ${name}`,
    `Equipment Type: ${type}`,
    `Serial code: ${serial}`,
    `Equipment code: ${code}`,
    `Last test date: ${lastD}`,
    `Next Test date: ${nextD}`,
    "",
    "Kindly send it out for testing before the next due date to ensure accurate tracking ahead of the next test date.",
    "",
    "Thank you for your cooperation.",
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
          This is an automated reminder for the upcoming testing schedule
          (<strong>${days}</strong> days prior to the next test date).
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;font-size:15px;">
          <tr><td style="padding:6px 0;color:#64748b;width:160px;vertical-align:top;">Equipment Name</td><td style="padding:6px 0;"><strong>${escapeHtml(name)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Equipment Type</td><td style="padding:6px 0;"><strong>${escapeHtml(type)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Serial code</td><td style="padding:6px 0;"><strong>${escapeHtml(serial)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Equipment code</td><td style="padding:6px 0;"><strong>${escapeHtml(code)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Last test date</td><td style="padding:6px 0;"><strong>${escapeHtml(lastD)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Next Test date</td><td style="padding:6px 0;"><strong>${escapeHtml(nextD)}</strong></td></tr>
        </table>
        <p style="margin:0 0 16px;">
          Kindly send it out for testing before the next due date to ensure accurate tracking ahead of the next test date.
        </p>
        <p style="margin:0 0 8px;">Thank you for your cooperation.</p>
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
