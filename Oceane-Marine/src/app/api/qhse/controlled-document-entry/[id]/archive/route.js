import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/config/connection";
import ControlledDocumentEntry from "@/lib/mongodb/models/qhse-controlled-document/ControlledDocumentEntry";
import QhseArchive from "@/lib/mongodb/models/qhse-archive/QhseArchive";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import {
  archiveControlledDocumentRevision,
  QHSE_CONTROLLED_DOCUMENTS_ARCHIVE_MODULE,
} from "@/lib/qhse/archiveControlledDocumentRevision";

export const runtime = "nodejs";

export async function POST(req, ctx) {
  const guard = await assertQhsePermission("canEdit");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let archiveReason = "Manual archive — controlled document (register entry)";
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.archiveReason === "string" && body.archiveReason.trim()) {
      archiveReason = body.archiveReason.trim().slice(0, 500);
    }
  } catch {
    /* defaults */
  }

  try {
    await connectDB();
    const existing = await ControlledDocumentEntry.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fp = existing.attachment?.filePath?.trim?.() || "";
    if (!fp) {
      return NextResponse.json(
        { error: "No file on record to archive" },
        { status: 400 }
      );
    }

    const revMajor = Number(existing.revMajor ?? 1);
    const revMinor = Number(existing.revMinor ?? 0);
    const dupCutoff = new Date(Date.now() - 12_000);
    const recentDup = await QhseArchive.findOne({
      module: QHSE_CONTROLLED_DOCUMENTS_ARCHIVE_MODULE,
      originalId: String(existing._id),
      archivedAt: { $gte: dupCutoff },
      "metadata.triggeredBy": "manual",
      "metadata.revMajor": revMajor,
      "metadata.revMinor": revMinor,
      "metadata.liveSourcePathAtArchive": fp,
    })
      .sort({ archivedAt: -1 })
      .lean();

    if (recentDup) {
      return NextResponse.json({
        message:
          "This revision was just archived. Duplicate request was ignored.",
        duplicateSkipped: true,
      });
    }

    const created = await archiveControlledDocumentRevision({
      doc: existing,
      reason: archiveReason,
      triggeredBy: "manual",
    });
    if (!created) {
      return NextResponse.json(
        { error: "Could not archive the file (missing on disk or copy failed)." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Current file revision archived to QHSE Archive (QHSE Controlled Documents).",
    });
  } catch (error) {
    console.error("controlled-document-entry archive error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to archive" },
      { status: 500 }
    );
  }
}
