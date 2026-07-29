import { NextResponse } from "next/server";
import mongoose from "mongoose";
import path from "path";
import fs from "fs/promises";
import Accessories from "@/lib/mongodb/models/pms/Accessories.js";
import { connectDB } from "@/lib/config/connection.js";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";

/** Map common extensions → Content-Type so the browser knows to render PDFs inline. */
const CONTENT_TYPE_BY_EXT = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

const extOf = (name) => {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
};

export async function GET(req, { params }) {
  const guard = await assertPmsPermission("canView");
  if (!guard.ok) return guard.response;

  const { id, type } = await params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "Invalid accessory id" }, { status: 400 });
  }
  if (type !== "manufacturing" && type !== "test") {
    return NextResponse.json({ message: "Invalid certificate type" }, { status: 400 });
  }

  try {
    await connectDB();

    const record = await Accessories.findById(id).lean();
    if (!record || record.isDeleted) {
      return NextResponse.json({ message: "Accessory not found" }, { status: 404 });
    }

    const cert =
      type === "manufacturing"
        ? record.manufacturingCertificate
        : record.testCertificate;

    if (!cert?.fileUrl) {
      return NextResponse.json(
        { message: "No certificate uploaded" },
        { status: 404 }
      );
    }

    /** Resolve the file inside public/. Stripping the leading slash makes path.join behave correctly. */
    const safeRel = cert.fileUrl.replace(/^[\\/]+/, "");
    const fullPath = path.join(process.cwd(), "public", safeRel);
    /** Guard against path traversal: resolved file must stay under public/uploads/pms/accessories. */
    const allowedRoot = path.join(process.cwd(), "public", "uploads", "pms", "accessories");
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(allowedRoot))) {
      return NextResponse.json({ message: "Invalid file path" }, { status: 400 });
    }

    let fileBuffer;
    try {
      fileBuffer = await fs.readFile(resolved);
    } catch {
      return NextResponse.json({ message: "File not found on server" }, { status: 404 });
    }

    /** Use the original (human-friendly) filename's extension when the saved one lost it. */
    const originalExt = extOf(cert.originalFileName);
    const savedExt = extOf(cert.fileUrl);
    const ext = originalExt || savedExt;
    const contentType =
      CONTENT_TYPE_BY_EXT[ext] || "application/octet-stream";

    const downloadName =
      cert.originalFileName ||
      `${type}-certificate${ext ? `.${ext}` : ""}`;
    /** RFC 5987-style filename to handle non-ASCII characters safely. */
    const encoded = encodeURIComponent(downloadName);
    const disposition = `attachment; filename="${downloadName.replace(/"/g, "")}"; filename*=UTF-8''${encoded}`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    console.error("Accessory certificate download error:", err);
    return NextResponse.json(
      { message: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
