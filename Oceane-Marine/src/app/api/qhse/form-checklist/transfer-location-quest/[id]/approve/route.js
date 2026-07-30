import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TransferLocationQuestionnaire from "@/lib/mongodb/models/qhse-form-checklist/TransferLocationQuestionnaire";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { notifyEdit } from "@/lib/notifications/moduleNotify";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import { buildTransferLocationQuestClientDecisionEmail } from "@/lib/services/email/templates/QHSE/transferLocationQuestClientDecision";

export const runtime = "nodejs";

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function PUT(req, { params }) {
  const guard = await assertQhsePermission("canApprove");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;
    const record = await TransferLocationQuestionnaire.findById(id);

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Transfer Location Questionnaire not found" },
        { status: 404 }
      );
    }

    if (record.status !== "Pending Approval") {
      return NextResponse.json(
        { success: false, error: "Only submissions pending approval can be approved." },
        { status: 400 }
      );
    }

    record.status = "Approved";
    record.approvedBy = guard.user._id;
    record.approvedAt = new Date();
    record.rejectionReason = "";
    record.rejectedBy = null;
    record.rejectedAt = null;
    await record.save();

    // Flip the linked Operation from Draft to Lined Up now that the location
    // details are approved. A separate cron job flips Lined Up -> In Progress
    // once the operation's start date/time arrives (tolerant match — stored
    // refs may carry surrounding whitespace or a trailing comma, same as
    // send-checklist-links).
    const operation = await StsOperation.findOne({
      isLatest: true,
      Operation_Ref_No: { $regex: `^\\s*${escapeRegex(record.operationRef)},?\\s*$` },
    });
    if (operation && operation.operationStatus === "DRAFT") {
      operation.operationStatus = "Lined Up";
      await operation.save();
    }

    void notifyEdit("QHSE", "transfer-location-quest · approve", id);

    if (record.submittedByEmail) {
      const built = buildTransferLocationQuestClientDecisionEmail({
        decision: "Approved",
        operationRef: record.operationRef,
        clientName: record.submittedByName,
      });
      sendResendEmail({
        to: record.submittedByEmail,
        subject: built.subject,
        html: built.html,
        text: built.text,
      }).catch((err) =>
        console.error("[transferLocationQuest] client approval email failed:", err?.message || err)
      );
    }

    return NextResponse.json(
      { success: true, message: "Transfer Location Questionnaire approved.", data: record },
      { status: 200 }
    );
  } catch (error) {
    console.error("Transfer Location Questionnaire approve error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to approve" },
      { status: 500 }
    );
  }
}
