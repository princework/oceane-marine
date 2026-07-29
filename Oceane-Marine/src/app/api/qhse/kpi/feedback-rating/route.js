import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterFeedbackForm from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-020";

/**
 * GET /api/qhse/kpi/feedback-rating?year=2026
 *
 * Calculates combined quarterly average ratings from OPS-OFD-020 forms (CHS + MS).
 *
 * Quarter definitions:
 *   Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec
 *
 * For each form:
 *   formAvg = sum(performanceItems[].score) / count(scored items)
 *
 * For each quarter:
 *   quarterAvg = average of all formAvg values in that quarter
 *
 * Returns: { quarter1, quarter2, quarter3, quarter4, yearAvg, totalForms, details }
 */
export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    if (isNaN(year)) {
      return NextResponse.json(
        { success: false, error: "Invalid year parameter" },
        { status: 400 }
      );
    }

    // Quarter date ranges for the given year
    const quarters = [
      { key: "quarter1", label: "Q1 (Jan–Mar)", start: new Date(year, 0, 1),  end: new Date(year, 3, 1) },
      { key: "quarter2", label: "Q2 (Apr–Jun)", start: new Date(year, 3, 1),  end: new Date(year, 6, 1) },
      { key: "quarter3", label: "Q3 (Jul–Sep)", start: new Date(year, 6, 1),  end: new Date(year, 9, 1) },
      { key: "quarter4", label: "Q4 (Oct–Dec)", start: new Date(year, 9, 1),  end: new Date(year + 1, 0, 1) },
    ];

    // Fetch all OPS-OFD-020 forms for the year (using dateOfOperation OR createdAt as fallback)
    const allForms = await MasterFeedbackForm.find({
      $or: [
        {
          "jobDetails.dateOfOperation": {
            $gte: new Date(year, 0, 1),
            $lt: new Date(year + 1, 0, 1),
          },
        },
        {
          "jobDetails.dateOfOperation": null,
          createdAt: {
            $gte: new Date(year, 0, 1),
            $lt: new Date(year + 1, 0, 1),
          },
        },
      ],
    })
      .select("performanceItems jobDetails.dateOfOperation jobDetails.vesselName operationRef createdAt")
      .lean();

    /**
     * Calculate average score for a single form
     * Returns null if no scored items
     */
    function calcFormAvg(form) {
      const items = form.performanceItems || [];
      const scoredItems = items.filter(
        (item) => item.score && item.score !== "" && !isNaN(Number(item.score))
      );
      if (scoredItems.length === 0) return null;
      const sum = scoredItems.reduce((acc, item) => acc + Number(item.score), 0);
      return sum / scoredItems.length;
    }

    /**
     * Determine which quarter a form belongs to
     */
    function getFormDate(form) {
      if (form.jobDetails?.dateOfOperation) {
        return new Date(form.jobDetails.dateOfOperation);
      }
      return form.createdAt ? new Date(form.createdAt) : null;
    }

    // Build per-quarter results
    const result = {};
    let allFormAvgs = [];
    let totalFormCount = 0;
    const details = {};

    for (const q of quarters) {
      const formsInQuarter = allForms.filter((f) => {
        const d = getFormDate(f);
        return d && d >= q.start && d < q.end;
      });

      const formAvgs = formsInQuarter
        .map((f) => ({
          avg: calcFormAvg(f),
          operationRef: f.operationRef,
          vesselName: f.jobDetails?.vesselName || "—",
          jobRef: f.operationRef || "—",
        }))
        .filter((x) => x.avg !== null);

      const quarterAvg =
        formAvgs.length > 0
          ? formAvgs.reduce((sum, x) => sum + x.avg, 0) / formAvgs.length
          : 0;

      result[q.key] = Math.round(quarterAvg * 100) / 100; // Round to 2 decimals
      totalFormCount += formAvgs.length;
      allFormAvgs = allFormAvgs.concat(formAvgs.map((x) => x.avg));

      details[q.key] = {
        label: q.label,
        formCount: formsInQuarter.length,
        scoredFormCount: formAvgs.length,
        avg: result[q.key],
        forms: formAvgs.map((x) => ({
          operationRef: x.operationRef,
          vesselName: x.vesselName,
          jobRef: x.jobRef,
          avgScore: Math.round(x.avg * 100) / 100,
        })),
      };
    }

    // Year-wide average
    const yearAvg =
      allFormAvgs.length > 0
        ? Math.round(
            (allFormAvgs.reduce((s, v) => s + v, 0) / allFormAvgs.length) * 100
          ) / 100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        year,
        quarter1: result.quarter1,
        quarter2: result.quarter2,
        quarter3: result.quarter3,
        quarter4: result.quarter4,
        yearAvg,
        totalForms: totalFormCount,
        details,
      },
    });
  } catch (error) {
    console.error("Feedback rating API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to calculate ratings" },
      { status: 500 }
    );
  }
}
