import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { connectDB } from "@/lib/config/connection";
import DrillPlan from "@/lib/mongodb/models/qhse-drill/DrillPlan";
import { generateDrillPlanDoc } from "@/jobs/services/pdf/DrillPlanReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const plan = await DrillPlan.findById(id).lean();

    if (!plan) {
      return NextResponse.json(
        { error: "Drill plan not found" },
        { status: 404 }
      );
    }

    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const safeSerial = String(plan.serialNumber || plan._id.toString()).replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Drill-Plan-${plan.year ?? "plan"}-${safeSerial}.docx`;
    const tempFilePath = path.join(tempDir, fileName);

    await generateDrillPlanDoc(plan, tempFilePath);

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
    console.error("Drill Plan download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}
