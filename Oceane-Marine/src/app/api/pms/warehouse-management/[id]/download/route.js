import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection.js";
import WarehouseManagement from "@/lib/mongodb/models/pms/WarehouseManagement";
import fs from "node:fs/promises";
import path from "node:path";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";

export async function GET(req, { params }) {
  const guard = await assertPmsPermission("canDownload");
  if (!guard.ok) return guard.response;
  await connectDB();

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const fileIndex = Number(searchParams.get("fileIndex"));

  if (!id) {
    return NextResponse.json(
      { success: false, error: "Missing record id" },
      { status: 400 }
    );
  }

  if (Number.isNaN(fileIndex)) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid fileIndex" },
      { status: 400 }
    );
  }

  try {
    const record = await WarehouseManagement.findById(id);

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    const attachment = record.attachments?.[fileIndex];

    if (!attachment || !attachment.filePath) {
      return NextResponse.json(
        { success: false, error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Read local file
    const fileBuffer = await fs.readFile(attachment.filePath);

    const filename =
      attachment.fileName ||
      path.basename(attachment.filePath) ||
      "file";

    const mimeType = "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Warehouse attachment download error:", error);

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
