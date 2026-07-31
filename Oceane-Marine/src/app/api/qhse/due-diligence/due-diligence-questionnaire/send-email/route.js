import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterVendor from "@/lib/mongodb/models/MasterVendor";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import {
  buildVendorPipelineRequestEmail,
  buildVendorPipelineReviewUrl,
} from "@/lib/services/email/templates/QHSE/vendorPipelineRequest";

const FORM_LABEL = "Supplier Due Diligence Questionnaire";

/**
 * Emails the Due Diligence Questionnaire link to a vendor.
 * Body: { vendorId: string }
 */
export async function POST(req) {
  const guard = await assertQhsePermission("canCreate");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = body?.vendorId?.trim();
    if (!vendorId) {
      return NextResponse.json({ success: false, error: "vendorId is required" }, { status: 400 });
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
    if (!vendor.email) {
      return NextResponse.json(
        { success: false, error: `Vendor "${vendor.name}" has no email address.` },
        { status: 400 }
      );
    }

    const reviewUrl = buildVendorPipelineReviewUrl("supplier-questionnaire", vendorId);
    const built = buildVendorPipelineRequestEmail({
      formLabel: FORM_LABEL,
      vendorName: vendor.name,
      reviewUrl,
    });

    await sendResendEmail({ to: vendor.email, subject: built.subject, html: built.html, text: built.text });

    return NextResponse.json({
      success: true,
      message: `Questionnaire link sent to ${vendor.name} (${vendor.email})`,
      recipient: vendor.email,
    });
  } catch (error) {
    console.error("Send due diligence email error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to send email" }, { status: 500 });
  }
}
