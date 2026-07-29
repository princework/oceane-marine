import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";

const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function getContentType(filename) {
  const ext = path.extname(filename || "").toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function contentDisposition(filename, disposition = "attachment") {
  const safe = (filename || "download").replace(/[^a-zA-Z0-9._-]/g, "_");
  const encoded = encodeURIComponent(filename || "download");
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const defectId = String(id);
    const indexStr = req.nextUrl.searchParams.get("index");
    const inlineParam = req.nextUrl.searchParams.get("inline");
    const useInline = inlineParam === "1" || inlineParam === "true";
    const index = indexStr != null ? parseInt(indexStr, 10) : 0;
    if (Number.isNaN(index) || index < 0) {
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });
    }

    const defect = await EquipmentDefect.findById(id).lean();
    if (!defect || !defect.attachments || !defect.attachments[index]) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const att = defect.attachments[index];
    const relativePath = (att.path || "").replace(/\\/g, "/").replace(/^\/+/, "");

    // Try resolving from project root first (works for both old and new paths)
    let fullPath = path.resolve(process.cwd(), relativePath);

    if (!fs.existsSync(fullPath)) {
      // Legacy fallback: try old equipment-defects directory
      const allowedBase = path.resolve(process.cwd(), "uploads", "equipment-defects");
      const defectDir = path.join(allowedBase, defectId);
      fullPath = path.join(defectDir, path.basename(relativePath));
    }
    if (!fs.existsSync(fullPath)) {
      // Last resort: try basename in old defect directory
      const defectDir = path.join(process.cwd(), "uploads", "equipment-defects", defectId);
      fullPath = path.join(defectDir, path.basename(att.path || ""));
    }
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    const filename = att.originalName || `attachment-${index}`;
    const buffer = fs.readFileSync(fullPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": getContentType(filename),
        "Content-Disposition": contentDisposition(
          filename,
          useInline ? "inline" : "attachment"
        ),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("Equipment defect download error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
