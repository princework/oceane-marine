import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import InspectionChecklist from "@/lib/mongodb/models/operations-form-checklist/InspectionChecklist";
import { notifyOperationsEdit } from "@/lib/notifications/operationsNotified";

export const runtime = "nodejs";

function getNextVersion(latestVersion) {
  if (!latestVersion) return "1.0";
  return (parseFloat(latestVersion) + 0.1).toFixed(1);
}

export async function POST(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const formData = await req.formData();

    const file = formData.get("file");
    const date = formData.get("date");
    const uploadedBy = formData.get("uploadedBy");
    const locationId = formData.get("locationId");
    const formCode = formData.get("formNumber"); // formNumber from frontend becomes formCode
    const year = formData.get("year");
    const boatName = formData.get("boatName");

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (!locationId) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }

    if (!formCode) {
      return NextResponse.json({ error: "Form number is required" }, { status: 400 });
    }

    // For form 013, year and boatName are required
    if (formCode === "OPS-OFD-013") {
      if (!year) {
        return NextResponse.json({ error: "Year is required for form 013" }, { status: 400 });
      }
      if (!boatName) {
        return NextResponse.json({ error: "Boat name is required for form 013" }, { status: 400 });
      }
    }

    const existingRecord = await InspectionChecklist.findById(id);
    if (!existingRecord) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }

    const { default: Location } = await import("@/lib/mongodb/models/Location");
    const locationDoc = await Location.findById(locationId).lean();
    const locationName = locationDoc?.name || "";

    // For form 013, find latest version by formCode, year, and boatName
    // For other forms, find latest version by formCode
    let latest;
    if (formCode === "OPS-OFD-013") {
      latest = await InspectionChecklist.findOne({
        formCode,
        year: parseInt(year),
        boatName,
      }).sort({ uploadedAt: -1 });
    } else {
      latest = await InspectionChecklist.findOne({
        formCode,
      }).sort({ uploadedAt: -1 });
    }

    const nextVersion = getNextVersion(latest?.version);

    // Use /tmp for Vercel compatibility, or uploads for production server
    const isVercel = process.env.VERCEL === "1";
    const baseDir = isVercel ? "/tmp" : process.cwd();
    const uploadDir = path.join(
      baseDir,
      "uploads",
      "operations",
      "inspection-checklist",
      existingRecord.formCode,
      `v${nextVersion}`
    );

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueFileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    fs.writeFileSync(filePath, buffer);

    const recordData = {
      formCode, // Use the formCode from the form (which is the form number)
      filePath: `uploads/operations/inspection-checklist/${formCode}/v${nextVersion}/${uniqueFileName}`,
      version: nextVersion,
      date: new Date(date),
      uploadedBy: { name: uploadedBy || "" },
      location: { locationId, name: locationName },
    };

    if (formCode === "OPS-OFD-013") {
      recordData.year = parseInt(year);
      recordData.boatName = boatName;
    }

    const record = await InspectionChecklist.create(recordData);

    void notifyOperationsEdit("Inspection Checklist", record._id);
    return NextResponse.json({
      message: "Document updated successfully",
      version: nextVersion,
      data: record,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

