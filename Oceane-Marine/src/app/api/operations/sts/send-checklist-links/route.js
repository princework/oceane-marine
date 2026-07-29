import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { buildStsChecklistLinkRows } from "@/lib/operations/stsChecklistForms";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import { buildStsChecklistLinksEmail } from "@/lib/services/email/templates/operations/stsChecklistLinks";

// MooringMaster is referenced by StsOperation.mooringMaster — import so populate() can resolve it.
import "@/lib/mongodb/models/MooringMaster";

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatOperationDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "";
  }
}

/**
 * Emails the STS checklist form links for an operation to the mooring master assigned to it.
 * Body: { operationRef: string }
 */
export async function POST(req) {
  try {
    const sessionUser = await getSessionUser();
    const role = sessionUser?.operationsRole;
    if (!sessionUser || (role !== "admin" && role !== "editor")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin or editor role required" },
        { status: 403 }
      );
    }

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

    await connectDB();

    // Stored refs may carry surrounding whitespace or a trailing comma — match tolerantly.
    const operation = await StsOperation.findOne({
      isLatest: true,
      Operation_Ref_No: { $regex: `^\\s*${escapeRegex(operationRef)},?\\s*$` },
    })
      .populate("mooringMaster", "name email")
      .lean();

    if (!operation) {
      return NextResponse.json(
        { success: false, error: `Operation ${operationRef} was not found` },
        { status: 404 }
      );
    }

    const mooringMaster = operation.mooringMaster;
    if (!mooringMaster) {
      return NextResponse.json(
        {
          success: false,
          error: `No mooring master is assigned to operation ${operationRef}. Assign one on the operation first.`,
        },
        { status: 400 }
      );
    }

    const recipient = mooringMaster.email?.trim();
    if (!recipient) {
      return NextResponse.json(
        {
          success: false,
          error: `Mooring master "${mooringMaster.name || "—"}" has no email address. Add it under Master Data → Mooring Masters.`,
        },
        { status: 400 }
      );
    }

    const rows = buildStsChecklistLinkRows(operationRef);
    const built = buildStsChecklistLinksEmail({
      operationRef,
      mooringMasterName: mooringMaster.name,
      operationDateFormatted: formatOperationDate(operation.operationStartTime),
      rows,
    });

    await sendResendEmail({
      to: recipient,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });

    return NextResponse.json({
      success: true,
      message: `Checklist links sent to ${mooringMaster.name || "mooring master"} (${recipient})`,
      recipient,
      mooringMasterName: mooringMaster.name || "",
      formCount: rows.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send checklist links" },
      { status: 500 }
    );
  }
}
