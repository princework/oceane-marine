import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import LocationOfficeCheck from "@/lib/mongodb/models/operations/operations-locations/LocationOfficeCheck";
import { OFFICE_CHECK_KEYS_EXPORT } from "@/lib/mongodb/models/operations/operations-locations/LocationOfficeCheck";

export const runtime = "nodejs";

const ALLOWED_EXT = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png",
]);
const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const UPLOAD_BASE = "uploads/location";

function getField(formData, name) {
  const val = formData.get(name);
  return typeof val === "string" ? val.trim() : "";
}

export async function POST(req) {
  await connectDB();

  try {
    const formData = await req.formData();
    const locationId = getField(formData, "locationId");
    const locationName = getField(formData, "locationName");
    const yearParam = getField(formData, "year");
    const uploadedByName = getField(formData, "uploadedByName");
    const uploadedByUserId = getField(formData, "uploadedByUserId");

    if (!locationId || !locationName) {
      return NextResponse.json(
        { success: false, error: "Location is required" },
        { status: 400 }
      );
    }

    const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear();
    if (Number.isNaN(year)) {
      return NextResponse.json(
        { success: false, error: "Valid year is required" },
        { status: 400 }
      );
    }

    const officeChecks = {};
    for (const key of OFFICE_CHECK_KEYS_EXPORT) {
      const val = formData.get(key);
      officeChecks[key] = val === "true" || val === "on" || val === "1";
    }

    const checkboxAttachments = [];
    const additionalAttachments = [];

    const uploadDir = path.join(process.cwd(), UPLOAD_BASE, locationName.replace(/\s+/g, "_"), String(year));
    fs.mkdirSync(uploadDir, { recursive: true });

    for (const key of OFFICE_CHECK_KEYS_EXPORT) {
      const file = formData.get(`attachment_${key}`);
      if (file && typeof file !== "string" && file.size > 0) {
        if (file.size > MAX_SIZE) {
          return NextResponse.json(
            { success: false, error: `File for ${key} exceeds 25MB` },
            { status: 400 }
          );
        }
        const ext = path.extname(file.name || "").toLowerCase();
        if (!ALLOWED_EXT.has(ext)) {
          return NextResponse.json(
            { success: false, error: `Invalid file type for ${key}. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG` },
            { status: 400 }
          );
        }
        const uniqueName = `${Date.now()}-${(file.name || "file").replace(/\s+/g, "_")}`;
        const fullPath = path.join(uploadDir, uniqueName);
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(fullPath, buffer);
        const relativePath = `${UPLOAD_BASE}/${locationName.replace(/\s+/g, "_")}/${year}/${uniqueName}`;
        checkboxAttachments.push({ key, filePath: relativePath, fileName: file.name || uniqueName });
      }
    }

    let idx = 0;
    while (true) {
      const file = formData.get(`additional_${idx}`);
      if (!file || typeof file === "string") break;
      if (file.size > 0) {
        if (file.size > MAX_SIZE) {
          return NextResponse.json(
            { success: false, error: "Additional attachment exceeds 25MB" },
            { status: 400 }
          );
        }
        const ext = path.extname(file.name || "").toLowerCase();
        if (!ALLOWED_EXT.has(ext)) {
          return NextResponse.json(
            { success: false, error: "Invalid file type for additional attachment" },
            { status: 400 }
          );
        }
        const uniqueName = `${Date.now()}-${idx}-${(file.name || "file").replace(/\s+/g, "_")}`;
        const fullPath = path.join(uploadDir, uniqueName);
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(fullPath, buffer);
        const relativePath = `${UPLOAD_BASE}/${locationName.replace(/\s+/g, "_")}/${year}/${uniqueName}`;
        additionalAttachments.push({ filePath: relativePath, fileName: file.name || uniqueName });
      }
      idx += 1;
    }

    const payload = {
      locationId,
      locationName,
      year,
      officeChecks,
      checkboxAttachments,
      additionalAttachments,
      lastUploaded: new Date(),
      uploadedBy: { userId: uploadedByUserId || undefined, name: uploadedByName || undefined },
    };

    const record = await LocationOfficeCheck.findOneAndUpdate(
      { locationId, year },
      { $set: payload },
      { new: true, upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Location office check saved successfully",
      data: record,
    });
  } catch (error) {
    console.error("Location create error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
