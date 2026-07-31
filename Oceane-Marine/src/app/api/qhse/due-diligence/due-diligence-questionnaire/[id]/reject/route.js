import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence";
import MasterVendor from "@/lib/mongodb/models/MasterVendor";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { notifyEdit } from "@/lib/notifications/moduleNotify";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import { buildVendorPipelineDecisionEmail } from "@/lib/services/email/templates/QHSE/vendorPipelineDecision";

const FORM_LABEL = "Supplier Due Diligence Questionnaire";

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
      return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 });
    }

    const record = await SupplierDueDiligence.findById(id);

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    if (record.status !== "Pending") {
      return NextResponse.json(
        { error: "Only Pending forms can be rejected." },
        { status: 403 }
      );
    }

    record.status = "Rejected";
    record.rejectionReason = rejectionReason;
    record.rejectedBy = guard.user._id;
    record.rejectedAt = new Date();
    record.approvedBy = null;
    record.approvedAt = null;
    await record.save();

    void notifyEdit("QHSE", "due-diligence · due-diligence-questionnaire · reject", id);

    if (record.vendorId) {
      const vendor = await MasterVendor.findById(record.vendorId).select("name email").lean();
      if (vendor?.email) {
        const built = buildVendorPipelineDecisionEmail({
          decision: "Rejected",
          formLabel: FORM_LABEL,
          vendorName: vendor.name,
          rejectionReason,
        });
        sendResendEmail({ to: vendor.email, subject: built.subject, html: built.html, text: built.text }).catch(
          (err) => console.error("[dueDiligence] rejection email failed:", err?.message || err)
        );
      }
    }

    return NextResponse.json(
      { message: "Supplier Due Diligence rejected", data: record },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
