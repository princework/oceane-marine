/**
 * STS Operations — checklist form links sent to the mooring master assigned to an operation.
 */

import { renderEmailShell } from "@/lib/services/email/emailShell";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{
 *   operationRef: string;
 *   mooringMasterName?: string;
 *   operationDateFormatted?: string;
 *   rows: { code: string; name: string; url: string }[];
 * }} p
 */
export function buildStsChecklistLinksEmail({
  operationRef,
  mooringMasterName,
  operationDateFormatted,
  rows,
}) {
  const ref = operationRef?.trim() || "—";
  const name = mooringMasterName?.trim();
  const greeting = name ? `Dear ${name},` : "Dear Mooring Master,";
  const dateStr = operationDateFormatted?.trim();
  const items = Array.isArray(rows) ? rows.filter((r) => r && r.url) : [];

  const subject = `STS Checklist Forms – Operation ${ref}`;

  const introLine = dateStr
    ? `Please find below the checklist forms for operation ${ref}, dated ${dateStr}.`
    : `Please find below the checklist forms for operation ${ref}.`;

  const text = [
    greeting,
    "",
    introLine,
    "Each link opens the form with the operation reference already filled in.",
    "",
    ...items.map((r) => `${r.code} — ${r.name}\n${r.url}\n`),
    "Please complete the applicable forms during the operation.",
    "",
    "Best regards,",
    "Helios Tech Labs",
  ].join("\n");

  const rowsHtml = items
    .map(
      (r, i) => `
        <tr>
          <td style="padding:11px 12px;${i < items.length - 1 ? "border-bottom:1px solid #e2e8f0;" : ""}vertical-align:top;white-space:nowrap;font-family:Consolas,Monaco,monospace;font-size:12.5px;color:#c2410c;font-weight:bold;">
            ${escapeHtml(r.code)}
          </td>
          <td style="padding:11px 12px;${i < items.length - 1 ? "border-bottom:1px solid #e2e8f0;" : ""}vertical-align:top;font-size:14px;color:#334155;">
            ${escapeHtml(r.name)}
          </td>
          <td style="padding:11px 12px;${i < items.length - 1 ? "border-bottom:1px solid #e2e8f0;" : ""}vertical-align:top;white-space:nowrap;">
            <a href="${escapeHtml(r.url)}" style="color:#c2410c;font-weight:600;text-decoration:none;font-size:13px;">Open form &rarr;</a>
          </td>
        </tr>`
    )
    .join("");

  const tableHtml = items.length
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
        <thead>
          <tr style="background-color:#f8fafc;">
            <th align="left" style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">Form</th>
            <th align="left" style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">Title</th>
            <th align="left" style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">Link</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`
    : `<p style="margin:0 0 16px;">(No forms available for this operation.)</p>`;

  const html = renderEmailShell({
    eyebrow: "Operations — STS Checklist Forms",
    title: `Checklist forms for Operation ${escapeHtml(ref)}`,
    preheader: `Checklist forms for operation ${ref} are ready.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 18px;">
          ${escapeHtml(introLine)}
          Each link opens the form with the operation reference already filled in.
        </p>
        ${tableHtml}
        <p style="margin:0;">
          Please complete the applicable forms during the operation.
        </p>`,
  });

  return { subject, html, text };
}
