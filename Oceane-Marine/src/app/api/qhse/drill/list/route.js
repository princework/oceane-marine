import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import DrillPlan from "@/lib/mongodb/models/qhse-drill/DrillPlan";
import DrillReport from "@/lib/mongodb/models/qhse-drill/DrillReport";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const deriveQuarter = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const m = d.getMonth();
  return QUARTERS[Math.floor(m / 3)] || null;
};

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url || "", `http://localhost`);
    const yearParam = searchParams.get("year");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    const planQuery = { "planItems.status": "Approved" };
    const reportQuery = {};
    if (!includeArchived) {
      planQuery.isArchived = { $ne: true };
      reportQuery.isArchived = { $ne: true };
    }

    // Only include Approved plan items (per requirement) but keep the plan container
    const plans = await DrillPlan.find(planQuery)
      .sort({ year: -1 })
      .lean();

    // All reports (latest drillDate wins)
    const reports = await DrillReport.find(reportQuery).sort({ drillDate: -1 }).lean();

    // Build a year → quarter map seeded from plans
    const yearMap = new Map();
    plans.forEach((plan) => {
      yearMap.set(plan.year, {
        year: plan.year,
        planId: plan._id,
        formCode: plan.formCode,
        serialNumber: plan.serialNumber,
        quarters: QUARTERS.map((q) => ({
          quarter: q,
          planItem: plan.planItems?.find((p) => p.quarter === q) || null,
          report: null,
          quarterFile: plan.quarterFiles?.[q]
            ? {
                fileName: plan.quarterFiles[q].fileName,
                hasFile: Boolean(plan.quarterFiles[q].filePath),
              }
            : null,
        })),
      });
    });

    // Merge reports; include years that have reports even if no plan
    reports.forEach((r) => {
      const normalizedYear =
        r.year || (r.drillDate ? new Date(r.drillDate).getFullYear() : null);
      const normalizedQuarter =
        r.quarter || (r.drillDate ? deriveQuarter(r.drillDate) : null);
      if (!normalizedYear || !normalizedQuarter) return;

      if (!yearMap.has(normalizedYear)) {
        yearMap.set(normalizedYear, {
          year: normalizedYear,
          planId: null,
          formCode: null,
          serialNumber: null,
          quarters: QUARTERS.map((q) => ({
            quarter: q,
            planItem: null,
            report: null,
            quarterFile: null,
          })),
        });
      }
      const entry = yearMap.get(normalizedYear);
      const idx = QUARTERS.indexOf(normalizedQuarter);
      if (idx >= 0) {
        const existing = entry.quarters[idx].report;
        // keep the latest by drillDate
        if (
          !existing ||
          (r.drillDate &&
            existing?.drillDate &&
            new Date(r.drillDate) > new Date(existing.drillDate))
        ) {
          entry.quarters[idx].report = {
            ...r,
            id: r._id?.toString?.() || r._id,
            year: normalizedYear,
            quarter: normalizedQuarter,
          };
        }
      }
    });

    // Sort years desc
    let data = Array.from(yearMap.values()).sort((a, b) => b.year - a.year);

    // Filter by year when a specific year is requested (not "all" or empty)
    if (yearParam && yearParam !== "all") {
      const yr = Number.parseInt(yearParam, 10);
      if (!Number.isNaN(yr)) {
        data = data.filter((row) => row.year === yr);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Drill list error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

