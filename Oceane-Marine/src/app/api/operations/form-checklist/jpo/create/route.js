import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import Jpo from "@/lib/mongodb/models/operations-form-checklist/Jpo";

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
    const date = formData.get("date");
    const uploadedByName = formData.get("uploadedBy");
    const locationId = formData.get("locationId");

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (!locationId) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }

    const { default: Location } = await import("@/lib/mongodb/models/Location");
    const locationDoc = await Location.findById(locationId).lean();
    const locationName = locationDoc?.name || "";

    const latestRecord = await Jpo.findOne({}).sort({
      uploadedAt: -1,
    });

    const nextVersion = getNextVersion(latestRecord?.version);

    const uploadDir = path.join(
      process.cwd(),
      "uploads",
      "operations",
      "jpo",
      `v${nextVersion}`
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueFileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    fs.writeFileSync(filePath, buffer);

    const record = await Jpo.create({
      location: { locationId, name: locationName },
      filePath: `uploads/operations/jpo/v${nextVersion}/${uniqueFileName}`,
      version: nextVersion,
      date: new Date(date),
      uploadedBy: { name: uploadedByName || "" },
    });

    return NextResponse.json({
      message: "File uploaded successfully",
      version: nextVersion,
      data: record,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

