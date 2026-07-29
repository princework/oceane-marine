import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import HseInductionChecklist from "@/lib/mongodb/models/qhse-form-checklist/HseInductionChecklist";
import { generateHseInductionChecklistPdf } from "@/jobs/services/pdf/HseInductionChecklistReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const report = await HseInductionChecklist.findById(id).lean();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const buffer = await generateHseInductionChecklistPdf(report);
    const fileName = `HSE-Induction-Checklist-${report.serialNumber || report._id.toString()}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("HSE Induction Checklist PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
