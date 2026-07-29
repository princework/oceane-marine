import { NextResponse } from "next/server";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import AuditInspectionPlanner from "@/lib/mongodb/models/qhse-audit-inspection/AuditInspectionPlanner";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

const ALLOWED_EXT = new Set([
  ".pdf", ".xlsx", ".xls", ".csv", ".doc", ".docx", ".jpg", ".jpeg", ".png",
]);
const MAX_SIZE = 25 * 1024 * 1024;

export async function GET(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const doc = await AuditInspectionPlanner.findById(id).lean();
    if (!doc) {
      return NextResponse.json({ error: "Planner not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error("Audit planner get error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const existing = await AuditInspectionPlanner.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Planner not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const rawData = formData.get("data");
    if (!rawData) {
      return NextResponse.json({ error: "Form data missing" }, { status: 400 });
    }
    const body = JSON.parse(rawData);
    const { issueDate, approvedBy, categories, year } = body;
    if (!issueDate || !approvedBy || !Array.isArray(categories)) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    const yearNum = year != null && !Number.isNaN(Number(year)) ? Number(year) : undefined;

    const recordDate = issueDate ? new Date(issueDate) : new Date();
    for (const cat of categories) {
      for (const row of cat.rows) {
        const file = formData.get(`file_${row.rowId}`);
        if (file && typeof file !== "string") {
          if (file.size > MAX_SIZE) {
            return NextResponse.json(
              { error: `File too large for row ${row.rowId}` },
              { status: 400 }
            );
          }
          const ext = path.extname(file.name).toLowerCase();
          if (!ALLOWED_EXT.has(ext)) {
            return NextResponse.json(
              { error: `Invalid file type for row ${row.rowId}` },
              { status: 400 }
            );
          }
          const buffer = Buffer.from(await file.arrayBuffer());
          const filePath = await saveQhseFile({
            formCode: "QAF-OFD-048",
            date: recordDate,
            title: cat.title || cat.key || "Audit-Inspection",
            fileType: "documents",
            fileName: file.name,
            buffer,
          });
          row.fileUrl = filePath;
          row.fileName = file.name;
          row.fileUploadedAt = new Date();
        }
      }
    }

    existing.issueDate = issueDate;
    existing.approvedBy = approvedBy;
    existing.categories = categories;
    if (yearNum !== undefined) existing.year = yearNum;
    // Bump rev on edit: 1.0 -> 1.1, 1.1 -> 1.2, etc.
    existing.version = getNextRevisionNumber(existing.version);
    existing.revNo = getNextRevisionNumber(existing.revNo);
    await existing.save();

    void notifyEdit("QHSE", "audit-inspection-planner", existing._id);

    return NextResponse.json({ success: true, data: existing });
  } catch (error) {
    console.error("Audit planner update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const doc = await AuditInspectionPlanner.findByIdAndDelete(id);
    if (!doc) {
      return NextResponse.json({ error: "Planner not found" }, { status: 404 });
    }
    void notifyDelete("QHSE", "audit-inspection-planner", id);
    return NextResponse.json({ success: true, message: "Planner deleted successfully" });
  } catch (error) {
    console.error("Audit planner delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
