import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import DrillPlan from "@/lib/mongodb/models/qhse-drill/DrillPlan";
import fs from "fs";
import path from "path";
import { streamAttachmentFile } from "@/lib/utils/qhse-attachment-stream";

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const planId = searchParams.get("planId");
    const quarter = searchParams.get("quarter");

    if (!planId || !quarter) {
      return NextResponse.json(
        { success: false, error: "planId and quarter are required" },
        { status: 400 }
      );
    }

    if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
      return NextResponse.json(
        { success: false, error: "Invalid quarter. Must be Q1, Q2, Q3, or Q4" },
        { status: 400 }
      );
    }

    const plan = await DrillPlan.findById(planId);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Drill plan not found" },
        { status: 404 }
      );
    }

    const quarterFile = plan.quarterFiles?.[quarter];
    if (!quarterFile || !quarterFile.filePath) {
      return NextResponse.json(
        { success: false, error: `No file found for ${quarter}` },
        { status: 404 }
      );
    }

    const storedPath = quarterFile.filePath;
    const fileName = quarterFile.fileName || `drill-matrix-${quarter}.pdf`;

    // Check if the stored path is a Cloudinary URL (legacy) or a local path (new)
    if (storedPath.startsWith("http://") || storedPath.startsWith("https://")) {
      const fileResponse = await fetch(storedPath);
      if (!fileResponse.ok) {
        return NextResponse.json(
          { success: false, error: "Failed to fetch file from storage" },
          { status: 500 }
        );
      }
      const fileBuffer = await fileResponse.arrayBuffer();
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": fileResponse.headers.get("content-type") || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    // Local file path
    const absolutePath = path.join(process.cwd(), storedPath);
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json(
        { success: false, error: "File not found on disk" },
        { status: 404 }
      );
    }

    return streamAttachmentFile(absolutePath, fileName);
  } catch (error) {
    console.error("Download Quarter File Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
