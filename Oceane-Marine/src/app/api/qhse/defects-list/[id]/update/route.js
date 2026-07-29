import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit } from "@/lib/notifications/moduleNotify";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import {
  buildDefectClosedEmailDefectLabel,
  buildDefectClosedTeamEmail,
  buildDefectListReviewUrl,
} from "@/lib/services/email/templates/QHSE/defectClosedTeamEmail";

const VALID_STATUSES = ["Open", "In Progress", "Closed"];

function parseDefectClosedTeamRecipients() {
  const raw = process.env.DEFECT_LIST_CLOSED_EMAIL_TO || "";
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function sendDefectClosedTeamEmailIfNeeded(doc, prevStatus) {
  if (prevStatus === "Closed" || doc.status !== "Closed") return;

  const recipients = parseDefectClosedTeamRecipients();
  const skip =
    process.env.DEFECT_LIST_CLOSED_EMAIL_DISABLED === "1" ||
    process.env.DEFECT_LIST_CLOSED_EMAIL_DISABLED === "true";
  const resendReady =
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim();

  if (skip || recipients.length === 0 || !resendReady) return;

  const defectLabel = buildDefectClosedEmailDefectLabel(doc);
  const reviewUrl = buildDefectListReviewUrl(doc._id);

  try {
    const { subject, html, text } = buildDefectClosedTeamEmail({
      defectLabel,
      reviewUrl,
    });
    await sendResendEmail({ to: recipients, subject, html, text });
  } catch (err) {
    console.error("Defect closed — team email failed:", err.message || err);
  }
}

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const equipmentDefect = await EquipmentDefect.findById(id);
    if (!equipmentDefect) {
      return NextResponse.json(
        { error: "Equipment defect not found" },
        { status: 404 }
      );
    }

    const prevStatus = equipmentDefect.status;

    let body = {};
    try {
      body = await req.json();
    } catch {
      // No body: legacy "close" behaviour
      if (equipmentDefect.status === "Closed") {
        return NextResponse.json(
          { error: "Equipment defect already closed" },
          { status: 400 }
        );
      }
      equipmentDefect.status = "Closed";
      equipmentDefect.completionDate = new Date();
      equipmentDefect.revNo = getNextRevisionNumber(equipmentDefect.revNo);
      await equipmentDefect.save();
      await sendDefectClosedTeamEmailIfNeeded(equipmentDefect, prevStatus);
      return NextResponse.json(
        { message: "Equipment defect closed successfully", data: equipmentDefect },
        { status: 200 }
      );
    }

    // Full edit: equipmentDefect, base, actionRequired, targetDate
    const { status, equipmentDefect: equipmentDefectText, base, actionRequired, targetDate } = body;
    if (equipmentDefectText != null) equipmentDefect.equipmentDefect = equipmentDefectText;
    if (base != null) equipmentDefect.base = base;
    if (actionRequired != null) equipmentDefect.actionRequired = actionRequired;
    if (targetDate != null) equipmentDefect.targetDate = new Date(targetDate);

    if (status && VALID_STATUSES.includes(status)) {
      equipmentDefect.status = status;
      if (status === "Closed") {
        equipmentDefect.completionDate = equipmentDefect.completionDate || new Date();
      } else {
        equipmentDefect.completionDate = null;
        equipmentDefect.closedBy = null;
      }
    }

    equipmentDefect.revNo = getNextRevisionNumber(equipmentDefect.revNo);
    await equipmentDefect.save();
    void notifyEdit("QHSE", "defects-list · update", id);
    await sendDefectClosedTeamEmailIfNeeded(equipmentDefect, prevStatus);
    return NextResponse.json(
      { message: "Defect updated successfully", data: equipmentDefect },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
