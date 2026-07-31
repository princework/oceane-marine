import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterVendor from "@/lib/mongodb/models/MasterVendor";
import MasterAuditor from "@/lib/mongodb/models/MasterAuditor";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import {
  buildVendorPipelineRequestEmail,
  buildVendorPipelineReviewUrl,
} from "@/lib/services/email/templates/QHSE/vendorPipelineRequest";

const FORM_LABEL = "Due Diligence Subcontractor Audit";

/**
 * Emails the Sub-Contractor Audit link to the internal auditor assigned to
 * visit the vendor — NOT the vendor. Hard-gated: the vendor's Due Diligence
 * Questionnaire must be Approved first.
 * Body: { vendorId: string, auditorId: string }
 */
export async function POST(req) {
  const guard = await assertQhsePermission("canCreate");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = body?.vendorId?.trim();
    const auditorId = body?.auditorId?.trim();
    if (!vendorId) {
      return NextResponse.json({ success: false, error: "vendorId is required" }, { status: 400 });
    }
    if (!auditorId) {
      return NextResponse.json({ success: false, error: "auditorId is required" }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
      return NextResponse.json(
        { success: false, error: "Email is not configured. RESEND_API_KEY and RESEND_FROM_EMAIL must be set." },
        { status: 500 }
      );
    }

    const vendor = await MasterVendor.findById(vendorId);
    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    const auditor = await MasterAuditor.findById(auditorId);
    if (!auditor) {
      return NextResponse.json({ success: false, error: "Auditor not found" }, { status: 404 });
    }
    if (!auditor.email) {
      return NextResponse.json(
        { success: false, error: `Auditor "${auditor.name}" has no email address.` },
        { status: 400 }
      );
    }

    const dueDiligence = await SupplierDueDiligence.findOne({ vendorId }).select("status").lean();
    if (!dueDiligence || dueDiligence.status !== "Approved") {
      return NextResponse.json(
        {
          success: false,
          error: `Vendor "${vendor.name}" does not have an Approved Due Diligence Questionnaire yet.`,
        },
        { status: 400 }
      );
    }

    const reviewUrl = buildVendorPipelineReviewUrl("audit-form", vendorId, { auditorId });
    const built = buildVendorPipelineRequestEmail({
      formLabel: FORM_LABEL,
      vendorName: auditor.name,
      contextLine: `Vendor: ${vendor.name}`,
      reviewUrl,
    });

    await sendResendEmail({ to: auditor.email, subject: built.subject, html: built.html, text: built.text });

    return NextResponse.json({
      success: true,
      message: `Audit link sent to ${auditor.name} (${auditor.email}) for vendor ${vendor.name}`,
      recipient: auditor.email,
    });
  } catch (error) {
    console.error("Send sub-contractor audit email error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to send email" }, { status: 500 });
  }
}
