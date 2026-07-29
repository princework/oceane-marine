import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import Quotation from "@/lib/mongodb/models/operations-form-checklist/Quotation";
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

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const existingRecord = await Quotation.findById(id);
    if (!existingRecord) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }

    const latest = await Quotation.findOne({
      formCode: existingRecord.formCode,
    }).sort({ uploadedAt: -1 });

    const nextVersion = getNextVersion(latest?.version);

    const uploadDir = path.join(
      process.cwd(),
      "uploads",
      "operations",
      "quotation",
      existingRecord.formCode,
      `v${nextVersion}`
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueFileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    fs.writeFileSync(filePath, buffer);

    const record = await Quotation.create({
      formCode: existingRecord.formCode,
      filePath: `uploads/operations/quotation/${existingRecord.formCode}/v${nextVersion}/${uniqueFileName}`,
      version: nextVersion,
      date: new Date(date),
      uploadedBy: { name: uploadedBy || "" },
    });

    void notifyOperationsEdit("Quotation", record._id);
    return NextResponse.json({
      message: "Document updated successfully",
      version: nextVersion,
      data: record,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

