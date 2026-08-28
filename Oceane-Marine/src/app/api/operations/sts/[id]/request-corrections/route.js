import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import FormCorrectionRequest from "@/lib/mongodb/models/sts-documentation/FormCorrectionRequest";
import { STS_CHECKLIST_FORMS, stsChecklistExternalUrl } from "@/lib/operations/stsChecklistForms";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import { buildFormCorrectionRequestEmail } from "@/lib/services/email/templates/operations/formCorrectionRequest";

// MooringMaster is referenced by StsOperation.mooringMaster — import so populate() can resolve it.
import "@/lib/mongodb/models/MooringMaster";

/**
 * Flags one or more checklist forms on an operation as needing correction, emails the
 * assigned mooring master a single message listing every flagged form (each with its
 * pre-filled update link and the admin's comment), and logs one FormCorrectionRequest
 * per form for the audit trail.
 *
 * Body: { items: { formNo: string, comment: string }[] }
 */
export async function POST(req, { params }) {
  try {
    const sessionUser = await getSessionUser();
    const role = sessionUser?.operationsRole;
    if (!sessionUser || (role !== "admin" && role !== "editor")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin or editor role required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : [];

    const cleanedItems = items
      .map((item) => ({
        formNo: String(item?.formNo || "").trim(),
        comment: String(item?.comment || "").trim(),
      }))
      .filter((item) => item.formNo && item.comment);

    if (!cleanedItems.length) {
      return NextResponse.json(
        { success: false, error: "Select at least one form and add a correction comment." },
        { status: 400 }
      );
    }

    const formsByNo = new Map(STS_CHECKLIST_FORMS.map((f) => [f.formNo, f]));
    const unknownFormNo = cleanedItems.find((item) => !formsByNo.has(item.formNo));
    if (unknownFormNo) {
      return NextResponse.json(
        { success: false, error: `Unknown form: ${unknownFormNo.formNo}` },
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

    const operation = await StsOperation.findById(id).populate("mooringMaster", "name email");
    if (!operation) {
      return NextResponse.json(
        { success: false, error: "Operation not found" },
        { status: 404 }
      );
    }

    const mooringMaster = operation.mooringMaster;
    if (!mooringMaster) {
      return NextResponse.json(
        {
          success: false,
          error: "No mooring master is assigned to this operation. Assign one on the operation first.",
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

    const emailItems = cleanedItems.map((item) => {
      const form = formsByNo.get(item.formNo);
      return {
        formNo: item.formNo,
        formTitle: form.title,
        comment: item.comment,
        url: stsChecklistExternalUrl(item.formNo, operation.Operation_Ref_No, { mode: "update" }),
      };
    });

    const built = buildFormCorrectionRequestEmail({
      operationRef: operation.Operation_Ref_No,
      mooringMasterName: mooringMaster.name,
      items: emailItems,
    });

    await sendResendEmail({
      to: recipient,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });

    const requestedBy = { name: sessionUser.employeeName || "", email: sessionUser.email || "" };
    const sentTo = { name: mooringMaster.name || "", email: recipient };
    const sentAt = new Date();

    await FormCorrectionRequest.insertMany(
      emailItems.map((item) => ({
        operationRef: operation.Operation_Ref_No,
        formNo: item.formNo,
        formTitle: item.formTitle,
        comment: item.comment,
        requestedBy,
        sentTo,
        sentAt,
      }))
    );

    return NextResponse.json({
      success: true,
      message: `Correction request sent to ${mooringMaster.name || "mooring master"} (${recipient}) for ${emailItems.length} form${emailItems.length === 1 ? "" : "s"}.`,
      recipient,
      count: emailItems.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send correction request" },
      { status: 500 }
    );
  }
}
