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
 * QHSE defects list portal URL for emails (not API base). Override DEFECT_LIST_PORTAL_URL.
 */
const DEFAULT_DEFECT_LIST_PORTAL_BASE_URL = "https://oceanegroup.oceanemarine.com";

function defectListPortalBaseUrl() {
  const fromEnv = process.env.DEFECT_LIST_PORTAL_URL?.trim();
  const raw = fromEnv || DEFAULT_DEFECT_LIST_PORTAL_BASE_URL;
  return raw.replace(/\/$/, "");
}

/**
 * @param {string} [recordId]
 */
export function buildDefectListReviewUrl(recordId) {
  const base = defectListPortalBaseUrl();
  const path = "/qhse/defects-list/create/list";
  const id = recordId != null ? String(recordId).trim() : "";
  return id ? `${base}${path}?defect=${encodeURIComponent(id)}` : `${base}${path}`;
}

/**
 * Equipment defect closed — notify team (DEFECT_LIST_CLOSED_EMAIL_TO).
 *
 * @param {{
 *   defectLabel: string;
 *   reviewUrl: string;
 * }} p
 */
export function buildDefectClosedTeamEmail({ defectLabel, reviewUrl }) {
  const label = displayOrDash(defectLabel);
  const link = (reviewUrl || "").trim();
  const linkHtml = link
    ? `<a href="${escapeHtml(link)}" style="color:#0369a1;font-weight:600;">Link to check the defect</a>`
    : escapeHtml("—");
  const linkText = link || "—";

  const subject = `QHSE — Defect resolved and closed — ${label}`;

  const text = [
    "Dear team,",
    "",
    `This is to inform you that the defect ${label} has been successfully resolved and closed.`,
    "",
    "Link to check the defect",
    linkText,
    "",
    "Kindly review the update in the system. If you have any concerns or require further clarification, please feel free to raise them.",
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
        <p style="margin:0 0 16px;">Dear team,</p>
        <p style="margin:0 0 20px;">
          This is to inform you that the defect <strong>${escapeHtml(label)}</strong> has been successfully resolved and closed.
        </p>
        <p style="margin:0 0 20px;">
          ${linkHtml}
        </p>
        <p style="margin:0 0 16px;">
          Kindly review the update in the system. If you have any concerns or require further clarification, please feel free to raise them.
        </p>
        <p style="margin:0 0 16px;">Thank you for your cooperation.</p>
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

export function buildDefectClosedEmailDefectLabel(doc) {
  const serial = doc.serialNumber?.trim();
  // Name the PMS unit when it's linked — "2026-004 — EQ-014 Hydraulic Winch:
  // brake pad worn" tells the reader what was fixed without opening the record.
  const equipment = [doc.equipmentCode, doc.equipmentName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  const description = doc.equipmentDefect?.trim() || "—";
  const title = equipment ? `${equipment}: ${description}` : description;
  if (serial) return `${serial} — ${title}`;
  return title;
}
