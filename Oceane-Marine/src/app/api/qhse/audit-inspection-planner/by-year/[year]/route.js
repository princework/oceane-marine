import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import AuditInspectionPlanner from "@/lib/mongodb/models/qhse-audit-inspection/AuditInspectionPlanner";

/**
 * GET /api/qhse/audit-inspection-planner/by-year/[year]
 *
 * Returns the single "tracker" planner for that year so the planner form can
 * load every previously-saved row and append to it. If multiple legacy
 * planners exist for the year (created back when each save produced its own
 * record), the most recently updated one wins.
 *
 * Response:
 *   { success: true, data: <doc | null>, year: <number> }
 */
export async function GET(req, { params }) {
  try {
    await connectDB();
    const { year } = await params;

    const yearNum = Number.parseInt(year, 10);
    if (Number.isNaN(yearNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid year." },
        { status: 400 }
      );
    }

    // Skip archived planners — those are intentionally hidden from active use.
    const doc = await AuditInspectionPlanner.findOne({
      year: yearNum,
      isArchived: { $ne: true },
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: doc || null,
      year: yearNum,
    });
  } catch (error) {
    console.error("Audit & Inspection Planner – by-year fetch error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
