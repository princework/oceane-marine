import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import Manual from "@/lib/mongodb/models/operations-form-checklist/Manual";

export const runtime = "nodejs";

export async function POST(req) {
  await connectDB();

  try {
    const formData = await req.formData();

    const file = formData.get("file");
    const date = formData.get("date");
    const name = (formData.get("name") || "").trim();
    const uploadedByName = formData.get("uploadedBy");
    const formCode = (formData.get("formCode") || "").trim();

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (!formCode) {
      return NextResponse.json({ error: "Form code is required" }, { status: 400 });
    }

    const revNo = "1.0";

    const uploadDir = path.join(
      process.cwd(),
      "uploads",
      "operations",
      "manual",
      formCode,
      `v${revNo}`
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueFileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    fs.writeFileSync(filePath, buffer);

    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const prefix = year + "-";
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = await Manual.countDocuments({
      formCode,
      serialNumber: new RegExp("^" + escapedPrefix),
    });
    const serialNumber = prefix + String(count + 1).padStart(3, "0");

    const now = new Date();
    const record = await Manual.create({
      name: name || "",
      revNo,
      revDate: now,
      formCode,
      serialNumber,
      filePath: `uploads/operations/manual/${formCode}/v${revNo}/${uniqueFileName}`,
      date: dateObj,
      uploadedBy: { name: uploadedByName || "" },
    });

    return NextResponse.json({
      message: "File uploaded successfully",
      revNo,
      data: record,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
