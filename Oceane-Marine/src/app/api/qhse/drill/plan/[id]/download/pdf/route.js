import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import DrillPlan from "@/lib/mongodb/models/qhse-drill/DrillPlan";
import { generateDrillPlanPdf } from "@/jobs/services/pdf/DrillPlanPdfReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const plan = await DrillPlan.findById(id).lean();

    if (!plan) {
      return NextResponse.json(
        { error: "Drill plan not found" },
        { status: 404 }
      );
    }

    const buffer = await generateDrillPlanPdf(plan);
    const safeSerial = String(plan.serialNumber || plan._id.toString()).replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Drill-Plan-${plan.year ?? "plan"}-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Drill Plan PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
