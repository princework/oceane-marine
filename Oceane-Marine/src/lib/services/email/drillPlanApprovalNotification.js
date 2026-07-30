import { connectDB } from "../../config/connection.js";
import User from "../../mongodb/models/User.js";
import { sendResendEmail } from "./sendResendEmail.js";
import {
  buildDrillPlanApprovalRequestEmail,
  buildDrillPlanReviewUrl,
} from "./templates/QHSE/drillPlanApprovalRequest.js";

/**
 * Notify all QHSE approvers that a Drill Plan needs their review.
 * Fails soft: logs and returns false on any error (caller should not block UX).
 *
 * @param {{ _id: unknown, year?: number, submittedBy?: unknown }} plan
 * @returns {Promise<boolean>}
 */
export async function sendDrillPlanApprovalRequestNotification(plan) {
  try {
    await connectDB();

    const approvers = await User.find({
      qhseRole: "approver",
      isActive: { $ne: false },
    })
      .select("email employeeName")
      .lean();

    const recipients = approvers.map((u) => u.email?.trim()).filter(Boolean);
    if (recipients.length === 0) {
      console.warn(
        "[drillPlanApproval] No recipients: no active User has qhseRole 'approver'"
      );
      return false;
    }

    let submittedByName = "";
    if (plan.submittedBy) {
      const submitter = await User.findById(plan.submittedBy).select("employeeName").lean();
      submittedByName = submitter?.employeeName || "";
    }

    const reviewUrl = buildDrillPlanReviewUrl(plan._id);
    const { subject, html, text } = buildDrillPlanApprovalRequestEmail({
      year: plan.year,
      submittedByName,
      reviewUrl,
    });

    await sendResendEmail({ to: recipients, subject, html, text });
    return true;
  } catch (err) {
    console.error("[drillPlanApproval] Resend failed:", err?.message || err);
    return false;
  }
}
