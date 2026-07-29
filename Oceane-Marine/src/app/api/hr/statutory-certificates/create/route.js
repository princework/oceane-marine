import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StatutoryCertificate from "@/lib/mongodb/models/hr/StatutoryCertificate";
import path from "path";
import fs from "fs/promises";
import { assertHrPermission } from "@/lib/auth/hrGuard";

export async function POST(req) {
  const guard = await assertHrPermission("canCreate");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
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

    // Validate file - check if it is a valid File object
    if (!attachment || typeof attachment === "string" || !attachment.name || attachment.size === 0) {
      return NextResponse.json(
        { message: "Attachment file is required" },
        { status: 400 }
      );
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

    // Save Attachment
    const attachmentBuffer = Buffer.from(await attachment.arrayBuffer());
    const attachmentFileName = `${Date.now()}-${sanitize(attachment.name)}`;
    const attachmentFilePath = path.join(baseDir, attachmentFileName);
    await fs.writeFile(attachmentFilePath, attachmentBuffer);
    const attachmentFileUrl = `/uploads/hr/${sanitizedLocation}/${sanitizedTypeOfDocs}/${sanitizedYear}/${sanitizedValidity}/${attachmentFileName}`;

    const certificate = await StatutoryCertificate.create({
      location: location.trim(),
      typeOfDocs: typeOfDocs.trim(),
      year: year,
      validity: new Date(validity),
      attachment: {
        fileUrl: attachmentFileUrl,
        originalFileName: attachment.name,
      },
    });

    return NextResponse.json({ data: certificate }, { status: 201 });
  } catch (err) {
    console.error("Statutory certificate creation error:", err);
    return NextResponse.json(
      { message: err.message || "Upload failed", error: err.message },
      { status: 500 }
    );
  }
}
