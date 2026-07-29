import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { connectDB } from "@/lib/config/connection";
import DrillReport from "@/lib/mongodb/models/qhse-drill/DrillReport";
import { generateDrillReportDoc } from "@/jobs/services/pdf/DrillReportReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const report = await DrillReport.findById(id).lean();

    if (!report) {
      return NextResponse.json(
        { error: "Drill report not found" },
        { status: 404 }
      );
    }

    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const safeSerial = String(report.serialNumber || report._id.toString()).replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Drill-Report-${safeSerial}.docx`;
    const tempFilePath = path.join(tempDir, fileName);

    await generateDrillReportDoc(report, tempFilePath);

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
    console.error("Drill Report (docx) download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}
