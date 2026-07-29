import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TrainingRecord from "@/lib/mongodb/models/qhse-training/TrainingRecord";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const existingRecord = await TrainingRecord.findById(id);
    if (!existingRecord) {
      return NextResponse.json(
        { error: "Training record not found" },
        { status: 404 }
      );
    }
    if (existingRecord.status !== "Draft") {
      return NextResponse.json(
        { error: "Only draft records can be completed" },
        { status: 403 }
      );
    }
    existingRecord.status = "Completed";
    await existingRecord.save();
    void notifyEdit("QHSE", "training · record · complete · admin-record", id);
    return NextResponse.json(
      {
        message: "Training record completed successfully",
        data: existingRecord,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
