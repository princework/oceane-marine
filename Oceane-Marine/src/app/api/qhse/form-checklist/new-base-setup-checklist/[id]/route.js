import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import NewBaseSetupChecklist from "@/lib/mongodb/models/qhse-form-checklist/NewBaseSetupChecklist";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await NewBaseSetupChecklist.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }
    const filePath = doc.filePath;
    await NewBaseSetupChecklist.findByIdAndDelete(id);
    if (filePath) {
      const fullPath = path.join(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // ignore
        }
      }
    }
    void notifyDelete("QHSE", "form-checklist · new-base-setup-checklist", id);
    return NextResponse.json(
      { success: true, message: "Record deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete new base setup checklist error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
