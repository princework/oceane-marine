import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";
import { connectDB } from "@/lib/config/connection";
import ControlledDocumentEntry from "@/lib/mongodb/models/qhse-controlled-document/ControlledDocumentEntry";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";

export const runtime = "nodejs";

function formatIssueDate(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function revLabel(record) {
  if (record?.revNo) return String(record.revNo);
  return `${record?.revMajor ?? 1}.${record?.revMinor ?? 0}`;
}

export async function GET(_req, ctx) {
  const guard = await assertQhsePermission("canDownload");
  if (!guard.ok) return guard.response;

  await connectDB();
  const { id } = (await ctx?.params) || {};
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const record = await ControlledDocumentEntry.findById(id).lean();
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const fp = record.attachment?.filePath;
    if (!fp || !String(fp).trim()) {
      return NextResponse.json({ error: "No file on record" }, { status: 404 });
    }

    const toAbs = (p) => (path.isAbsolute(p) ? p : path.join(process.cwd(), p));
    const absPath = toAbs(String(fp).trim());
    if (!fs.existsSync(absPath)) {
      return NextResponse.json({ error: "File missing on server" }, { status: 404 });
    }

    const diskName = path.basename(absPath);
    const origName = record.attachment?.originalFileName || diskName;
    const extFromOrig = path.extname(String(origName)).toLowerCase();
    const extFromDisk = path.extname(diskName).toLowerCase();
    const ext = extFromOrig || extFromDisk;

    const fileBuffer = fs.readFileSync(absPath);

    if (ext === ".doc" || ext === ".docx") {
      const contentType =
        ext === ".docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/msword";
      const base = path.basename(String(origName), ext) || "controlled-document";
      const downloadName = ext === ".doc" ? `${base}.doc` : `${base}.docx`;
      const safeName = String(downloadName).replace(/"/g, '\\"');
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${safeName}"`,
        },
      });
    }

    const rev = revLabel(record);
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "Controlled document (summary)",
              heading: HeadingLevel.TITLE,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Form code: ${record.formCode || "—"}`,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Title: ${record.title || "—"}`,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Rev No: ${rev}`,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Department: ${(record.department || "").trim() || "—"}`,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Issue date: ${formatIssueDate(record.issueDate)}`,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Documents (count): ${record.documents ?? 0}`,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Original attachment: ${origName}`,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "The uploaded file is not in Word format. Use the green Download icon in the Controlled Document Register to save the original file (PDF or other format). This Word document is a printable summary only.",
                  italics: true,
                  size: 22,
                }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const safeBase = String(record.formCode || "controlled-document").replace(
      /[^\w.-]+/g,
      "_"
    );
    const downloadName = `${safeBase}-Rev-${rev}-summary.docx`;
    const safeName = downloadName.replace(/"/g, '\\"');

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed to build Word download" },
      { status: 500 }
    );
  }
}
