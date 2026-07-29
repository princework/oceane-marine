import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { connectDB } from "@/lib/config/connection";
import StsBaseAuditReport from "@/lib/mongodb/models/qhse-form-checklist/StsBaseAuditReport";
import Location from "@/lib/mongodb/models/Location";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

export const runtime = "nodejs";

/**
 * Update an existing STS Base Audit report.
 *
 * Accepts multipart/form-data with the following optional fields:
 *  - file (File)            : if present, replaces the stored file and bumps the version
 *  - description (string)
 *  - uploadedBy (string)    : name of the uploader
 *  - locationId (string)    : Mongo ObjectId of the location, or "" / null to clear
 *
 * The record's `serialNumber` is preserved across updates so the audit trail
 * stays consistent.
 */
export async function POST(req, { params }) {
  try {
    await connectDB();

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Report id is required" },
        { status: 400 }
      );
    }

    const existing = await StsBaseAuditReport.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const description = formData.get("description");
    const uploadedByName = formData.get("uploadedBy");
    const locationIdRaw = formData.get("locationId");

    // --- Resolve location (optional). Empty string clears it. ---
    let nextLocation = existing.location || null;
    if (locationIdRaw !== null && locationIdRaw !== undefined) {
      const trimmed = String(locationIdRaw).trim();
      if (trimmed === "") {
        nextLocation = null;
      } else {
        const locationDoc = await Location.findById(trimmed).lean();
        if (locationDoc) {
          nextLocation = { locationId: locationDoc._id, name: locationDoc.name };
        }
      }
    }

    // --- Apply metadata updates (always) ---
    if (description !== null && description !== undefined) {
      existing.description = String(description);
    }
    if (uploadedByName !== null && uploadedByName !== undefined) {
      existing.uploadedBy = {
        ...(existing.uploadedBy || {}),
        name: String(uploadedByName),
      };
    }
    existing.location = nextLocation || undefined;

    // --- If a new file was uploaded, save it and bump the version ---
    const hasNewFile =
      file && typeof file !== "string" && file.name && file.size > 0;

    if (hasNewFile) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const newFilePath = await saveQhseFile({
        formCode: existing.formCode || "QAF-OFD-004",
        location: nextLocation?.name || null,
        date: existing.date || new Date(),
        title: existing.serialNumber || "Base-Audit",
        fileType: "documents",
        fileName: file.name,
        buffer,
      });

      // Best-effort cleanup of the previous file (ignore failures so we never
      // block the update on a stale path).
      const prevFilePath = existing.filePath;
      if (prevFilePath && prevFilePath !== newFilePath) {
        try {
          const absPrev = path.join(process.cwd(), prevFilePath);
          if (fs.existsSync(absPrev)) {
            fs.unlinkSync(absPrev);
          }
        } catch {
          // ignore — the new file is what matters
        }
      }

      existing.filePath = newFilePath;
      existing.version = getNextRevisionNumber(existing.version);
      existing.uploadedAt = new Date();
    }

    // Bump the record-level revNo on every edit (whether file changed or not),
    // so the QHSE-wide revision convention is satisfied.
    existing.revNo = getNextRevisionNumber(existing.revNo);

    await existing.save();

    try {
      void notifyEdit("QHSE", "form-checklist · base-audit", existing._id);
    } catch (notifyErr) {
      console.warn("STS Base Audit notifyEdit:", notifyErr?.message || notifyErr);
    }

    return NextResponse.json({
      success: true,
      message: hasNewFile
        ? "Report updated and new version created"
        : "Report metadata updated",
      version: existing.version,
      data: existing.toObject(),
    });
  } catch (error) {
    console.error("STS Base Audit Update Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Update failed" },
      { status: 500 }
    );
  }
}
