/**
 * QHSE — Transfer Location Questionnaire request sent to the client for a Draft operation.
 */

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
          Please complete the Transfer Location Questionnaire for operation <strong>${escapeHtml(ref)}</strong> by clicking the link below.
        </p>
        <p style="margin:0 0 20px;">
          ${linkHtml}
        </p>
        <p style="margin:0 0 16px;">
          This information is required before the operation can proceed.
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
 * Public, anonymous form in the QHSE-FORMS app.
 * @param {string} operationRef
 */
export function buildTransferLocationQuestReviewUrl(operationRef) {
  const base = qhseFormsBaseUrl();
  const ref = operationRef != null ? String(operationRef).trim() : "";
  return `${base}/forms/transfer-location-quest?operationRef=${encodeURIComponent(ref)}`;
}
