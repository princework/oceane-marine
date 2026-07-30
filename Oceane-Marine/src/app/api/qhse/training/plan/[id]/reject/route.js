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
    const body = await req.json().catch(() => ({}));
    const rejectionReason =
      typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";

    if (!rejectionReason) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required." },
        { status: 400 }
      );
    }

    const plan = await TrainingPlan.findById(id);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Training plan not found" },
        { status: 404 }
      );
    }

    if (plan.status !== "Pending Approval") {
      return NextResponse.json(
        { success: false, error: "Only plans pending approval can be rejected." },
        { status: 400 }
      );
    }

    plan.status = "Rejected";
    plan.rejectionReason = rejectionReason;
    plan.rejectedBy = guard.user._id;
    plan.rejectedAt = new Date();
    plan.approvedBy = null;
    plan.approvedAt = null;
    await plan.save();

    void notifyEdit("QHSE", "training · plan · reject", id);

    return NextResponse.json(
      { success: true, message: "Training plan rejected.", data: plan },
      { status: 200 }
    );
  } catch (error) {
    console.error("Training Plan reject error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reject" },
      { status: 500 }
    );
  }
}
