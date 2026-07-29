import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".txt": "text/plain",
};

/**
 * Generic QHSE file serving route.
 * Serves files from the uploads/QHSE/ directory.
 * URL: /api/qhse/file/uploads/QHSE/OFD-004/Dubai/2026/02/12/.../filename
 */
export async function GET(_req, { params }) {
  try {
    const { filepath } = await params;

    if (!filepath || !Array.isArray(filepath) || filepath.length === 0) {
      return NextResponse.json({ error: "Missing file path" }, { status: 400 });
    }

    const relativePath = filepath.join("/");

    // Security: ensure the path stays within uploads/ directory
    if (!relativePath.startsWith("uploads/")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const absolutePath = path.resolve(process.cwd(), relativePath);
    const uploadsBase = path.resolve(process.cwd(), "uploads");

    // Path traversal check
    if (!absolutePath.startsWith(uploadsBase)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    const fileName = path.basename(absolutePath);
    const ext = path.extname(fileName).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const buffer = fs.readFileSync(absolutePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("QHSE file serve error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
