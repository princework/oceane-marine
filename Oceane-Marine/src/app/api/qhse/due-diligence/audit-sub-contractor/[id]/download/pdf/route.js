import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import SubContractorAudit from "@/lib/mongodb/models/qhse-due-diligence/SubContractorAudit";
import { generateSubContractorAuditPdf } from "@/jobs/services/pdf/SubContractorAuditPdfReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing audit ID" },
        { status: 400 }
      );
    }

    const record = await SubContractorAudit.findById(id).lean();
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    const buffer = await generateSubContractorAuditPdf(record);
    const safeSerial = String(record.serialNumber || id).replaceAll(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `SubContractor-Audit-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Sub-Contractor Audit PDF download error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate PDF",
      },
      { status: 500 }
    );
  }
}
