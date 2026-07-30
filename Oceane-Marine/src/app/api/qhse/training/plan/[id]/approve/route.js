import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TrainingPlan from "@/lib/mongodb/models/qhse-training/TrainingPlan";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

export const runtime = "nodejs";

export async function PUT(req, { params }) {
  const guard = await assertQhsePermission("canApprove");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;
    const plan = await TrainingPlan.findById(id);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Training plan not found" },
        { status: 404 }
      );
    }

    if (plan.status !== "Pending Approval") {
      return NextResponse.json(
        { success: false, error: "Only plans pending approval can be approved." },
        { status: 400 }
      );
    }

    plan.status = "Approved";
    plan.approvedBy = guard.user._id;
    plan.approvedAt = new Date();
    plan.rejectionReason = "";
    plan.rejectedBy = null;
    plan.rejectedAt = null;
    await plan.save();

    void notifyEdit("QHSE", "training · plan · approve", id);

    return NextResponse.json(
      { success: true, message: "Training plan approved.", data: plan },
      { status: 200 }
    );
  } catch (error) {
    console.error("Training Plan approve error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to approve" },
      { status: 500 }
    );
  }
}
