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
    "Helios Tech Labs",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const html = renderEmailShell({
    eyebrow: "PMS — Equipment Testing",
    title: `Testing reminder — ${days} days to next test`,
    preheader: `${name} is due for testing on ${nextD}.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear Team,</p>
        <p style="margin:0 0 18px;">
          This is an automated reminder for the upcoming testing schedule
          (<strong>${days}</strong> days prior to the next test date).
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background-color:#f8fafc;border-radius:8px;">
          <tr><td style="padding:14px 18px;">
            ${emailInfoRow("Equipment Name", escapeHtml(name))}
            ${emailInfoRow("Equipment Type", escapeHtml(type))}
            ${emailInfoRow("Serial Code", escapeHtml(serial))}
            ${emailInfoRow("Equipment Code", escapeHtml(code))}
            ${emailInfoRow("Last Test Date", escapeHtml(lastD))}
            ${emailInfoRow("Next Test Date", escapeHtml(nextD))}
          </td></tr>
        </table>
        <p style="margin:0 0 16px;">
          Kindly send it out for testing before the next due date to ensure accurate tracking ahead of the next test date.
        </p>
        <p style="margin:0;">Thank you for your cooperation.</p>`,
  });

  return { subject, html, text };
}
