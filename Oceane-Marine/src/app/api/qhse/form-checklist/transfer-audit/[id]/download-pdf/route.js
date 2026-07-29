import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsTransferAudit from "@/lib/mongodb/models/qhse-form-checklist/StsTransferAudit";
import { generateTransferAuditReportPdf } from "@/jobs/services/pdf/TransferAuditReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const report = await StsTransferAudit.findById(id).lean();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const buffer = await generateTransferAuditReportPdf(report);
    const fileName = `TransferAudit-${report.serialNumber || report._id.toString()}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Transfer Audit Report PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
