import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import KpiUpload from "@/lib/mongodb/models/qhse-kpi/KpiUpload";
import { getNextYearwiseSerial } from "@/lib/mongodb/models/YearwiseSerialCounter";
import { getQhseFormCode } from "@/lib/constants/qhse-form-codes";
import path from "node:path";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";

const ALLOWED_EXT = new Set([".pdf", ".xlsx", ".xls", ".csv", ".doc", ".docx"]);
const MAX_SIZE = 25 * 1024 * 1024;

export async function POST(req) {
  await connectDB();

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string" || !file.name || file.size === 0) {
      return NextResponse.json(
        { success: false, error: "File is required" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "File exceeds 25MB limit" },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid file type. Allowed: PDF, Excel (.xlsx, .xls), CSV, Word (.doc, .docx)",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const year = Number.parseInt(formData.get("year"), 10);
    const yearForSerial = Number.isNaN(year) ? undefined : year;
    const recordDate = yearForSerial ? new Date(yearForSerial, 0, 1) : new Date();

    const filePath = await saveQhseFile({
      formCode: "HSE-001B",
      date: recordDate,
      title: file.name.replace(/\.[^.]+$/, "") || "KPI-Upload",
      fileType: "documents",
      fileName: file.name,
      buffer,
    });

    const formCode = getQhseFormCode("KPI_UPLOAD") || null;
    const serialNumber = await getNextYearwiseSerial("KPI_UPLOAD", yearForSerial);

    const record = await KpiUpload.create({
      originalName: file.name,
      url: `/api/qhse/kpi/${filePath}`,
      localPath: path.join(process.cwd(), filePath),
      filePath,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      year: yearForSerial,
      formCode,
      serialNumber,
    });

    return NextResponse.json(
      {
        success: true,
        message: "File uploaded successfully",
        data: record,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("KPI Upload Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to upload file",
      },
      { status: 500 }
    );
  }
}
