import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import HseInductionChecklist from "@/lib/mongodb/models/qhse-form-checklist/HseInductionChecklist";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await HseInductionChecklist.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }
    await HseInductionChecklist.findByIdAndDelete(id);
    void notifyDelete("QHSE", "form-checklist · hse-induction-checklist", id);
    return NextResponse.json(
      { success: true, message: "Record deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete HSE induction checklist error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
