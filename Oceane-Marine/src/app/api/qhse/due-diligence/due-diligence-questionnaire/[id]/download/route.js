import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence";
import { generateSupplierDueDiligenceDoc } from "@/jobs/services/pdf/SupplierDueDiligenceReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const record = await SupplierDueDiligence.findById(id).lean();

    if (!record) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `Supplier-Due-Diligence-${record.serialNumber || record._id.toString()}.docx`;
    const tempFilePath = path.join(tempDir, fileName);

    await generateSupplierDueDiligenceDoc(record, tempFilePath);

    const fileBuffer = fs.readFileSync(tempFilePath);

    try {
      fs.unlinkSync(tempFilePath);
    } catch (err) {
      console.error("Error deleting temp file:", err);
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Supplier Due Diligence download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}
