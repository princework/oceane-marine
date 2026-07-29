import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import VendorApproval from "@/lib/mongodb/models/qhse-form-checklist/VendorSupplierApproval";
import { generateVendorSupplierApprovalPdf } from "@/jobs/services/pdf/VendorSupplierApprovalReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const report = await VendorApproval.findById(id).lean();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const buffer = await generateVendorSupplierApprovalPdf(report);
    const fileName = `Vendor-Supplier-Approval-${report.serialNumber || report._id.toString()}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Vendor/Supplier Approval PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
