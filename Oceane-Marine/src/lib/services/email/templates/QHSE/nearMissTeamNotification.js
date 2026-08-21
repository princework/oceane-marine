import { renderEmailShell, emailButton, emailInfoRow } from "@/lib/services/email/emailShell";

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
 * QHSE portal for “Link to Access” in team emails only — not API / DB (`NEXT_PUBLIC_BASE_URL`).
 * Override with NEAR_MISS_PORTAL_URL if needed; default is production portal on DigitalOcean.
 */
const DEFAULT_NEAR_MISS_PORTAL_BASE_URL = "https://oceanegroup.oceanemarine.com";

/**
 * Near miss — internal team notification (NEAR_MISS_EMAIL_TO).
 *
 * @param {{
 *   submitterName: string;
 *   incidentDateFormatted: string;
 *   locationLine: string;
 *   reviewUrl: string;
 * }} p
 */
export function buildNearMissTeamNotificationEmail({
  submitterName,
  incidentDateFormatted,
  locationLine,
  reviewUrl,
}) {
  const who = displayOrDash(submitterName);
  const dateStr = displayOrDash(incidentDateFormatted);
  const loc = displayOrDash(locationLine);
  const link = (reviewUrl || "").trim();
  const linkHtml = link
    ? `<a href="${escapeHtml(link)}" style="color:#0369a1;font-weight:600;">Link to Access</a>`
    : escapeHtml("—");
  const linkText = link || "—";

  const subject = `QHSE — Near miss report submitted by ${who}`;

  const text = [
    "Dear Team,",
    "",
    `This is to inform you that a near miss report has been submitted by ${who}`,
    "",
    `Date : ${dateStr}`,
    `Location : ${loc}`,
    "",
    "Please review the submitted report by clicking the below link and take the necessary actions as required.",
    "",
    `Link to Access: ${linkText}`,
    "",
    "Details of the report can be accessed in the system for your reference.",
    "",
    "Best regards,",
    "Helios Tech Labs",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const buttonHtml = link
    ? emailButton(escapeHtml(link), "Review Report")
    : `<p style="margin:0 0 16px;">${escapeHtml("—")}</p>`;

  const html = renderEmailShell({
    eyebrow: "QHSE — Near Miss Report",
    title: `Near miss report submitted by ${escapeHtml(who)}`,
    preheader: `A near miss report has been submitted by ${who} on ${dateStr}.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear Team,</p>
        <p style="margin:0 0 16px;">
          This is to inform you that a near miss report has been submitted by <strong>${escapeHtml(who)}</strong>
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background-color:#f8fafc;border-radius:8px;">
          <tr><td style="padding:14px 18px;">
            ${emailInfoRow("Date", escapeHtml(dateStr))}
            ${emailInfoRow("Location", escapeHtml(loc))}
          </td></tr>
        </table>
        <p style="margin:0 0 16px;">
          Please review the submitted report by clicking the button below and take the necessary actions as required.
        </p>
        ${buttonHtml}
        <p style="margin:0 0 16px;">
          Details of the report can be accessed in the system for your reference.
        </p>`,
  });

  return { subject, html, text };
}

function nearMissPortalBaseUrl() {
  const fromEnv = process.env.NEAR_MISS_PORTAL_URL?.trim();
  const raw = fromEnv || DEFAULT_NEAR_MISS_PORTAL_BASE_URL;
  return raw.replace(/\/$/, "");
}

/**
 * Public near-miss list / review in main app (login required in production).
 * @param {string} recordId — Mongo _id of NearMiss (optional; same URL without id)
 */
export function buildNearMissReviewUrl(recordId) {
  const base = nearMissPortalBaseUrl();
  const path = "/qhse/near-miss";
  const id = recordId != null ? String(recordId).trim() : "";
  return id ? `${base}${path}?report=${encodeURIComponent(id)}` : `${base}${path}`;
}
