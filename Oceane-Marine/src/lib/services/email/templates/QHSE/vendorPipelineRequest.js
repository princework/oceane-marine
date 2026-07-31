/**
 * QHSE — Vendor pipeline (Due Diligence / Sub-Contractor Audit) link request.
 * Shared template — parameterized by formLabel so both stages reuse it.
 */

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
    "Oceane Group",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const linkHtml = link
    ? `<a href="${escapeHtml(link)}" style="color:#0369a1;font-weight:600;">Link to Access</a>`
    : escapeHtml("—");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:#1e293b;background:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;">
    <tr>
      <td style="padding:28px 28px 8px;">
        <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 16px;">
          Please complete the <strong>${escapeHtml(label)}</strong> by clicking the link below.
          ${context ? `<br />${escapeHtml(context)}` : ""}
        </p>
        <p style="margin:0 0 20px;">
          ${linkHtml}
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

const DEFAULT_QHSE_FORMS_BASE_URL = "https://qhse-forms.oceanemarine.com";

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
