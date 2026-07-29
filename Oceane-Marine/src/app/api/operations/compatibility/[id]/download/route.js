import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Compatibility from "@/lib/mongodb/models/operations/Compatibility";
import { sanitizeCompatibilityFilename } from "@/lib/operations/compatibilityDocumentValues";
import { fillCompatibilityDocx } from "@/lib/operations/fillCompatibilityDocx";

export const maxDuration = 60;

export async function GET(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const doc = await Compatibility.findById(id).lean();
    if (!doc) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    let out;
    try {
      out = await fillCompatibilityDocx(doc);
    } catch {
      return NextResponse.json(
        { error: "Compatibility template not found on server" },
        { status: 500 }
      );
    }

    const fileName = `Compatibility-${sanitizeCompatibilityFilename(doc.operationNumber)}.docx`;

    return new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(out.length),
      },
    });
  } catch (error) {
    console.error("Compatibility download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}
