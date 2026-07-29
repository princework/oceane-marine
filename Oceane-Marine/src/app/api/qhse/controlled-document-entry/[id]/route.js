import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { connectDB } from "@/lib/config/connection";
import ControlledDocumentEntry from "@/lib/mongodb/models/qhse-controlled-document/ControlledDocumentEntry";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";
import { archiveControlledDocumentRevision } from "@/lib/qhse/archiveControlledDocumentRevision";
import { parseControlledDocumentRevNo } from "@/lib/qhse/controlledDocumentRev";

export const runtime = "nodejs";

async function safeUnlink(relativePath) {
  if (!relativePath || typeof relativePath !== "string") return;
  const abs = path.join(process.cwd(), relativePath.replace(/^\//, ""));
  try {
    await fs.unlink(abs);
  } catch {
    /* ignore */
  }
}

export async function PATCH(req, ctx) {
  const guard = await assertQhsePermission("canEdit");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await connectDB();
    const existing = await ControlledDocumentEntry.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const form = await req.formData();
    const formCode = form.get("formCode");
    const title = form.get("title");
    const documentsRaw = form.get("documents");
    const documents = Math.max(
      0,
      Number.parseInt(String(documentsRaw ?? "0"), 10) || 0
    );
    const issueDateRaw = form.get("issueDate");
    const department = form.get("department") ?? "";
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

    let issueDate = null;
    if (issueDateRaw && String(issueDateRaw).trim()) {
      issueDate = new Date(String(issueDateRaw).trim());
      if (Number.isNaN(issueDate.getTime())) {
        return NextResponse.json({ error: "Invalid issue date" }, { status: 400 });
      }
    }

    const hasNewFile =
      file &&
      typeof file !== "string" &&
      file.name &&
      file.size > 0;

    const oldPath = existing.attachment?.filePath?.trim?.() || "";

    if (hasNewFile && oldPath) {
      const archivedRow = await archiveControlledDocumentRevision({
        doc: existing,
        reason: "Document file replaced on edit",
        triggeredBy: "replace_on_save",
      });
      if (!archivedRow) {
        return NextResponse.json(
          {
            error:
              "Could not archive the previous file (missing on disk or copy failed). Replace cancelled.",
          },
          { status: 500 }
        );
      }
      await safeUnlink(oldPath);
    }

    existing.formCode = String(formCode).trim();
    existing.title = String(title).trim();
    existing.documents = documents;
    existing.department =
      typeof department === "string" ? department.trim() : "";
    existing.issueDate = issueDate;
    existing.revMajor = revParsed.revMajor;
    existing.revMinor = revParsed.revMinor;

    if (hasNewFile) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = await saveQhseFile({
        formCode: existing.formCode,
        location: existing.department || undefined,
        date: existing.issueDate || new Date(),
        title: existing.title,
        fileType: "documents",
        fileName: file.name,
        buffer,
      });
      existing.attachment = {
        filePath,
        originalFileName: file.name,
        mimeType: file.type || "",
        fileSize: file.size,
      };
    }

    await existing.save();

    const obj = existing.toObject();
    return NextResponse.json({
      message: "Controlled document updated",
      data: {
        ...obj,
        revNo: `${obj.revMajor}.${obj.revMinor}`,
      },
    });
  } catch (error) {
    console.error("controlled-document-entry PATCH error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req, ctx) {
  const guard = await assertQhsePermission("canDelete");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await connectDB();
    const existing = await ControlledDocumentEntry.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fp = existing.attachment?.filePath?.trim?.();
    if (fp) await safeUnlink(fp);

    await ControlledDocumentEntry.findByIdAndDelete(id);
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("controlled-document-entry DELETE error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete" },
      { status: 500 }
    );
  }
}
