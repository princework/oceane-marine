import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TrainingPlan from "@/lib/mongodb/models/qhse-training/TrainingPlan";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const existingPlan = await TrainingPlan.findById(id);
    if (!existingPlan) {
      return NextResponse.json(
        { error: "Training plan not found" },
        { status: 404 }
      );
    }
    if (existingPlan.status !== "Draft") {
      return NextResponse.json(
        { error: "Only draft plans can be approved" },
        { status: 403 }
      );
    }
    existingPlan.status = "Approved";
    await existingPlan.save();

    void notifyEdit("QHSE", "training · plan · admin-approve", existingPlan._id);

    return NextResponse.json({ success: true, data: existingPlan });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
