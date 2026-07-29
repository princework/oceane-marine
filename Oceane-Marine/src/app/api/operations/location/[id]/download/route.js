import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import LocationOfficeCheck from "@/lib/mongodb/models/operations/operations-locations/LocationOfficeCheck";

export const runtime = "nodejs";

const UPLOAD_BASE = "uploads/location";

export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const key = searchParams.get("key");
    const index = searchParams.get("index");

    const record = await LocationOfficeCheck.findById(id).lean();
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    let filePath = null;
    let fileName = null;

    if (type === "checkbox" && key) {
      const attachment = (record.checkboxAttachments || []).find((a) => a.key === key);
      if (attachment) {
        filePath = attachment.filePath;
        fileName = attachment.fileName;
      }
    } else if (type === "additional" && index !== null && index !== undefined) {
      const i = Number.parseInt(index, 10);
      const arr = record.additionalAttachments || [];
      if (!Number.isNaN(i) && i >= 0 && arr[i]) {
        filePath = arr[i].filePath;
        fileName = arr[i].fileName;
      }
    }

    if (!filePath || !fileName) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const absolutePath = path.join(process.cwd(), filePath);
    if (!absolutePath.startsWith(path.join(process.cwd(), UPLOAD_BASE))) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: "File not found on server" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const fileExt = path.extname(fileName).toLowerCase();
    const contentTypeMap = {
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
      ".pdf": "application/pdf",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
    };
    const contentType = contentTypeMap[fileExt] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, '\\"')}"`,
      },
    });
  } catch (error) {
    console.error("Location download error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
