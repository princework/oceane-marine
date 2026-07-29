import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence";
import { generateSupplierDueDiligencePdf } from "@/jobs/services/pdf/SupplierDueDiligencePdfReport";

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

    const record = await SupplierDueDiligence.findById(id).lean();
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    const buffer = await generateSupplierDueDiligencePdf(record);
    const safeSerial = String(record.serialNumber || id).replaceAll(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Supplier-Due-Diligence-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Supplier Due Diligence PDF download error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate PDF",
      },
      { status: 500 }
    );
  }
}
