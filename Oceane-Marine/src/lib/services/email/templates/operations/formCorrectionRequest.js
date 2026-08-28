/**
 * STS Operations — checklist form correction requests sent to the mooring master
 * assigned to an operation, after the admin flags specific forms as needing a redo.
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
 *   items: { formNo: string; formTitle: string; url: string; comment: string }[];
 * }} p
 */
export function buildFormCorrectionRequestEmail({ operationRef, mooringMasterName, items }) {
  const ref = operationRef?.trim() || "—";
  const name = mooringMasterName?.trim();
  const greeting = name ? `Dear ${name},` : "Dear Mooring Master,";
  const list = Array.isArray(items) ? items.filter((i) => i && i.url) : [];

  const subject = `Correction Needed – Checklist Forms for Operation ${ref}`;

  const introLine = `Please review and re-submit the following form${
    list.length === 1 ? "" : "s"
  } for operation ${ref}. Each link opens the form pre-filled with your previous submission — only the details noted below need correcting.`;

  const text = [
    greeting,
    "",
    introLine,
    "",
    ...list.map(
      (i) =>
        `${i.formNo} — ${i.formTitle}\nLink: ${i.url}\nCorrection needed: ${i.comment}\n`
    ),
    "Please make the corrections and resubmit as soon as possible.",
    "",
    "Best regards,",
    "Helios Tech Labs",
  ].join("\n");

  const cardsHtml = list
    .map(
      (i) => `
        <div style="margin:0 0 16px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:8px;">
          <p style="margin:0 0 6px;font-family:Consolas,Monaco,monospace;font-size:12.5px;color:#c2410c;font-weight:bold;">
            ${escapeHtml(i.formNo)}
          </p>
          <p style="margin:0 0 10px;font-size:14px;color:#334155;font-weight:600;">
            ${escapeHtml(i.formTitle)}
          </p>
          <p style="margin:0 0 10px;">
            <a href="${escapeHtml(i.url)}" style="color:#c2410c;font-weight:600;text-decoration:none;font-size:13px;">Open form (pre-filled) &rarr;</a>
          </p>
          <p style="margin:0;padding:10px 12px;background-color:#fff7ed;border-left:3px solid #f97316;font-size:13px;color:#7c2d12;">
            <strong>Correction needed:</strong> ${escapeHtml(i.comment)}
          </p>
        </div>`
    )
    .join("");

  const bodyItemsHtml = list.length
    ? cardsHtml
    : `<p style="margin:0 0 16px;">(No forms were flagged for correction.)</p>`;

  const html = renderEmailShell({
    eyebrow: "Operations — Correction Requested",
    title: `Correction needed for Operation ${escapeHtml(ref)}`,
    preheader: `${list.length} form${list.length === 1 ? "" : "s"} need correction for operation ${ref}.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 18px;">${escapeHtml(introLine)}</p>
        ${bodyItemsHtml}
        <p style="margin:0;">
          Please make the corrections and resubmit as soon as possible.
        </p>`,
  });

  return { subject, html, text };
}
