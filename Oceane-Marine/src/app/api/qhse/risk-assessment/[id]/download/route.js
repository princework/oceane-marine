import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import RiskAssessment from "@/lib/mongodb/models/qhse-risk-assessment/RiskAssessment";

export const runtime = "nodejs";

export async function GET(_req, ctx) {
  await connectDB();

  const { id } = (await ctx?.params) || {};
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const record = await RiskAssessment.findById(id);
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const toAbs = (p) => (path.isAbsolute(p) ? p : path.join(process.cwd(), p));
    let absPath = toAbs(record.filePath);

    // legacy spelling fallback
    if (!fs.existsSync(absPath)) {
      const alt = record.filePath.replace("risk-assessment", "risk-assesment");
      const absAlt = toAbs(alt);
      if (fs.existsSync(absAlt)) absPath = absAlt;
      else return NextResponse.json({ error: "File missing on server" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(absPath);
    const fileName = path.basename(absPath);
    const fileExt = path.extname(fileName).toLowerCase();
    const contentTypeMap = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".txt": "text/plain",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
    };
    const contentType =
      contentTypeMap[fileExt] || record.mimeType || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${record.fileName || fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}