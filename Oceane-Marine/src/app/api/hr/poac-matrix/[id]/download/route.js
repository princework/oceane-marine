import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import PoacMatrix from "@/lib/mongodb/models/hr/PoacMatrix";
import path from "path";
import fs from "fs/promises";
import { assertHrPermission } from "@/lib/auth/hrGuard";

export async function GET(req, { params }) {
  const guard = await assertHrPermission("canDownload");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;

    const record = await PoacMatrix.findById(id);
    if (!record) {
      return NextResponse.json(
        { message: "POAC Certification Matrix record not found" },
        { status: 404 }
      );
    }

    if (!record.attachment?.fileUrl) {
      return NextResponse.json(
        { message: "No file attached to this record" },
        { status: 404 }
      );
    }

    const filePath = path.join(process.cwd(), "public", record.attachment.fileUrl);

    try {
      const fileBuffer = await fs.readFile(filePath);
      const fileName = record.attachment.originalFileName || "attachment";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        },
      });
    } catch (fileError) {
      console.error("Error reading file:", fileError);
      return NextResponse.json(
        { message: "File not found on server" },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error("POAC Certification Matrix download error:", err);
    return NextResponse.json(
      { message: err.message || "Download failed", error: err.message },
      { status: 500 }
    );
  }
}
