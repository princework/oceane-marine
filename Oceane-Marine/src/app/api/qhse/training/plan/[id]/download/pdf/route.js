import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TrainingPlan from "@/lib/mongodb/models/qhse-training/TrainingPlan";
import { generateTrainingPlanPdf } from "@/jobs/services/pdf/TrainingPlanPdfReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const plan = await TrainingPlan.findById(id).lean();

    if (!plan) {
      return NextResponse.json(
        { error: "Training plan not found" },
        { status: 404 }
      );
    }

    const buffer = await generateTrainingPlanPdf(plan);
    const safeSerial = String(plan.serialNumber || plan._id.toString()).replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Training-Matrix-${plan.year ?? "plan"}-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Training Plan (Matrix) PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
