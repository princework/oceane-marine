/**
 * Generic QHSE "archive / unarchive source record" endpoint.
 *
 * Flips isArchived on the original module document (soft-hide).
 * Works for any module registered in qhseModuleRegistry.
 *
 * POST body: { module: "<key>", id: "<mongoId>", reason?: "...", unarchive?: false }
 *   - unarchive=true un-archives the record (clears flag).
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/config/connection";
import { getQhseModule } from "@/lib/mongodb/qhseModuleRegistry";

async function readActor() {
  try {
    const jar = await cookies();
    const user =
      jar.get("user_email")?.value ||
      jar.get("employee_id")?.value ||
      jar.get("user")?.value ||
      null;
    return user;
  } catch {
    return null;
  }
}

export async function POST(req) {
  await connectDB();
  try {
    const body = await req.json();
    const moduleKey = String(body?.module || "").trim();
    const id = String(body?.id || "").trim();
    const reason = body?.reason ? String(body.reason).trim() : null;
    const unarchive = !!body?.unarchive;

    if (!moduleKey || !id) {
      return NextResponse.json(
        { success: false, error: "module and id are required" },
        { status: 400 }
      );
    }

    const entry = getQhseModule(moduleKey);
    if (!entry) {
      return NextResponse.json(
        { success: false, error: `Unknown module: ${moduleKey}` },
        { status: 400 }
      );
    }

    const Model = entry.model;
    const record = await Model.findById(id);
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    const actor = await readActor();
    if (unarchive) {
      record.isArchived = false;
      record.archivedAt = null;
      record.archivedBy = null;
      record.archiveReason = null;
    } else {
      record.isArchived = true;
      record.archivedAt = new Date();
      record.archivedBy = actor;
      record.archiveReason = reason;
    }
    await record.save();

    return NextResponse.json({
      success: true,
      message: unarchive ? "Record restored" : "Record archived",
      data: {
        _id: record._id,
        isArchived: record.isArchived,
        archivedAt: record.archivedAt,
        archivedBy: record.archivedBy,
      },
    });
  } catch (error) {
    console.error("Archive-record error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
