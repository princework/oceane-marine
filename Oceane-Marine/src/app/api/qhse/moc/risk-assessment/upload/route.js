import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCRiskAssessment from "@/lib/mongodb/models/qhse-moc/mocs-riskAssessment";
import path from "node:path";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";

const ALLOWED_EXT = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".ppt", ".pptx", ".txt", ".jpg", ".jpeg", ".png", ".gif",
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10MB per file

export async function POST(req) {
  await connectDB();

  try {
    const formData = await req.formData();
    const yearRaw = formData.get("year");
    const yearNum =
      yearRaw != null && String(yearRaw).trim() !== "" && !Number.isNaN(Number(yearRaw))
        ? Number(yearRaw)
        : new Date().getFullYear();

    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files provided" },
        { status: 400 }
      );
    }

    const uploadedFiles = [];

    for (const file of files) {
      if (!file || typeof file === "string" || !file.name || file.size === 0) {
        continue;
      }

      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: `File "${file.name}" exceeds 10MB limit`,
          },
          { status: 400 }
        );
      }

      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        return NextResponse.json(
          {
            success: false,
            error: `File "${file.name}" has invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, JPG, PNG, GIF`,
          },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const filePath = await saveQhseFile({
        formCode: "QAF-OFD-058A",
        date: new Date(yearNum, 0, 1),
        title: "MOC-Risk-Assessment",
        fileType: "documents",
        fileName: file.name,
        buffer,
      });

      uploadedFiles.push({
        name: file.name,
        filename: file.name,
        size: file.size,
        url: filePath,
        filePath,
        mimeType: file.type || "application/octet-stream",
        uploadedAt: new Date(),
      });
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid files to upload" },
        { status: 400 }
      );
    }

    const totalSize = uploadedFiles.reduce(
      (sum, file) => sum + file.size,
      0
    );

    const mocRiskAssessment = new MOCRiskAssessment({
      title: "MOC Risk Assessment",
      files: uploadedFiles,
      totalSize: totalSize,
      year: yearNum,
      ...(req.user?._id ? { uploadedBy: req.user._id } : {}),
    });

    await mocRiskAssessment.save();

    return NextResponse.json(
      {
        success: true,
        message: "Files uploaded successfully",
        data: mocRiskAssessment,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Risk Assessment Upload Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to upload files",
      },
      { status: 500 }
    );
  }
}
