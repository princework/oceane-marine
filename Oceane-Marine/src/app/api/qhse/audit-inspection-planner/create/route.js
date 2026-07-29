import { NextResponse } from "next/server";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import AuditInspectionPlanner from "@/lib/mongodb/models/qhse-audit-inspection/AuditInspectionPlanner";
import { getNextYearwiseSerial } from "@/lib/mongodb/models/YearwiseSerialCounter";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";

export const runtime = "nodejs";

const ALLOWED_EXT = new Set([
  ".pdf", ".xlsx", ".xls", ".csv", ".doc", ".docx", ".jpg", ".jpeg", ".png",
]);

const MAX_SIZE = 25 * 1024 * 1024;

/**
 * POST /api/qhse/audit-inspection-planner/create
 *
 * Tracker-style upsert: each year has a single "main" planner that grows over
 * time. If a planner already exists for the requested year, this endpoint
 * UPDATES that record (replacing categories with the merged set the form just
 * sent — which already contains every previously-saved row plus any newly
 * added rows). If no planner exists for the year yet, a brand new one is
 * created with a fresh year-wise serial.
 */
export async function POST(req) {
  await connectDB();

  try {
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

    // Persist any newly attached files (keyed by row id). Rows without a new
    // file in the multipart payload keep whatever fileUrl / fileName they
    // already had on the client (the form re-submits the loaded row data).
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

    // Look for an existing tracker for this year (most recently updated wins
    // if legacy data left more than one). Archived planners are intentionally
    // ignored so a fresh tracker can be started after archival.
    const existing = yearNum != null
      ? await AuditInspectionPlanner.findOne({
          year: yearNum,
          isArchived: { $ne: true },
        }).sort({ updatedAt: -1, createdAt: -1 })
      : null;

    if (existing) {
      // Update-in-place: the form already merges old rows + new rows in the UI
      // before submitting, so we can replace the categories array verbatim.
      existing.issueDate = issueDate;
      existing.approvedBy = approvedBy;
      existing.categories = categories;
      // Bump rev/version on each tracker save so the audit trail reflects
      // every appended batch of entries.
      existing.version = getNextRevisionNumber(existing.version);
      existing.revNo = getNextRevisionNumber(existing.revNo);
      await existing.save();
      return NextResponse.json(
        { success: true, data: existing, mode: "updated" },
        { status: 200 }
      );
    }

    // No tracker yet for this year — create one with a fresh year-wise serial.
    const serialNumber = await getNextYearwiseSerial(
      "AUDIT_INSPECTION_PLANNER",
      yearNum
    );

    const createPayload = {
      issueDate,
      approvedBy,
      categories,
      status: "Draft",
      version: "1.0",
      year: yearNum,
      serialNumber,
    };

    let record;
    try {
      record = await AuditInspectionPlanner.create(createPayload);
    } catch (createErr) {
      const isFormCodeDup =
        createErr.code === 11000 &&
        (createErr.message || "").includes("formCode");
      if (isFormCodeDup) {
        try {
          await AuditInspectionPlanner.collection.dropIndex("formCode_1");
        } catch (dropErr) {
          console.warn("Drop formCode_1 index:", dropErr.message);
        }
        record = await AuditInspectionPlanner.create(createPayload);
      } else {
        throw createErr;
      }
    }

    return NextResponse.json(
      { success: true, data: record, mode: "created" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
