import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import DrillPlan from "@/lib/mongodb/models/qhse-drill/DrillPlan";
import { assertQhsePermission, requireQhseSession } from "@/lib/auth/qhseGuard";
import { parseDrillPlanFormData } from "@/lib/qhse/drillPlanForm";
import { sendDrillPlanApprovalRequestNotification } from "@/lib/services/email/drillPlanApprovalNotification";

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const mine = searchParams.get("mine");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";
    const archivedFilter = includeArchived ? {} : { isArchived: { $ne: true } };

    if (year && (mine === "1" || mine === "true")) {
      const session = await requireQhseSession();
      if (!session.ok) return session.response;

      const plan = await DrillPlan.findOne({
        ...archivedFilter,
        year: Number.parseInt(year, 10),
        submittedBy: session.user._id,
      }).sort({ createdAt: -1 });

      return NextResponse.json({
        success: true,
        data: plan || null,
        message: plan ? "Drill plan found" : "No drill plan for this year",
      });
    }

    if (year) {
      const plan = await DrillPlan.findOne({
        ...archivedFilter,
        year: Number.parseInt(year, 10),
        status: "Approved",
      }).sort({ createdAt: -1 });

      if (!plan) {
        return NextResponse.json(
          { success: false, error: "No approved drill plan found for this year" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: plan });
    }

    const plans = await DrillPlan.find({
      ...archivedFilter,
      status: "Approved",
    }).select("year");
    const years = [...new Set(plans.map((p) => p.year))].sort((a, b) => b - a);

    return NextResponse.json({ success: true, data: years });
  } catch (error) {
    console.error("Get Drill Plan Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const guard = await assertQhsePermission("canCreate");
  if (!guard.ok) return guard.response;

  try {
    await connectDB();
    const formData = await req.formData();
    const { planItems, year, quarterFiles } = await parseDrillPlanFormData(formData);

    const normalizedPlanItems = planItems.map((item) => ({
      ...item,
      status: "Pending Approval",
    }));

    const planData = {
      year,
      planItems: normalizedPlanItems,
      status: "Pending Approval",
      submittedBy: guard.user._id,
    };

    if (Object.keys(quarterFiles).length > 0) {
      planData.quarterFiles = quarterFiles;
    }

    const newPlan = await DrillPlan.create(planData);

    void sendDrillPlanApprovalRequestNotification(newPlan);

    return NextResponse.json(
      { success: true, data: newPlan },
      { status: 201 }
    );
  } catch (error) {
    console.error("Drill Plan Creation Error:", error);
    const status = error.message?.includes("required") ? 400 : 500;
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    );
  }
}
