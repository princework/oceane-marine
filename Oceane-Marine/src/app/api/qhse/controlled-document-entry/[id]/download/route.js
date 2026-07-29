import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { connectDB } from "@/lib/config/connection";
import ControlledDocumentEntry from "@/lib/mongodb/models/qhse-controlled-document/ControlledDocumentEntry";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";

export const runtime = "nodejs";

const CONTENT_TYPE_MAP = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(_req, ctx) {
  const guard = await assertQhsePermission("canDownload");
  if (!guard.ok) return guard.response;

  await connectDB();
  const { id } = (await ctx?.params) || {};
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const record = await ControlledDocumentEntry.findById(id).lean();
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const fp = record.attachment?.filePath;
    if (!fp || !String(fp).trim()) {
      return NextResponse.json({ error: "No file on record" }, { status: 404 });
    }

    const toAbs = (p) => (path.isAbsolute(p) ? p : path.join(process.cwd(), p));
    const absPath = toAbs(fp);
    if (!fs.existsSync(absPath)) {
      return NextResponse.json({ error: "File missing on server" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(absPath);
    const diskName = path.basename(absPath);
    const ext = path.extname(diskName).toLowerCase();
    const contentType =
      CONTENT_TYPE_MAP[ext] ||
      record.attachment?.mimeType ||
      "application/octet-stream";
    const downloadName =
      record.attachment?.originalFileName || diskName;
    const safeName = String(downloadName).replace(/"/g, '\\"');

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
