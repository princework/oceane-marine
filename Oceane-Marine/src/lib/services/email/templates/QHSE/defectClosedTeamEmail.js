import { renderEmailShell, emailButton } from "@/lib/services/email/emailShell";

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
    ? emailButton(escapeHtml(link), "View Defect")
    : `<p style="margin:0 0 16px;">${escapeHtml("—")}</p>`;
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
    "Helios Tech Labs",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const html = renderEmailShell({
    eyebrow: "QHSE — Defect Closed",
    title: "Defect resolved and closed",
    preheader: `The defect ${label} has been resolved and closed.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear team,</p>
        <p style="margin:0 0 18px;">
          This is to inform you that the defect <strong>${escapeHtml(label)}</strong> has been successfully resolved and closed.
        </p>
        ${linkHtml}
        <p style="margin:0 0 16px;">
          Kindly review the update in the system. If you have any concerns or require further clarification, please feel free to raise them.
        </p>
        <p style="margin:0;">Thank you for your cooperation.</p>`,
  });

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
