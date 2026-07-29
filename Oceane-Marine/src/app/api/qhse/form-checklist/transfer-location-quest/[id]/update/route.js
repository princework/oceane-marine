import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSTransferLocationQuest from "@/lib/mongodb/models/qhse-form-checklist/StsTransferLocationQuest";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

export const runtime = "nodejs";

function getNextVersion(latestVersion) {
  if (!latestVersion) return "1.0";
  return (parseFloat(latestVersion) + 0.1).toFixed(1);
}

export async function POST(req) {
  await connectDB();

  try {
    const formData = await req.formData();

    const file = formData.get("file");
    const locationName = formData.get("locationName");
    const uploadedByName = formData.get("uploadedByName");
    const uploadedByUserId = formData.get("uploadedByUserId");
    const dateInput = formData.get("date");

    if (!file || !locationName) {
      return NextResponse.json(
        { error: "File and locationName are required" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".docx")) {
      return NextResponse.json(
        { error: "Only .docx files are allowed" },
        { status: 400 }
      );
    }

    const latest = await STSTransferLocationQuest.findOne({
      locationName,
    }).sort({ uploadedAt: -1 });

    const nextVersion = getNextVersion(latest?.version);

    let recordDate = new Date();
    if (dateInput && typeof dateInput === "string") {
      const parsed = new Date(dateInput);
      if (!Number.isNaN(parsed.getTime())) recordDate = parsed;
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const filePath = await saveQhseFile({
      formCode: "QAF-OFD-049",
      location: locationName,
      date: recordDate,
      title: locationName,
      fileType: "documents",
      fileName: file.name,
      buffer,
    });

    const record = await STSTransferLocationQuest.create({
      locationName,
      filePath,
      version: nextVersion,
      // Mirror the file version into the record-level revision so the audit
      // trail shows the same number on the list/PDF (1.0 for the first
      // upload, 1.1 / 1.2 / ... for each subsequent edit of the same record).
      revNo: nextVersion,
      date: recordDate,
      uploadedBy: {
        userId: uploadedByUserId || null,
        name: uploadedByName || null,
      },
    });

    void notifyEdit("QHSE", "form-checklist · transfer-location-quest · update", record._id);
    return NextResponse.json({
      success: true,
      message: "STS Transfer Location Questionnaire uploaded successfully",
      data: record,
    });
  } catch (error) {
    console.error("STS Transfer Upload Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
