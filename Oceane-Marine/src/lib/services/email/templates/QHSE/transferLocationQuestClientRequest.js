/**
 * QHSE — Transfer Location Questionnaire request sent to the client for a Draft operation.
 */

import { renderEmailShell, emailButton } from "@/lib/services/email/emailShell";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{ operationRef: string; clientName?: string; reviewUrl: string }} p
 */
export function buildTransferLocationQuestClientRequestEmail({ operationRef, clientName, reviewUrl }) {
  const ref = operationRef?.trim() || "—";
  const name = clientName?.trim();
  const greeting = name ? `Dear ${name},` : "Dear Sir/Madam,";
  const link = (reviewUrl || "").trim();

  const subject = `Transfer Location Questionnaire required – Operation ${ref}`;

  const text = [
    greeting,
    "",
    `Please complete the Transfer Location Questionnaire for operation ${ref} by clicking the link below.`,
    "",
    `Link to Access: ${link || "—"}`,
    "",
    "This information is required before the operation can proceed.",
    "",
    "Best regards,",
    "Helios Tech Labs",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const linkHtml = link
    ? emailButton(escapeHtml(link), "Complete Questionnaire")
    : `<p style="margin:0 0 16px;">${escapeHtml("—")}</p>`;

  const html = renderEmailShell({
    eyebrow: "QHSE — Transfer Location Questionnaire",
    title: `Questionnaire required for Operation ${escapeHtml(ref)}`,
    preheader: `Please complete the Transfer Location Questionnaire for operation ${ref}.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 16px;">
          Please complete the Transfer Location Questionnaire for operation <strong>${escapeHtml(ref)}</strong> by clicking the button below.
        </p>
        ${linkHtml}
        <p style="margin:0 0 16px;">
          This information is required before the operation can proceed.
        </p>`,
  });

  return { subject, html, text };
}

const DEFAULT_QHSE_FORMS_BASE_URL = "https://oceane-marine-fgbs.vercel.app";

function qhseFormsBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_QHSE_FORMS_BASE_URL?.trim();
  const raw = fromEnv || DEFAULT_QHSE_FORMS_BASE_URL;
  return raw.replace(/\/$/, "");
}

/**
 * Public, anonymous form in the QHSE-FORMS app.
 * @param {string} operationRef
 */
export function buildTransferLocationQuestReviewUrl(operationRef) {
  const base = qhseFormsBaseUrl();
  const ref = operationRef != null ? String(operationRef).trim() : "";
  return `${base}/forms/transfer-location-quest?operationRef=${encodeURIComponent(ref)}`;
}
