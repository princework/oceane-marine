import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/config/connection";
import QhseArchive from "@/lib/mongodb/models/qhse-archive/QhseArchive";
import { getQhseModule } from "@/lib/mongodb/qhseModuleRegistry";

async function readActor() {
  try {
    const jar = await cookies();
    return (
      jar.get("user_email")?.value ||
      jar.get("employee_id")?.value ||
      jar.get("user")?.value ||
      null
    );
  } catch {
    return null;
  }
}

export async function POST(req) {
  await connectDB();

  try {
    const body = await req.json();
    const {
      year,
      module: moduleName,
      documentType,
      formCode,
      title,
      filePath,
      fileUrl,
      originalId,
      metadata,
      sourceModuleKey,
    } = body;

    const yearNum =
      year != null ? Number(year) : new Date().getFullYear();
    if (Number.isNaN(yearNum)) {
      return NextResponse.json(
        { success: false, error: "Valid year is required" },
        { status: 400 }
      );
    }
    if (!moduleName || typeof moduleName !== "string" || !moduleName.trim()) {
      return NextResponse.json(
        { success: false, error: "Module is required" },
        { status: 400 }
      );
    }

    const doc = await QhseArchive.create({
      year: yearNum,
      module: String(moduleName).trim(),
      documentType: documentType != null ? String(documentType).trim() : "",
      formCode: formCode != null ? String(formCode).trim() : "",
      title: title != null ? String(title).trim() : "",
      filePath: filePath != null ? String(filePath).trim() : "",
      fileUrl: fileUrl != null ? String(fileUrl).trim() : "",
      originalId: originalId != null ? String(originalId).trim() : "",
      metadata: metadata || undefined,
    });

    // Best-effort: also flip isArchived on the source record so it leaves the
    // active list. Never fails the request — the catalog entry is already saved.
    let sourceArchived = false;
    if (sourceModuleKey && originalId) {
      try {
        const entry = getQhseModule(String(sourceModuleKey).trim());
        if (entry?.model) {
          const actor = await readActor();
          const result = await entry.model.updateOne(
            { _id: String(originalId).trim() },
            {
              $set: {
                isArchived: true,
                archivedAt: new Date(),
                archivedBy: actor,
              },
            }
          );
          sourceArchived = (result?.modifiedCount || 0) > 0;
        }
      } catch (flipErr) {
        console.warn(
          "Archive create: failed to flip isArchived on source record",
          flipErr
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Archived",
        data: doc,
        sourceArchived,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Archive create error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
