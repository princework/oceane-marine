import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import StsBaseAuditReport from "@/lib/mongodb/models/qhse-form-checklist/StsBaseAuditReport";
import { generateBaseAuditReportDoc } from "@/jobs/services/pdf/BaseAuditReport";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const report = await StsBaseAuditReport.findById(id).lean();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Generate temporary file path
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `BaseAudit-${report.serialNumber || report._id.toString()}.docx`;
    const tempFilePath = path.join(tempDir, fileName);

    // Generate DOCX document
    await generateBaseAuditReportDoc(report, tempFilePath);

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
    console.error("Base Audit Report download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}
