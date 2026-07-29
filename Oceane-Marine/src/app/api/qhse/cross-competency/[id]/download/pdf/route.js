import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import PoacCrossCompetency from "@/lib/mongodb/models/qhse-poac/PoacCrossCompetency";
import { generatePoacCrossCompetencyPdf } from "@/jobs/services/pdf/PoacCrossCompetencyPdfReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing form ID" },
        { status: 400 }
      );
    }

    const record = await PoacCrossCompetency.findById(id).lean();
    if (!record) {
      return NextResponse.json(
        { success: false, error: "POAC Cross Competency form not found" },
        { status: 404 }
      );
    }

    const buffer = await generatePoacCrossCompetencyPdf(record);
    const safeSerial = String(record.serialNumber || id).replaceAll(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `POAC-Cross-Competency-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("POAC Cross Competency PDF download error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate PDF",
      },
      { status: 500 }
    );
  }
}
