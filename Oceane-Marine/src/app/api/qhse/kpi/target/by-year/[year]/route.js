import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TargetKpi from "@/lib/mongodb/models/qhse-kpi/TargetKpi";

/**
 * GET /api/qhse/kpi/target/by-year/[year]
 *
 * Returns the single live "tracker" Target KPI document for the requested
 * year so the form can pre-populate every previously-saved row. If multiple
 * legacy records exist for the same year (created back when each save spawned
 * a new doc), the most recently updated non-archived one wins.
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

    const doc = await TargetKpi.findOne({
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
    console.error("Target KPI – by-year fetch error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
