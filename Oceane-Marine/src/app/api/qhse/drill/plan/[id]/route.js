import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import DrillPlan from "@/lib/mongodb/models/qhse-drill/DrillPlan";
import DrillReport from "@/lib/mongodb/models/qhse-drill/DrillReport";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

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

// Approve all plan items in a drill plan