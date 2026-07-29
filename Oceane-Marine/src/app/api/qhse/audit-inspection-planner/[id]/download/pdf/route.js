import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import AuditInspectionPlanner from "@/lib/mongodb/models/qhse-audit-inspection/AuditInspectionPlanner";
import { generateAuditInspectionPlannerPdf } from "@/jobs/services/pdf/AuditInspectionPlannerPdfReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing planner ID" },
        { status: 400 }
      );
    }

    const record = await AuditInspectionPlanner.findById(id).lean();
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Planner not found" },
        { status: 404 }
      );
    }

    const buffer = await generateAuditInspectionPlannerPdf(record);
    const safeSerial = String(record.serialNumber || id).replaceAll(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Audit-Inspection-Planner-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Audit & Inspection Planner PDF download error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate PDF",
      },
      { status: 500 }
    );
  }
}
