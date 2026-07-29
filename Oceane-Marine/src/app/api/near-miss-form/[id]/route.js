import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import NearMiss from "@/lib/mongodb/models/qhse-near-miss/NearMiss";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await NearMiss.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }
    await NearMiss.findByIdAndDelete(id);
    void notifyDelete("QHSE", "near-miss-form", id);
    return NextResponse.json(
      { success: true, message: "Report deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete near-miss report error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
