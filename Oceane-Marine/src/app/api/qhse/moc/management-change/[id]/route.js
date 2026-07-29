import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await MOCManagementChange.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "MOC form not found" },
        { status: 404 }
      );
    }
    await MOCManagementChange.findByIdAndDelete(id);
    void notifyDelete("QHSE", "moc · management-change", id);
    return NextResponse.json(
      { success: true, message: "MOC form deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete MOC management change error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
