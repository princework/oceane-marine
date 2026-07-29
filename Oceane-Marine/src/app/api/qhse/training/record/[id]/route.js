import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TrainingRecord from "@/lib/mongodb/models/qhse-training/TrainingRecord";
import path from "node:path";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

export const runtime = "nodejs";

export async function PUT(req, { params }) {
  const guard = await assertQhsePermission("canEdit");
  if (!guard.ok) return guard.response;

  try {
    await connectDB();
    const { id } = await params;

    const record = await TrainingRecord.findById(id);
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Training record not found" },
        { status: 404 }
      );
    }

    let formData;
    try {
      formData = await req.formData();
    } catch (e) {
      console.error("training record update FormData parse:", e);
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not read the upload (body too large or corrupted). Try a file under 25MB.",
        },
        { status: 400 }
      );
    }

    const actualTrainingDate = formData.get("actualTrainingDate");
    const attendanceJson = formData.get("attendance");
    const attachmentFile = formData.get("attachment");

    if (!actualTrainingDate) {
      return NextResponse.json(
        { success: false, error: "Actual training date is required" },
        { status: 400 }
      );
    }

    let attendance;
    try {
      const rawJson =
        typeof attendanceJson === "string" && attendanceJson.trim()
          ? attendanceJson.trim()
          : "[]";
      attendance = JSON.parse(rawJson);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid attendance JSON" },
        { status: 400 }
      );
    }

    if (!Array.isArray(attendance) || attendance.length === 0) {
      return NextResponse.json(
        { success: false, error: "Attendance must be a non-empty array" },
        { status: 400 }
      );
    }

    const invalidAttendance = attendance.some((item) => !item?.traineeName?.trim());
    if (invalidAttendance) {
      return NextResponse.json(
        { success: false, error: "Each attendance entry must have a trainee name" },
        { status: 400 }
      );
    }

    record.actualTrainingDate = new Date(actualTrainingDate);
    record.attendance = attendance.map((item) => ({
      traineeName: item.traineeName.trim(),
      department: (item.department || item.role || "").trim() || undefined,
      designation: item.designation?.trim() || undefined,
      signature: item.signature?.trim() || undefined,
    }));

    if (attachmentFile && typeof attachmentFile !== "string") {
      const ALLOWED_EXT = new Set([
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png",
      ]);
      const MAX_SIZE = 25 * 1024 * 1024;

      if (attachmentFile.size > MAX_SIZE) {
        return NextResponse.json(
          { success: false, error: "File exceeds 25MB limit" },
          { status: 400 }
        );
      }

      const ext = path.extname(attachmentFile.name).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG",
          },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await attachmentFile.arrayBuffer());
      const filePath = await saveQhseFile({
        formCode: "QAF-OFD-039",
        date: record.plannedDate || new Date(),
        title: record.topic || "Training-Record",
        fileType: "attachments",
        fileName: attachmentFile.name,
        buffer,
      });

      record.attachment = {
        filePath,
        fileName: attachmentFile.name,
      };
    }

    await record.save();
    void notifyEdit("QHSE", "training · record · update", id);

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("Update Training Record Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
