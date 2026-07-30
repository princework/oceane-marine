import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import DrillPlan from "@/lib/mongodb/models/qhse-drill/DrillPlan";
import DrillReport from "@/lib/mongodb/models/qhse-drill/DrillReport";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { parseDrillPlanFormData } from "@/lib/qhse/drillPlanForm";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";
import { sendDrillPlanApprovalRequestNotification } from "@/lib/services/email/drillPlanApprovalNotification";

export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const plan = await DrillPlan.findById(id);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Drill plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error("Get Drill Plan Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const plan = await DrillPlan.findById(id);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Drill plan not found" },
        { status: 404 }
      );
    }
    const planYear = plan.year;

    // Delete all quarter reports for this plan's year
    const deleteReportsResult = await DrillReport.deleteMany({ year: planYear });

    await DrillPlan.findByIdAndDelete(id);

    void notifyDelete("QHSE", "drill · plan", id);
    return NextResponse.json(
      {
        success: true,
        message: "Drill plan deleted",
        reportsDeleted: deleteReportsResult.deletedCount ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete Drill Plan Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  const guard = await assertQhsePermission("canEdit");
  if (!guard.ok) return guard.response;

  try {
    await connectDB();
    const { id } = await params;
    const plan = await DrillPlan.findById(id);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Drill plan not found" },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const { planItems, quarterFiles } = await parseDrillPlanFormData(formData);

    plan.planItems = planItems.map((item) => ({ ...item, status: "Pending Approval" }));
    plan.status = "Pending Approval";
    plan.rejectionReason = "";
    plan.approvedBy = null;
    plan.approvedAt = null;
    plan.rejectedBy = null;
    plan.rejectedAt = null;
    plan.submittedBy = guard.user._id;

    if (Object.keys(quarterFiles).length > 0) {
      const merged = plan.quarterFiles
        ? typeof plan.quarterFiles.toObject === "function"
          ? plan.quarterFiles.toObject()
          : { ...plan.quarterFiles }
        : {};
      Object.assign(merged, quarterFiles);
      plan.quarterFiles = merged;
      plan.markModified("quarterFiles");
    }

    await plan.save();
    void notifyEdit("QHSE", "drill · plan · update", id);
    void sendDrillPlanApprovalRequestNotification(plan);

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error("Update Drill Plan Error:", error);
    const status = error.message?.includes("required") ? 400 : 500;
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    );
  }
}