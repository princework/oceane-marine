import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsEquipmentBaseStockLevel from "@/lib/mongodb/models/qhse-form-checklist/StsEquipmentBaseStockLevel";
import { generateStsEquipmentBaseStockLevelPdf } from "@/jobs/services/pdf/StsEquipmentBaseStockLevelReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const report = await StsEquipmentBaseStockLevel.findById(id).lean();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const buffer = await generateStsEquipmentBaseStockLevelPdf(report);
    const fileName = `STS-Equipment-Base-Stock-${report.serialNumber || report._id.toString()}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("STS Equipment Base Stock Level PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
