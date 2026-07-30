import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import DrillPlan from "@/lib/mongodb/models/qhse-drill/DrillPlan";
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

    const plan = await DrillPlan.findById(id);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Drill plan not found" },
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
    plan.planItems = (plan.planItems || []).map((item) => {
      item.status = "Rejected";
      return item;
    });
    await plan.save();

    void notifyEdit("QHSE", "drill · plan · reject", id);

    return NextResponse.json(
      { success: true, message: "Drill plan rejected.", data: plan },
      { status: 200 }
    );
  } catch (error) {
    console.error("Drill Plan reject error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reject" },
      { status: 500 }
    );
  }
}
