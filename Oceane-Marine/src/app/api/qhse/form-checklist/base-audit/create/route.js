import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsBaseAuditReport from "@/lib/mongodb/models/qhse-form-checklist/StsBaseAuditReport";
import Location from "@/lib/mongodb/models/Location";
import { getNextYearwiseSerial } from "@/lib/mongodb/models/YearwiseSerialCounter";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req) {
  // Everything (including connectDB) stays inside try/catch so we always
  // return JSON — never an HTML error page that breaks the client's JSON
  // parser and looks like a failed upload with no explanation.
  try {
    await connectDB();

    const formData = await req.formData();

    const file = formData.get("file");
    const yearRaw = formData.get("year");
    const description = formData.get("description");
    const uploadedByName = formData.get("uploadedBy");
    const locationIdRaw = formData.get("locationId");

    const year =
      yearRaw != null && yearRaw !== ""
        ? Number(yearRaw)
        : new Date().getFullYear();

    if (Number.isNaN(year)) {
      return NextResponse.json(
        { error: "Valid year is required." },
        { status: 400 }
      );
    }

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Please attach a valid file." },
        { status: 400 }
      );
    }

    if (typeof file.size === "number" && file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 25 MB limit." },
        { status: 413 }
      );
    }

    const trimmedName =
      typeof uploadedByName === "string" ? uploadedByName.trim() : "";
    if (!trimmedName) {
      return NextResponse.json(
        { error: "Uploaded by name is required." },
        { status: 400 }
      );
    }

    const descriptionStr =
      typeof description === "string" ? description.trim() : "";

    const version = "1.0";

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let locationData = null;
    const locId =
      typeof locationIdRaw === "string" && locationIdRaw.trim()
        ? locationIdRaw.trim()
        : null;
    if (locId) {
      const locationDoc = await Location.findById(locId).lean();
      if (locationDoc) {
        locationData = { locationId: locationDoc._id, name: locationDoc.name };
      }
    }

    const recordDate = new Date(year, 0, 1);
    const filePath = await saveQhseFile({
      formCode: "QAF-OFD-004",
      location: locationData?.name || null,
      date: recordDate,
      title: descriptionStr || "Base-Audit",
      fileType: "documents",
      fileName: file.name,
      buffer,
    });

    const serialNumber = await getNextYearwiseSerial("STS_BASE_AUDIT", year);

    const record = await StsBaseAuditReport.create({
      serialNumber,
      description: descriptionStr,
      filePath,
      version,
      date: new Date(),
      ...(locationData && { location: locationData }),
      uploadedBy: { name: trimmedName },
    });

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      version,
      data: record,
    });
  } catch (error) {
    console.error("STS Base Audit create error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload report." },
      { status: 500 }
    );
  }
}
