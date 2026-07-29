import { NextResponse } from "next/server";
import fs from "node:fs";
import { connectDB } from "@/lib/config/connection.js";
import WarehouseManagement from "@/lib/mongodb/models/pms/WarehouseManagement";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import { NOTIFICATION_MODULES, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(_req, { params }) {
  const guard = await assertPmsPermission("canDelete");
  if (!guard.ok) return guard.response;

  try {
    await connectDB();

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: "Missing record id" }, { status: 400 });
    }

    const existing = await WarehouseManagement.findById(id);
    if (!existing || existing.isDeleted) {
      return NextResponse.json({ message: "Record not found" }, { status: 404 });
    }

    /** Best-effort cleanup of stored attachment files; never block the delete on FS errors. */
    if (Array.isArray(existing.attachments)) {
      for (const att of existing.attachments) {
        if (!att?.filePath) continue;
        try {
          if (fs.existsSync(att.filePath)) {
            fs.unlinkSync(att.filePath);
          }
        } catch (err) {
          console.warn("Warehouse delete: could not remove attachment", att.filePath, err?.message);
        }
      }
    }

    await WarehouseManagement.findByIdAndDelete(id);

    void notifyDelete(NOTIFICATION_MODULES.PMS, "Warehouse Management", id);

    return NextResponse.json({ success: true, message: "Record deleted" });
  } catch (error) {
    console.error("Warehouse delete error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to delete record" },
      { status: 500 }
    );
  }
}
