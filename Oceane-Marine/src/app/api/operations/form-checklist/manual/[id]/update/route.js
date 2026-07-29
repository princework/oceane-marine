import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import Manual from "@/lib/mongodb/models/operations-form-checklist/Manual";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

export const runtime = "nodejs";

function getNextRevNo(latestRevNo) {
  if (!latestRevNo) return "1.0";
  return (parseFloat(latestRevNo) + 0.1).toFixed(1);
}

export async function POST(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const formData = await req.formData();

    const file = formData.get("file");
    const date = formData.get("date");
    const name = (formData.get("name") || "").trim();
    const uploadedBy = formData.get("uploadedBy");

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const existingRecord = await Manual.findById(id);
    if (!existingRecord) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }

    // Drop legacy unique index on formCode so multiple manuals can share the same form code (e.g. revisions)
    try {
      await Manual.collection.dropIndex("formCode_1");
    } catch (_) {
      // Index may not exist or already dropped
    }

    const latest = await Manual.findOne({
      formCode: existingRecord.formCode,
    }).sort({ uploadedAt: -1 });

    const nextRevNo = getNextRevNo(latest?.revNo);

    const uploadDir = path.join(
      process.cwd(),
      "uploads",
      "operations",
      "manual",
      existingRecord.formCode,
      `v${nextRevNo}`
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueFileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    fs.writeFileSync(filePath, buffer);

    const now = new Date();
    const record = await Manual.create({
      name: name || existingRecord.name || "",
      revNo: nextRevNo,
      revDate: now,
      formCode: existingRecord.formCode,
      serialNumber: existingRecord.serialNumber || "",
      filePath: `uploads/operations/manual/${existingRecord.formCode}/v${nextRevNo}/${uniqueFileName}`,
      date: new Date(date),
      uploadedBy: { name: uploadedBy || "" },
    });

    void notifyOperationsEdit("Manual Form", record._id);
    return NextResponse.json({
      message: "Document updated successfully",
      revNo: nextRevNo,
      data: record,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
