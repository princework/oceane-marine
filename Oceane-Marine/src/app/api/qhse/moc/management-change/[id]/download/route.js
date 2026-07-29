import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange";
import { generateMOCManagementChangeDoc } from "@/jobs/services/pdf/MOC-ManagementChange";
import fs from "fs";
import path from "path";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing MOC ID" },
        { status: 400 }
      );
    }

    const moc = await MOCManagementChange.findById(id).lean();
    if (!moc) {
      return NextResponse.json(
        { success: false, error: "MOC not found" },
        { status: 404 }
      );
    }

    // Generate temporary file path
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `MOC-${moc.serialNumber || moc._id.toString()}.docx`;
    const tempFilePath = path.join(tempDir, fileName);

    // Generate DOCX document
    await generateMOCManagementChangeDoc(moc, tempFilePath);

    // Read the generated file
    const fileBuffer = fs.readFileSync(tempFilePath);

    // Clean up temporary file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (err) {
      console.error("Error deleting temp file:", err);
    }

    // Return the file
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("MOC download error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}
