import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";
import { generateEquipmentDefectPdf } from "@/jobs/services/pdf/EquipmentDefectPdfReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const defect = await EquipmentDefect.findById(id).lean();

    if (!defect) {
      return NextResponse.json(
        { error: "Equipment defect not found" },
        { status: 404 }
      );
    }

    const buffer = await generateEquipmentDefectPdf(defect);
    const safeSerial = String(defect.serialNumber || id).replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Defect-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Defect PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
