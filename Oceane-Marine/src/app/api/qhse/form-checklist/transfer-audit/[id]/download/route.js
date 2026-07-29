import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import StsTransferAudit from "@/lib/mongodb/models/qhse-form-checklist/StsTransferAudit";
import { generateTransferAuditReportDoc } from "@/jobs/services/pdf/TransferAuditReport";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const report = await StsTransferAudit.findById(id).lean();

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `TransferAudit-${report.serialNumber || report._id.toString()}.docx`;
    const tempFilePath = path.join(tempDir, fileName);

    await generateTransferAuditReportDoc(report, tempFilePath);

    const fileBuffer = fs.readFileSync(tempFilePath);

    try {
      fs.unlinkSync(tempFilePath);
    } catch (err) {
      console.error("Error deleting temp file:", err);
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Transfer Audit Report download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}
