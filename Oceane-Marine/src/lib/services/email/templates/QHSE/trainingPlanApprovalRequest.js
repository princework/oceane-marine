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
 * QHSE — Training Plan awaiting approval (sent to users with qhseRole "approver").
 *
 * @param {{
 *   year: number | string;
 *   submittedByName: string;
 *   reviewUrl: string;
 * }} p
 */
export function buildTrainingPlanApprovalRequestEmail({ year, submittedByName, reviewUrl }) {
  const yearStr = displayOrDash(String(year ?? ""));
  const who = displayOrDash(submittedByName);
  const link = (reviewUrl || "").trim();
  const linkHtml = link
    ? `<a href="${escapeHtml(link)}" style="color:#0369a1;font-weight:600;">Link to Access</a>`
    : escapeHtml("—");
  const linkText = link || "—";

  const subject = `QHSE — Training Plan for ${yearStr} awaiting your approval`;

  const text = [
    "Dear Approver,",
    "",
    `A Training Plan for ${yearStr} has been submitted by ${who} and is awaiting your approval.`,
    "",
    "Please review the submitted plan by clicking the below link and approve or reject it as required.",
    "",
    `Link to Access: ${linkText}`,
    "",
    "Best regards,",
    "Helios Tech Labs",
    "",
    "This is an automated email. Please do not reply.",
  ].join("\n");

  const buttonHtml = link
    ? emailButton(escapeHtml(link), "Review Training Plan")
    : `<p style="margin:0 0 16px;">${escapeHtml("—")}</p>`;

  const html = renderEmailShell({
    eyebrow: "QHSE — Training Plan Approval",
    title: `Training Plan for ${escapeHtml(yearStr)} awaiting your approval`,
    preheader: `A Training Plan for ${yearStr} has been submitted by ${who}.`,
    bodyHtml: `
        <p style="margin:0 0 16px;">Dear Approver,</p>
        <p style="margin:0 0 16px;">
          A Training Plan for <strong>${escapeHtml(yearStr)}</strong> has been submitted by
          <strong>${escapeHtml(who)}</strong> and is awaiting your approval.
        </p>
        <p style="margin:0 0 16px;">
          Please review the submitted plan by clicking the button below and approve or reject it as required.
        </p>
        ${buttonHtml}`,
  });

  return { subject, html, text };
}

const DEFAULT_TRAINING_PLAN_PORTAL_BASE_URL = "https://oceanegroup.oceanemarine.com";

function trainingPlanPortalBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  const raw = fromEnv || DEFAULT_TRAINING_PLAN_PORTAL_BASE_URL;
  return raw.replace(/\/$/, "");
}

/**
 * Protected review page in the main app (login required).
 * @param {string} planId — Mongo _id of TrainingPlan
 */
export function buildTrainingPlanReviewUrl(planId) {
  const base = trainingPlanPortalBaseUrl();
  const id = planId != null ? String(planId).trim() : "";
  return `${base}/qhse/training/plan/${encodeURIComponent(id)}`;
}
