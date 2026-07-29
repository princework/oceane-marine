import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import ControlledDocumentEntry from "@/lib/mongodb/models/qhse-controlled-document/ControlledDocumentEntry";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";
import { parseControlledDocumentRevNo } from "@/lib/qhse/controlledDocumentRev";

export const runtime = "nodejs";

export async function POST(req) {
  const guard = await assertQhsePermission("canCreate");
  if (!guard.ok) return guard.response;

  try {
    await connectDB();
    const form = await req.formData();
    const formCode = form.get("formCode");
    const title = form.get("title");
    const documentsRaw = form.get("documents");
    const documents = Math.max(
      0,
      Number.parseInt(String(documentsRaw ?? "0"), 10) || 0
    );
    const issueDateRaw = form.get("issueDate");
    const department = form.get("department") || "";
    const revNoRaw = form.get("revNo");
    const file = form.get("document");

    const revParsed = parseControlledDocumentRevNo(revNoRaw);
    if (!revParsed.ok) {
      return NextResponse.json({ error: revParsed.error }, { status: 400 });
    }

    if (!formCode || !String(formCode).trim()) {
      return NextResponse.json({ error: "Form Code is required" }, { status: 400 });
    }
    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!file || typeof file === "string" || !file.size) {
      return NextResponse.json({ error: "Document file is required" }, { status: 400 });
    }

    const issueDate =
      issueDateRaw && String(issueDateRaw).trim()
        ? new Date(String(issueDateRaw).trim())
        : null;
    if (issueDate && Number.isNaN(issueDate.getTime())) {
      return NextResponse.json({ error: "Invalid issue date" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await saveQhseFile({
      formCode: String(formCode).trim(),
      location: department ? String(department).trim() : undefined,
      date: issueDate || new Date(),
      title: String(title).trim(),
      fileType: "documents",
      fileName: file.name,
      buffer,
    });

    const record = await ControlledDocumentEntry.create({
      formCode: String(formCode).trim(),
      title: String(title).trim(),
      documents,
      issueDate: issueDate || undefined,
      revMajor: revParsed.revMajor,
      revMinor: revParsed.revMinor,
      department: typeof department === "string" ? department.trim() : "",
      attachment: {
        filePath,
        originalFileName: file.name,
        mimeType: file.type || "",
        fileSize: file.size,
      },
    });

    return NextResponse.json(
      {
        message: "Controlled document created",
        data: {
          ...record.toObject(),
          revNo: `${record.revMajor}.${record.revMinor}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("controlled-document-entry create error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create" },
      { status: 500 }
    );
  }
}
