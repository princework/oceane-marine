import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import Jpo from "@/lib/mongodb/models/operations-form-checklist/Jpo";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

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
    const operationRefInput = formData.get("operationRef");

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const existingRecord = await Jpo.findById(id);
    if (!existingRecord) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }

    const operationRef = (operationRefInput?.trim() || existingRecord.operationRef || "").trim();
    if (!operationRef) {
      return NextResponse.json({ error: "Operation Ref No is required" }, { status: 400 });
    }

    const operation = await StsOperation.findOne({
      Operation_Ref_No: operationRef,
      isLatest: true,
    });
    if (!operation) {
      return NextResponse.json(
        { error: "Selected operation could not be found" },
        { status: 400 }
      );
    }

    const latest = await Jpo.findOne({
      formCode: existingRecord.formCode,
    }).sort({ uploadedAt: -1 });

    const nextVersion = getNextVersion(latest?.version);

    const uploadDir = path.join(
      process.cwd(),
      "uploads",
      "operations",
      "jpo",
      existingRecord.formCode,
      `v${nextVersion}`
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueFileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    fs.writeFileSync(filePath, buffer);

    const location = existingRecord.location || {};
    let locationName = location.name;
    if (locationId) {
      const { default: Location } = await import("@/lib/mongodb/models/Location");
      const locationDoc = await Location.findById(locationId).lean();
      locationName = locationDoc?.name || locationName;
    }

    const relativeFilePath = `uploads/operations/jpo/${existingRecord.formCode}/v${nextVersion}/${uniqueFileName}`;

    const record = await Jpo.create({
      location: { locationId: locationId || location.locationId, name: locationName },
      operationRef,
      formCode: existingRecord.formCode,
      filePath: relativeFilePath,
      version: nextVersion,
      date: new Date(date),
      uploadedBy: { name: uploadedBy || "" },
    });

    // Keep the linked operation's JPO document in sync with the newest version.
    operation.jpo = relativeFilePath;
    await operation.save();

    void notifyOperationsEdit("JPO", record._id);
    return NextResponse.json({
      message: "Document updated successfully",
      version: nextVersion,
      data: record,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

