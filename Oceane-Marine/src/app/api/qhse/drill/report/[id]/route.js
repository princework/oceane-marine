import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import DrillReport from "@/lib/mongodb/models/qhse-drill/DrillReport";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const report = await DrillReport.findById(id);
    if (!report) {
      return NextResponse.json(
        { success: false, error: "Drill report not found" },
        { status: 404 }
      );
    }
    await DrillReport.findByIdAndDelete(id);
    void notifyDelete("QHSE", "drill · report", id);
    return NextResponse.json(
      { success: true, message: "Drill report deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete Drill Report Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
