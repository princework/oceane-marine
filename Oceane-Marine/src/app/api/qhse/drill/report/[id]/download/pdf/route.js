import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import DrillReport from "@/lib/mongodb/models/qhse-drill/DrillReport";
import { generateDrillReportPdf } from "@/jobs/services/pdf/DrillReportPdfReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const report = await DrillReport.findById(id).lean();

    if (!report) {
      return NextResponse.json(
        { error: "Drill report not found" },
        { status: 404 }
      );
    }

    const buffer = await generateDrillReportPdf(report);
    const safeSerial = String(report.serialNumber || report._id.toString()).replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Drill-Report-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Drill Report PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
