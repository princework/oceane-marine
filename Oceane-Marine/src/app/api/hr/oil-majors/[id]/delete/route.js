import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import OilMajor from "@/lib/mongodb/models/hr/OilMajor";
import path from "path";
import fs from "fs/promises";
import { assertHrPermission } from "@/lib/auth/hrGuard";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  const guard = await assertHrPermission("canDelete");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;

    const record = await OilMajor.findById(id);
    if (!record) {
      return NextResponse.json(
        { message: "Record not found" },
        { status: 404 }
      );
    }

    // Delete attached file if exists
    if (record.attachment?.fileUrl) {
      try {
        const filePath = path.join(process.cwd(), "public", record.attachment.fileUrl);
        await fs.unlink(filePath);
        // Try to clean up empty directory
        const dir = path.dirname(filePath);
        const files = await fs.readdir(dir);
        if (files.length === 0) await fs.rmdir(dir);
      } catch {
        // Ignore file deletion errors
      }
    }

    await OilMajor.findByIdAndDelete(id);

    void notifyDelete("HR", "oil-majors · delete", id);
    return NextResponse.json(
      { message: "Oil Major record deleted successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("Oil Major delete error:", err);
    return NextResponse.json(
      { message: err.message || "Deletion failed", error: err.message },
      { status: 500 }
    );
  }
}
