import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import SubContractorAudit from "@/lib/mongodb/models/qhse-due-diligence/SubContractorAudit";
import MasterVendor from "@/lib/mongodb/models/MasterVendor";
import MasterAuditor from "@/lib/mongodb/models/MasterAuditor";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { notifyEdit } from "@/lib/notifications/moduleNotify";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import { buildVendorPipelineDecisionEmail } from "@/lib/services/email/templates/QHSE/vendorPipelineDecision";

const FORM_LABEL = "Due Diligence Subcontractor Audit";

export async function PUT(req, { params }) {
  const guard = await assertQhsePermission("canApprove");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;
    const record = await SubContractorAudit.findById(id);

    if (!record) {
      return NextResponse.json({ error: "Sub contractor audit not found" }, { status: 404 });
    }

    if (record.status !== "Pending") {
      return NextResponse.json(
        { error: "Only Pending forms can be approved." },
        { status: 403 }
      );
    }

    record.status = "Approved";
    record.approvedBy = guard.user._id;
    record.approvedAt = new Date();
    record.rejectionReason = "";
    record.rejectedBy = null;
    record.rejectedAt = null;
    await record.save();

    void notifyEdit("QHSE", "due-diligence · audit-sub-contractor · approve", id);

    if (record.auditorId) {
      const [auditor, vendor] = await Promise.all([
        MasterAuditor.findById(record.auditorId).select("name email").lean(),
        record.vendorId
          ? MasterVendor.findById(record.vendorId).select("name").lean()
          : Promise.resolve(null),
      ]);
      if (auditor?.email) {
        const built = buildVendorPipelineDecisionEmail({
          decision: "Approved",
          formLabel: FORM_LABEL,
          vendorName: auditor.name,
          contextLine: vendor?.name ? `Vendor: ${vendor.name}` : undefined,
        });
        sendResendEmail({ to: auditor.email, subject: built.subject, html: built.html, text: built.text }).catch(
          (err) => console.error("[subContractorAudit] approval email failed:", err?.message || err)
        );
      }
    }

    return NextResponse.json(
      { success: true, message: "Sub contractor audit approved", data: record },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
