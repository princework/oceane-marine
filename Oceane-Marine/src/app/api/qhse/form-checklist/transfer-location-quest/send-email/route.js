import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import MasterStsClient from "@/lib/mongodb/models/MasterStsClient";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import {
  buildTransferLocationQuestClientRequestEmail,
  buildTransferLocationQuestReviewUrl,
} from "@/lib/services/email/templates/QHSE/transferLocationQuestClientRequest";

export const runtime = "nodejs";

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Emails the Transfer Location Questionnaire link to the client tied to a
 * Draft operation. Mirrors /api/operations/sts/send-checklist-links, but the
 * recipient comes from MasterStsClient (matched against the operation's
 * free-text `client` name) instead of MooringMaster.
 * Body: { operationRef: string }
 */
export async function POST(req) {
  const guard = await assertQhsePermission("canCreate");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const body = await req.json().catch(() => ({}));
    const operationRef = body?.operationRef?.trim();
    if (!operationRef) {
      return NextResponse.json(
        { success: false, error: "Operation reference is required" },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Email is not configured. RESEND_API_KEY and RESEND_FROM_EMAIL must be set.",
        },
        { status: 500 }
      );
    }

    const operation = await StsOperation.findOne({
      isLatest: true,
      Operation_Ref_No: { $regex: `^\\s*${escapeRegex(operationRef)},?\\s*$` },
    });

    if (!operation) {
      return NextResponse.json(
        { success: false, error: `Operation ${operationRef} was not found` },
        { status: 404 }
      );
    }

    if (operation.operationStatus !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: `Operation ${operationRef} is not a Draft operation.` },
        { status: 400 }
      );
    }

    const clientName = operation.client?.trim();
    if (!clientName) {
      return NextResponse.json(
        { success: false, error: `Operation ${operationRef} has no client set.` },
        { status: 400 }
      );
    }

    const client = await MasterStsClient.findOne({
      name: { $regex: `^${escapeRegex(clientName)}$`, $options: "i" },
    });

    const recipient = client?.email?.trim();
    if (!recipient) {
      return NextResponse.json(
        {
          success: false,
          error: `Client "${clientName}" has no email address. Add it under Master Data → Clients & Agents.`,
        },
        { status: 400 }
      );
    }

    const reviewUrl = buildTransferLocationQuestReviewUrl(operationRef);
    const built = buildTransferLocationQuestClientRequestEmail({
      operationRef,
      clientName,
      reviewUrl,
    });

    await sendResendEmail({
      to: recipient,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });

    operation.transferLocationQuestSentAt = new Date();
    operation.transferLocationQuestSentTo = recipient;
    await operation.save();

    return NextResponse.json({
      success: true,
      message: `Questionnaire link sent to ${clientName} (${recipient})`,
      recipient,
      clientName,
    });
  } catch (error) {
    console.error("Send transfer location questionnaire email error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
