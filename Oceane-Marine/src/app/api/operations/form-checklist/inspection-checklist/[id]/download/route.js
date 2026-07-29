import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import InspectionChecklist from "@/lib/mongodb/models/operations-form-checklist/InspectionChecklist";

export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const record = await InspectionChecklist.findById(id);

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Use /tmp for Vercel compatibility, or process.cwd() for production server
    const isVercel = process.env.VERCEL === "1";
    const baseDir = isVercel ? "/tmp" : process.cwd();
    const filePath = path.join(baseDir, record.filePath);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(record.filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

