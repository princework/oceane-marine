import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import QhseArchive from "@/lib/mongodb/models/qhse-archive/QhseArchive";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await QhseArchive.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Archive record not found" },
        { status: 404 }
      );
    }
    await QhseArchive.findByIdAndDelete(id);
    void notifyDelete("QHSE", "archive", id);
    return NextResponse.json(
      { success: true, message: "Archived file removed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete archive error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
