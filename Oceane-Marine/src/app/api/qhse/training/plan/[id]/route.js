import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TrainingPlan from "@/lib/mongodb/models/qhse-training/TrainingPlan";
import TrainingRecord from "@/lib/mongodb/models/qhse-training/TrainingRecord";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { parseTrainingPlanFormData } from "@/lib/qhse/trainingPlanForm";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";
import { sendTrainingPlanApprovalRequestNotification } from "@/lib/services/email/trainingPlanApprovalNotification";

export async function GET(req, { params } ) {
  try {
    await connectDB();

    const { id } = await params;
    const plan = await TrainingPlan.findById(id);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Training plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error("Get Training Plan Error:", error);
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
    const plan = await TrainingPlan.findById(id);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Training plan not found" },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const { planItems, monthPairFiles } = await parseTrainingPlanFormData(formData);

    plan.planItems = planItems;
    plan.status = "Pending Approval";
    plan.rejectionReason = "";
    plan.approvedBy = null;
    plan.approvedAt = null;
    plan.rejectedBy = null;
    plan.rejectedAt = null;
    plan.submittedBy = guard.user._id;

    if (Object.keys(monthPairFiles).length > 0) {
      const merged = plan.monthPairFiles
        ? typeof plan.monthPairFiles.toObject === "function"
          ? plan.monthPairFiles.toObject()
          : { ...plan.monthPairFiles }
        : {};
      Object.assign(merged, monthPairFiles);
      plan.monthPairFiles = merged;
      plan.markModified("monthPairFiles");
    }

    await plan.save();
    void notifyEdit("QHSE", "training · plan · update", id);
    void sendTrainingPlanApprovalRequestNotification(plan);

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error("Update Training Plan Error:", error);
    const status = error.message?.includes("required") ? 400 : 500;
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    );
  }
}

export async function DELETE(req, { params }) {
  const guard = await assertQhsePermission("canDelete");
  if (!guard.ok) return guard.response;

  try {
    await connectDB();
    const { id } = await params;
    const plan = await TrainingPlan.findById(id);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Training plan not found" },
        { status: 404 }
      );
    }
    // Delete all training records linked to this plan
    const deleteRecordsResult = await TrainingRecord.deleteMany({
      trainingPlanId: id,
    });
    await TrainingPlan.findByIdAndDelete(id);
    void notifyDelete("QHSE", "training · plan", id);
    return NextResponse.json(
      {
        success: true,
        message: "Training plan deleted",
        recordsDeleted: deleteRecordsResult.deletedCount ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete Training Plan Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

