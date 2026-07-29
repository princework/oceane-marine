import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import NewBaseSetupChecklist from "@/lib/mongodb/models/qhse-form-checklist/NewBaseSetupChecklist";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing record ID" },
        { status: 400 }
      );
    }

    const record = await NewBaseSetupChecklist.findById(id).lean();
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    if (!record.filePath) {
      return NextResponse.json(
        { success: false, error: "No attached file found for this checklist" },
        { status: 404 }
      );
    }

    const fileUrl = record.filePath;

    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      return NextResponse.redirect(fileUrl, { status: 307 });
    }

    const normalizedUrl = fileUrl.replace(/\\/g, "/");
    let absolutePath;
    if (path.isAbsolute(normalizedUrl)) {
      absolutePath = normalizedUrl;
    } else if (normalizedUrl.startsWith("/")) {
      absolutePath = path.resolve(process.cwd(), "public", normalizedUrl.slice(1));
    } else {
      absolutePath = path.resolve(process.cwd(), normalizedUrl);
    }

    absolutePath = path.normalize(absolutePath);

    if (!fs.existsSync(absolutePath)) {
      const altPath = path.join(process.cwd(), normalizedUrl.replace(/\//g, path.sep));
      if (fs.existsSync(altPath)) {
        absolutePath = altPath;
      } else {
        return NextResponse.json(
          { success: false, error: "File not found on server" },
          { status: 404 }
        );
      }
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const fileName = path.basename(absolutePath);
    const fileExt = path.extname(fileName).toLowerCase();

    const contentTypeMap = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".txt": "text/plain",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
    };

    const contentType = contentTypeMap[fileExt] || "application/octet-stream";
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("New Base Setup Checklist file download error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to download file" },
      { status: 500 }
    );
  }
}
