import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TrainingRecord from "@/lib/mongodb/models/qhse-training/TrainingRecord";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  try {
    await connectDB();
    const { id } = await params; // Next.js 15 requires await for params

    const record = await TrainingRecord.findOne({
      _id: id,
      status: "Draft",
    });

    if (!record) {
      return NextResponse.json(
        {
          success: false,
          error: "Training record not found or already completed",
        },
        { status: 404 }
      );
    }

    record.status = "Completed";
    record.completedAt = new Date();

    // OPTIONAL (later with auth)
    // record.approvedBy = req.user._id;

    await record.save();

    void notifyEdit("QHSE", "training · record · complete", id);
    return NextResponse.json({ success: true, data: record }, { status: 200 });
  } catch (error) {
    console.error("Complete Training Record Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
