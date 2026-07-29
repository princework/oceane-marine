import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TargetKpi from "@/lib/mongodb/models/qhse-kpi/TargetKpi";
import { generateTargetKpiPdf } from "@/jobs/services/pdf/TargetKpiPdfReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const record = await TargetKpi.findById(id).lean();

    if (!record) {
      return NextResponse.json(
        { error: "Target KPI not found" },
        { status: 404 }
      );
    }

    const buffer = await generateTargetKpiPdf(record);
    const safeSerial = String(record.serialNumber || record._id.toString()).replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Target-KPI-${record.year ?? "kpi"}-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Target KPI PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
