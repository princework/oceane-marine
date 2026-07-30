import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TransferLocationQuestionnaire from "@/lib/mongodb/models/qhse-form-checklist/TransferLocationQuestionnaire";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { notifyEdit } from "@/lib/notifications/moduleNotify";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import { buildTransferLocationQuestClientDecisionEmail } from "@/lib/services/email/templates/QHSE/transferLocationQuestClientDecision";

export const runtime = "nodejs";

export async function PUT(req, { params }) {
  const guard = await assertQhsePermission("canApprove");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const rejectionReason =
      typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";

    if (!rejectionReason) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required." },
        { status: 400 }
      );
    }

    const record = await TransferLocationQuestionnaire.findById(id);

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Transfer Location Questionnaire not found" },
        { status: 404 }
      );
    }

    if (record.status !== "Pending Approval") {
      return NextResponse.json(
        { success: false, error: "Only submissions pending approval can be rejected." },
        { status: 400 }
      );
    }

    record.status = "Rejected";
    record.rejectionReason = rejectionReason;
    record.rejectedBy = guard.user._id;
    record.rejectedAt = new Date();
    record.approvedBy = null;
    record.approvedAt = null;
    await record.save();

    // Operation stays DRAFT — the admin can resend the client link to collect
    // a corrected submission (see .../send-email).

    void notifyEdit("QHSE", "transfer-location-quest · reject", id);

    if (record.submittedByEmail) {
      const built = buildTransferLocationQuestClientDecisionEmail({
        decision: "Rejected",
        operationRef: record.operationRef,
        clientName: record.submittedByName,
        rejectionReason,
      });
      sendResendEmail({
        to: record.submittedByEmail,
        subject: built.subject,
        html: built.html,
        text: built.text,
      }).catch((err) =>
        console.error("[transferLocationQuest] client rejection email failed:", err?.message || err)
      );
    }

    return NextResponse.json(
      { success: true, message: "Transfer Location Questionnaire rejected.", data: record },
      { status: 200 }
    );
  } catch (error) {
    console.error("Transfer Location Questionnaire reject error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reject" },
      { status: 500 }
    );
  }
}
