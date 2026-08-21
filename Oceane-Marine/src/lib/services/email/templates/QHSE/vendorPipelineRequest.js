/**
 * QHSE — Vendor pipeline (Due Diligence / Sub-Contractor Audit) link request.
 * Shared template — parameterized by formLabel so both stages reuse it.
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
 * @param {{
 *   formLabel: string;
 *   vendorName?: string;
 *   reviewUrl: string;
 *   contextLine?: string;
 * }} p
 * `vendorName` doubles as "recipient name" — pass the auditor's name here when
 * emailing an auditor rather than the vendor, and use `contextLine` to name
 * the vendor the audit is for.
 */
export function buildVendorPipelineRequestEmail({ formLabel, vendorName, reviewUrl, contextLine }) {
  const label = formLabel?.trim() || "Form";
  const name = vendorName?.trim();
  const greeting = name ? `Dear ${name},` : "Dear Sir/Madam,";
  const link = (reviewUrl || "").trim();
  const context = contextLine?.trim();

  const subject = `${label} required — Oceane Group`;

  const text = [
    greeting,
    "",
    `Please complete the ${label} by clicking the link below.`,
    ...(context ? [context] : []),
    "",
    `Link to Access: ${link || "—"}`,
    "",
    "Best regards,",
    "Helios Tech Labs",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const linkHtml = link
    ? emailButton(escapeHtml(link), "Complete Form")
    : `<p style="margin:0 0 16px;">${escapeHtml("—")}</p>`;

  const html = renderEmailShell({
    eyebrow: "QHSE Notification",
    title: `${escapeHtml(label)} Required`,
    preheader: `Please complete the ${label}.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 16px;">
          Please complete the <strong>${escapeHtml(label)}</strong> by clicking the button below.
          ${context ? `<br />${escapeHtml(context)}` : ""}
        </p>
        ${linkHtml}`,
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
 * Public, anonymous form in the QHSE-FORMS app, keyed by vendorId (and
 * optionally other identifiers, e.g. auditorId for the audit-form stage).
 * @param {string} formSlug — e.g. "supplier-questionnaire" or "audit-form"
 * @param {string} vendorId
 * @param {Record<string, string>} [extraParams]
 */
export function buildVendorPipelineReviewUrl(formSlug, vendorId, extraParams = {}) {
  const base = qhseFormsBaseUrl();
  const id = vendorId != null ? String(vendorId).trim() : "";
  const params = new URLSearchParams({ vendorId: id });
  for (const [key, value] of Object.entries(extraParams)) {
    if (value != null && String(value).trim()) {
      params.set(key, String(value).trim());
    }
  }
  return `${base}/forms/${formSlug}?${params.toString()}`;
}
