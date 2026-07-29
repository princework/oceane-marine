import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Compatibility from "@/lib/mongodb/models/operations/Compatibility";
import { sanitizeCompatibilityFilename } from "@/lib/operations/compatibilityDocumentValues";
import { generateCompatibilityPdf } from "@/lib/operations/generateCompatibilityPdf";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await Compatibility.findById(id).lean();
    if (!doc) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    let pdfBuffer;
    try {
      pdfBuffer = await generateCompatibilityPdf(doc);
    } catch (err) {
      console.error("Compatibility PDF generation error:", err);
      return NextResponse.json(
        { error: err?.message || "Failed to generate PDF" },
        { status: 500 }
      );
    }

    const fileName = `Compatibility-${sanitizeCompatibilityFilename(doc.operationNumber)}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("Compatibility PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
