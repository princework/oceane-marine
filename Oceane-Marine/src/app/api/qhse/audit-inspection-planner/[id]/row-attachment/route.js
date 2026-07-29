import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { connectDB } from "@/lib/config/connection";
import AuditInspectionPlanner from "@/lib/mongodb/models/qhse-audit-inspection/AuditInspectionPlanner";
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
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function normalizePath(raw) {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim().replace(/\\/g, "/");
  return t || null;
}

function resolveFilePath(rawPath) {
  const cwd = process.cwd();
  const p = normalizePath(rawPath);
  if (!p) return null;
  const candidates = [
    path.join(cwd, p),
    p.startsWith("/") ? path.join(cwd, p.slice(1)) : null,
    path.join(cwd, "public", p.startsWith("/") ? p.slice(1) : p),
  ].filter(Boolean);
  if (path.isAbsolute(p)) candidates.unshift(p);
  for (const abs of candidates) {
    try {
      if (fs.existsSync(abs)) return abs;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * GET /api/qhse/audit-inspection-planner/[id]/row-attachment?rowId=...
 * Streams the file saved on a specific planner row.
 */
export async function GET(req, { params }) {
  const guard = await assertQhsePermission("canView");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid planner id" }, { status: 400 });
  }

  const rowId = req.nextUrl.searchParams.get("rowId")?.trim();
  if (!rowId) {
    return NextResponse.json({ error: "Missing rowId" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await AuditInspectionPlanner.findById(id).lean();
    if (!doc) {
      return NextResponse.json({ error: "Planner not found" }, { status: 404 });
    }

    let found = null;
    for (const cat of doc.categories || []) {
      for (const row of cat.rows || []) {
        if (String(row.rowId) === String(rowId)) {
          found = row;
          break;
        }
      }
      if (found) break;
    }

    const fp = typeof found?.fileUrl === "string" ? found.fileUrl.trim() : "";
    if (!fp) {
      return NextResponse.json({ error: "No file on this row" }, { status: 404 });
    }

    const absolutePath = resolveFilePath(fp);
    if (!absolutePath) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const downloadName =
      (typeof found.fileName === "string" && found.fileName.trim()) ||
      path.basename(absolutePath);
    const ext = path.extname(downloadName).toLowerCase();
    const contentType = CONTENT_TYPE_MAP[ext] || "application/octet-stream";
    const safeName = downloadName.replace(/"/g, '\\"');

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (error) {
    console.error("Audit planner row-attachment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to download file" },
      { status: 500 }
    );
  }
}
