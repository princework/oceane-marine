import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TrainingRecord from "@/lib/mongodb/models/qhse-training/TrainingRecord";
import TrainingPlan from "@/lib/mongodb/models/qhse-training/TrainingPlan";
import path from "node:path";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";

export const runtime = "nodejs";

/** YYYY-MM-DD for matching plan.planItems to submitted plannedDate (reduces TZ drift). */
function dateKeyOnly(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const t = value.trim();
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(t);
    if (m) return m[1];
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";
    const archivedFilter = includeArchived ? {} : { isArchived: { $ne: true } };

    if (year === "all") {
      const records = await TrainingRecord.find(archivedFilter)
        .sort({ plannedDate: -1 })
        .lean();
      return NextResponse.json({ success: true, data: records });
    }

    if (year) {
      const yr = Number.parseInt(year, 10);
    if (!Number.isNaN(yr)) {
      const records = await TrainingRecord.find({
        ...archivedFilter,
        plannedDate: {
          $gte: new Date(`${yr}-01-01T00:00:00.000Z`),
          $lte: new Date(`${yr}-12-31T23:59:59.999Z`),
        },
      })
        .sort({ plannedDate: 1 })
        .lean();

      return NextResponse.json({ success: true, data: records });
    }
    }

    const all = await TrainingRecord.find(archivedFilter).select("plannedDate").lean();
    const years = [
      ...new Set(
        all
          .map((r) => new Date(r.plannedDate).getFullYear())
          .filter((y) => !Number.isNaN(y))
      ),
    ].sort((a, b) => b - a);

    return NextResponse.json({ success: true, data: years });
  } catch (error) {
    console.error("Get Training Records Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const guard = await assertQhsePermission("canCreate");
  if (!guard.ok) return guard.response;

  try {
    await connectDB();
    let formData;
    try {
      formData = await req.formData();
    } catch (e) {
      console.error("training record FormData parse:", e);
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not read the upload (body too large or corrupted). Try a file under 25MB, ensure you are signed in, and retry.",
        },
        { status: 400 }
      );
    }

    const trainingPlanId = formData.get("trainingPlanId");
    const plannedDate = formData.get("plannedDate");
    const topic = formData.get("topic");
    const instructor = formData.get("instructor");
    const actualTrainingDate = formData.get("actualTrainingDate");
    const attendanceJson = formData.get("attendance");
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
    if (!Array.isArray(attendance)) {
      return NextResponse.json(
        { success: false, error: "Attendance must be an array" },
        { status: 400 }
      );
    }
    const attachmentFile = formData.get("attachment");

    if (
      !trainingPlanId ||
      !plannedDate ||
      !topic ||
      !instructor ||
      !actualTrainingDate ||
      !attendance?.length
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const topicTrimmed = String(topic ?? "").trim();
    const instructorTrimmed = String(instructor ?? "").trim();

    const invalidAttendance = attendance.some(
      (item) => !item?.traineeName?.trim()
    );

    if (invalidAttendance) {
      return NextResponse.json(
        { success: false, error: "Each attendance entry must have a trainee name" },
        { status: 400 }
      );
    }

    const formattedAttendance = attendance.map((item) => ({
      traineeName: item.traineeName.trim(),
      department:
        (item.department || item.role || "").trim() || undefined,
      designation: item.designation?.trim() || undefined,
      signature: item.signature?.trim() || undefined,
    }));

    const plan = await TrainingPlan.findById(trainingPlanId);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Training plan not found" },
        { status: 404 }
      );
    }

    const plannedKey = dateKeyOnly(plannedDate);
    const planItem = plan.planItems.find(
      (item) => dateKeyOnly(item.plannedDate) === plannedKey
    );

    if (!planItem) {
      return NextResponse.json(
        { success: false, error: "Plan item not found for this planned date" },
        { status: 404 }
      );
    }

    if (plan.status !== "Approved") {
      return NextResponse.json(
        { success: false, error: "This plan item is not approved yet" },
        { status: 403 }
      );
    }

    const existingRecord = await TrainingRecord.findOne({
      trainingPlanId,
      plannedDate: new Date(plannedDate),
    });

    if (existingRecord) {
      return NextResponse.json(
        { success: false, error: "Training record already exists" },
        { status: 409 }
      );
    }

    let attachmentData = null;
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
          { success: false, error: "Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG" },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await attachmentFile.arrayBuffer());

      const filePath = await saveQhseFile({
        formCode: "QAF-OFD-039",
        date: new Date(plannedDate),
        title: topicTrimmed || "Training-Record",
        fileType: "attachments",
        fileName: attachmentFile.name,
        buffer,
      });

      attachmentData = {
        filePath,
        fileName: attachmentFile.name,
      };
    }

    const record = await TrainingRecord.create({
      trainingPlanId,
      plannedDate: new Date(plannedDate),
      topic: topicTrimmed,
      instructor: instructorTrimmed,
      actualTrainingDate: new Date(actualTrainingDate),
      attendance: formattedAttendance,
      status: "Completed",
      attachment: attachmentData,
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error("Create Training Record Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
