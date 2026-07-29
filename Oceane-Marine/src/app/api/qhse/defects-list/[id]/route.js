import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await EquipmentDefect.findById(id).lean();
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Defect not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: doc }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await EquipmentDefect.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Defect not found" },
        { status: 404 }
      );
    }
    await EquipmentDefect.findByIdAndDelete(id);
    void notifyDelete("QHSE", "defects-list", id);
    return NextResponse.json(
      { success: true, message: "Defect deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete equipment defect error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
