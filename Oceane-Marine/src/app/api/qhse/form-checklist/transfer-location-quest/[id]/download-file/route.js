import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import STSTransferLocationQuest from "@/lib/mongodb/models/qhse-form-checklist/StsTransferLocationQuest";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const record = await STSTransferLocationQuest.findById(id);

    if (!record) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (!record.filePath) {
      return NextResponse.json(
        { error: "No file attached to this record" },
        { status: 404 }
      );
    }

    const absolutePath = path.join(process.cwd(), record.filePath);

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json(
        { error: "File not found on server" },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const fileName = path.basename(absolutePath);
    const fileExt = path.extname(fileName).toLowerCase();

    const contentTypeMap = {
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
      ".pdf": "application/pdf",
      ".xls": "application/vnd.ms-excel",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".txt": "text/plain",
    };

    const contentType = contentTypeMap[fileExt] || "application/octet-stream";
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Transfer Location Questionnaire file download error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
