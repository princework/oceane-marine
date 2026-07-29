import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import NewBaseSetupChecklist from "@/lib/mongodb/models/qhse-form-checklist/NewBaseSetupChecklist";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";

export const runtime = "nodejs";

function getNextVersion(latestVersion) {
  if (!latestVersion) return "1.0";
  return (parseFloat(latestVersion) + 0.1).toFixed(1);
}

export async function POST(req) {
  // NOTE: Everything (including `connectDB`) runs inside one try/catch so we
  // ALWAYS return JSON. Throwing above the try block causes Next.js to render
  // an HTML error page, which then surfaces on the client as
  // "Unexpected token '<', '<html><b'... is not valid JSON".
  try {
    await connectDB();

    const formData = await req.formData();

    const file = formData.get("file");
    const baseName = formData.get("baseName");
    const uploadedByName = formData.get("uploadedByName");
    const uploadedByUserId = formData.get("uploadedByUserId");
    const dateInput = formData.get("date");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "Please attach a .docx file." },
        { status: 400 }
      );
    }

    if (!baseName || typeof baseName !== "string" || !baseName.trim()) {
      return NextResponse.json(
        { success: false, error: "Base Name is required." },
        { status: 400 }
      );
    }

    const trimmedBaseName = baseName.trim();

    if (!file.name || !file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json(
        { success: false, error: "Only Word (.docx) files are allowed." },
        { status: 400 }
      );
    }

    // 25 MB hard limit (mirrors the client-side check).
    const MAX_BYTES = 25 * 1024 * 1024;
    if (typeof file.size === "number" && file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "File exceeds the 25 MB limit." },
        { status: 413 }
      );
    }

    const latest = await NewBaseSetupChecklist.findOne({
      baseName: trimmedBaseName,
    })
      .sort({ uploadedAt: -1 })
      .lean();

    const nextVersion = getNextVersion(latest?.version);

    let recordDate = new Date();
    if (dateInput && typeof dateInput === "string") {
      const parsed = new Date(dateInput);
      if (!Number.isNaN(parsed.getTime())) recordDate = parsed;
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const filePath = await saveQhseFile({
      formCode: "QAF-OFD-051",
      location: trimmedBaseName,
      date: recordDate,
      title: trimmedBaseName,
      fileType: "documents",
      fileName: file.name,
      buffer,
    });

    // Coerce empty-string user id to null so Mongoose doesn't try to cast it
    // to an ObjectId.
    const userIdValue =
      typeof uploadedByUserId === "string" && uploadedByUserId.trim()
        ? uploadedByUserId.trim()
        : null;

    const record = await NewBaseSetupChecklist.create({
      baseName: trimmedBaseName,
      filePath,
      version: nextVersion,
      // Mirror the file version into the record-level revision so the audit
      // trail shows the same number on the list/PDF.
      revNo: nextVersion,
      date: recordDate,
      uploadedBy: {
        userId: userIdValue,
        name:
          typeof uploadedByName === "string" && uploadedByName.trim()
            ? uploadedByName.trim()
            : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "New Base Setup Checklist uploaded successfully",
      data: record,
    });
  } catch (error) {
    console.error("New Base Setup Checklist – create error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to upload checklist.",
      },
      { status: 500 }
    );
  }
}
