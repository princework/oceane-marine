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
        <p style="margin:0 0 16px;">Dear Approver,</p>
        <p style="margin:0 0 16px;">
          A Training Plan for <strong>${escapeHtml(yearStr)}</strong> has been submitted by
          <strong>${escapeHtml(who)}</strong> and is awaiting your approval.
        </p>
        <p style="margin:0 0 16px;">
          Please review the submitted plan by clicking the below link and approve or reject it as required.
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
