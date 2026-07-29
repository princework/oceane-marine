import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { connectDB } from "@/lib/config/connection";
import KpiUpload from "@/lib/mongodb/models/qhse-kpi/KpiUpload";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await KpiUpload.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "KPI upload not found" },
        { status: 404 }
      );
    }
    const localPath = doc.localPath;
    await KpiUpload.findByIdAndDelete(id);
    if (localPath) {
      try {
        await fs.unlink(localPath);
      } catch {
        // ignore if file already missing
      }
    }
    void notifyDelete("QHSE", "kpi", id);
    return NextResponse.json(
      { success: true, message: "KPI upload deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete KPI upload error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
