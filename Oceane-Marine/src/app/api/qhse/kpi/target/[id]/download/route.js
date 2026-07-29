import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { connectDB } from "@/lib/config/connection";
import TargetKpi from "@/lib/mongodb/models/qhse-kpi/TargetKpi";
import { generateTargetKpiDoc } from "@/jobs/services/pdf/TargetKpiReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const record = await TargetKpi.findById(id).lean();

    if (!record) {
      return NextResponse.json(
        { error: "Target KPI not found" },
        { status: 404 }
      );
    }

    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const safeSerial = String(record.serialNumber || record._id.toString()).replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Target-KPI-${record.year ?? "kpi"}-${safeSerial}.docx`;
    const tempFilePath = path.join(tempDir, fileName);

    await generateTargetKpiDoc(record, tempFilePath);

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
    console.error("Target KPI download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}
