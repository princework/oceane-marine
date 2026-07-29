import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/config/connection";
import Accessories from "@/lib/mongodb/models/pms/Accessories.js";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import {
  createPmsInventoryCertificateArchiveEntry,
  PMS_ACCESSORIES_CERT_ARCHIVE_MODULE,
} from "@/lib/pms/createPmsInventoryCertificateArchiveEntry";

export async function POST(req, { params }) {
  const guard = await assertPmsPermission("canEdit");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "Invalid accessory id" }, { status: 400 });
  }

  let archiveReason = "";
  let scope = "both";
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.archiveReason === "string" && body.archiveReason.trim()) {
      archiveReason = body.archiveReason.trim().slice(0, 500);
    }
    if (body?.scope === "manufacturing" || body?.scope === "test") {
      scope = body.scope;
    }
  } catch {
    /* defaults */
  }

  if (!archiveReason) {
    if (scope === "manufacturing") {
      archiveReason = "Manual archive — manufacturing certificate (Accessories)";
    } else if (scope === "test") {
      archiveReason = "Manual archive — test certificate (Accessories)";
    } else {
      archiveReason = "Manual archive — certificates (Accessories)";
    }
  }

  try {
    await connectDB();
    const existing = await Accessories.findById(id);
    if (!existing || existing.isDeleted) {
      return NextResponse.json({ message: "Accessory not found" }, { status: 404 });
    }

    const archived = await createPmsInventoryCertificateArchiveEntry({
      doc: existing,
      moduleLabel: PMS_ACCESSORIES_CERT_ARCHIVE_MODULE,
      inventoryKind: "accessories",
      archiveReason,
      triggeredBy: "manual",
      replacedManufacturing: false,
      replacedTest: false,
      scope,
    });

    return NextResponse.json({
      message: "Archived to QHSE Archive.",
      archiveId: archived._id,
    });
  } catch (error) {
    const msg = error?.message || "Failed to archive certificates";
    const clientErr =
      msg.includes("No manufacturing") ||
      msg.includes("No test certificate") ||
      msg.includes("No certificate on file");
    console.error("Archive accessories certificates error:", error);
    return NextResponse.json(
      { message: msg },
      { status: clientErr ? 400 : 500 }
    );
  }
}
