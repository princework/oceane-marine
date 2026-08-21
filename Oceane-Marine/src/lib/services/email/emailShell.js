/**
 * Shared, professional HTML shell used by every transactional email template
 * in this app, so all of them share one consistent, branded look instead of
 * each hand-rolling its own bare white card.
 *
 * Table-based layout with fully inline styles throughout — email clients
 * (Outlook, the Gmail app, etc.) strip <style> blocks and don't reliably
 * support flexbox/grid/box-shadow, so this deliberately uses old-school HTML
 * email markup rather than modern CSS.
 */

const BRAND_NAME = "Helios Tech Labs";
const BRAND_TAGLINE = "Ship-to-Ship Transfer";

/**
 * @param {{ eyebrow?: string; title: string; bodyHtml: string; preheader?: string }} params
 * @returns {string} full HTML document
 */
export function renderEmailShell({ eyebrow = "", title, bodyHtml, preheader = "" }) {
  const year = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
          <tr>
            <td style="background-color:#0f172a;padding:26px 32px;border-radius:12px 12px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:38px;height:38px;background-color:#f97316;border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#ffffff;">H</span>
                  </td>
                  <td style="padding-left:12px;">
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">${BRAND_NAME.toUpperCase()}</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#94a3b8;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">${BRAND_TAGLINE}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:3px;background-color:#f97316;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:32px 32px 0;">
              ${eyebrow ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11.5px;font-weight:700;color:#c2410c;letter-spacing:1px;text-transform:uppercase;margin:0 0 10px;">${eyebrow}</div>` : ""}
              <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:700;color:#0f172a;line-height:1.35;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;font-family:Georgia,'Times New Roman',serif;font-size:15.5px;line-height:1.65;color:#334155;">
              ${bodyHtml}
            </td>
          </tr>
          <tr><td style="padding:28px 32px 0;"><div style="border-top:1px solid #e2e8f0;line-height:0;font-size:0;">&nbsp;</div></td></tr>
          <tr>
            <td style="padding:20px 32px 30px;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#334155;">
              Best regards,<br />
              <strong style="color:#0f172a;">${BRAND_NAME}</strong>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0f172a;padding:18px 32px;border-radius:0 0 12px 12px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:#94a3b8;line-height:1.6;">
                This is an automated email from the ${BRAND_NAME} STS Management System. Please do not reply directly to this message.
              </p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
          <tr>
            <td style="padding:18px 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8;">
              &copy; ${year} ${BRAND_NAME}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/** Prominent call-to-action button/link. */
export function emailButton(url, label) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;">
  <tr>
    <td style="border-radius:8px;background-color:#f97316;">
      <a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`;
}

const ALERT_PALETTES = {
  warning: { bg: "#fff7ed", labelColor: "#c2410c", textColor: "#7c2d12", border: "#f97316" },
  danger: { bg: "#fef2f2", labelColor: "#b91c1c", textColor: "#7f1d1d", border: "#ef4444" },
  info: { bg: "#eff6ff", labelColor: "#1d4ed8", textColor: "#1e3a8a", border: "#3b82f6" },
};

/** Colored callout box — used for rejection reasons, warnings, expiry notices. */
export function emailAlertBox(label, bodyText, tone = "warning") {
  const p = ALERT_PALETTES[tone] || ALERT_PALETTES.warning;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background-color:${p.bg};border-left:4px solid ${p.border};border-radius:6px;">
  <tr>
    <td style="padding:14px 18px;">
      ${label ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${p.labelColor};text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">${label}</div>` : ""}
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:14.5px;line-height:1.55;color:${p.textColor};white-space:pre-wrap;">${bodyText}</div>
    </td>
  </tr>
</table>`;
}

/** Approved/Rejected style status pill. */
export function emailStatusBadge(text, positive) {
  const bg = positive ? "#dcfce7" : "#fee2e2";
  const color = positive ? "#15803d" : "#b91c1c";
  return `<span style="display:inline-block;padding:5px 14px;border-radius:20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;background-color:${bg};color:${color};">${text}</span>`;
}

/** Key/value row for structured details (reminders, decisions, notifications). */
export function emailInfoRow(label, value) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0;">
  <tr>
    <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#64748b;width:170px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-family:Georgia,'Times New Roman',serif;font-size:14.5px;color:#0f172a;font-weight:600;">${value}</td>
  </tr>
</table>`;
}
