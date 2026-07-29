import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import BestPractice from "@/lib/mongodb/models/qhse-best-practices/BestPractice";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await BestPractice.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Best practice not found" },
        { status: 404 }
      );
    }
    await BestPractice.findByIdAndDelete(id);
    void notifyDelete("QHSE", "best-practice", id);
    return NextResponse.json(
      { success: true, message: "Best practice deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete best practice error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
