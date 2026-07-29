import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StatutoryCertificate from "@/lib/mongodb/models/hr/StatutoryCertificate";
import path from "path";
import fs from "fs/promises";
import { assertHrPermission } from "@/lib/auth/hrGuard";
import { notifyEdit } from "@/lib/notifications/moduleNotify";
import { isSameUtcDate } from "@/lib/utils/utcDate";

export async function PUT(req, { params }) {
  const guard = await assertHrPermission("canEdit");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;
    const formData = await req.formData();

    const location = formData.get("location");
    const typeOfDocs = formData.get("typeOfDocs");
    const year = formData.get("year");
    const validity = formData.get("validity");
    const attachment = formData.get("attachment");

    // Validate text fields
    if (!location || !location.trim()) {
      return NextResponse.json(
        { message: "Location is required" },
        { status: 400 }
      );
    }
    if (!typeOfDocs || !typeOfDocs.trim()) {
      return NextResponse.json(
        { message: "Type of document is required" },
        { status: 400 }
      );
    }
    if (!year) {
      return NextResponse.json(
        { message: "Year is required" },
        { status: 400 }
      );
    }
    if (!validity || !validity.trim()) {
      return NextResponse.json(
        { message: "Validity is required" },
        { status: 400 }
      );
    }

    // Find existing certificate
    const existingCert = await StatutoryCertificate.findById(id);
    if (!existingCert) {
      return NextResponse.json(
        { message: "Certificate not found" },
        { status: 404 }
      );
    }

    const newValidityDate = new Date(validity);
    const validityChanged =
      !existingCert.validity ||
      !isSameUtcDate(existingCert.validity, newValidityDate);

    const updateData = {
      location: location.trim(),
      typeOfDocs: typeOfDocs.trim(),
      year: year,
      validity: newValidityDate,
    };

    // Handle file upload if new file is provided
    if (attachment && typeof attachment !== "string" && attachment.name && attachment.size > 0) {
      // Delete old file if exists
      if (existingCert.attachment?.fileUrl) {
        try {
          const oldFilePath = path.join(process.cwd(), "public", existingCert.attachment.fileUrl);
          await fs.unlink(oldFilePath).catch(() => {}); // Ignore if file doesn't exist
        } catch (err) {
          console.error("Error deleting old file:", err);
        }
      }

      // Create directory structure: hr/location/type of docx/year/validity/attachment
      const sanitize = (str) => str.replace(/[^a-zA-Z0-9-_]/g, "_");
      const sanitizedLocation = sanitize(location.trim());
      const sanitizedTypeOfDocs = sanitize(typeOfDocs.trim());
      const sanitizedYear = sanitize(year);
      const sanitizedValidity = sanitize(validity.trim());

      const baseDir = path.join(
        process.cwd(),
        "public/uploads/hr",
        sanitizedLocation,
        sanitizedTypeOfDocs,
        sanitizedYear,
        sanitizedValidity
      );
      await fs.mkdir(baseDir, { recursive: true });

      // Save new file
      const attachmentBuffer = Buffer.from(await attachment.arrayBuffer());
      const attachmentFileName = `${Date.now()}-${sanitize(attachment.name)}`;
      const attachmentFilePath = path.join(baseDir, attachmentFileName);
      await fs.writeFile(attachmentFilePath, attachmentBuffer);
      const attachmentFileUrl = `/uploads/hr/${sanitizedLocation}/${sanitizedTypeOfDocs}/${sanitizedYear}/${sanitizedValidity}/${attachmentFileName}`;

      updateData.attachment = {
        fileUrl: attachmentFileUrl,
        originalFileName: attachment.name,
      };
    }

    const updateOps = { $set: updateData };
    if (validityChanged) {
      updateOps.$unset = {
        hrStatutoryReminder30dSentForValidity: "",
        hrStatutoryReminder15dSentForValidity: "",
      };
    }

    const updatedCert = await StatutoryCertificate.findByIdAndUpdate(id, updateOps, {
      new: true,
    });

    void notifyEdit("HR", "statutory-certificates · update", id);
    return NextResponse.json({ data: updatedCert }, { status: 200 });
  } catch (err) {
    console.error("Statutory certificate update error:", err);
    return NextResponse.json(
      { message: err.message || "Update failed", error: err.message },
      { status: 500 }
    );
  }
}
