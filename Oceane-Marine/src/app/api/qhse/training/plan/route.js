import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TrainingPlan from "@/lib/mongodb/models/qhse-training/TrainingPlan";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";
import { parseTrainingPlanFormData } from "@/lib/qhse/trainingPlanForm";

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";
    const archivedFilter = includeArchived ? {} : { isArchived: { $ne: true } };

    if (year) {
      const plan = await TrainingPlan.findOne({
        ...archivedFilter,
        year: Number.parseInt(year, 10),
        status: "Approved",
      }).sort({ createdAt: -1 });

      return NextResponse.json({
        success: true,
        data: plan || null,
        message: plan
          ? "Approved training plan found"
          : "No approved training plan for this year",
      });
    }

    const plans = await TrainingPlan.find({
      ...archivedFilter,
      status: "Approved",
    }).select("year");

    const years = [...new Set(plans.map((p) => p.year))].sort((a, b) => b - a);

    return NextResponse.json({ success: true, data: years });
  } catch (error) {
    console.error("Get Training Plan Error:", error);
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
    const { planItems, monthPairFiles } = await parseTrainingPlanFormData(formData);

    const planData = {
      planItems,
      status: "Approved",
    };

    if (Object.keys(monthPairFiles).length > 0) {
      planData.monthPairFiles = monthPairFiles;
    }

    const newPlan = await TrainingPlan.create(planData);

    return NextResponse.json({ success: true, data: newPlan }, { status: 201 });
  } catch (error) {
    console.error("Training Plan Creation Error:", error);
    const status = error.message?.includes("required") ? 400 : 500;
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    );
  }
}
