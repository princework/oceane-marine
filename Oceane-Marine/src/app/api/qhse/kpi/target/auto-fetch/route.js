import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterFeedbackForm from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-020";
import NearMiss from "@/lib/mongodb/models/qhse-near-miss/NearMiss";
import DrillReport from "@/lib/mongodb/models/qhse-drill/DrillReport";
import BestPractice from "@/lib/mongodb/models/qhse-best-practices/BestPractice";

/**
 * GET /api/qhse/kpi/target/auto-fetch?year=2026
 *
 * Fetches all KPI data for the given year and returns quarterly breakdowns
 * for all Target KPI fields. This is used to auto-populate the Target KPI form.
 *
 * Returns:
 * {
 *   "Mooring Master Feedback": { quarter1: 4.2, quarter2: 4.5, quarter3: 4.3, quarter4: 4.4 },
 *   "Spills to water": { quarter1: 0, quarter2: 1, quarter3: 0, quarter4: 0 },
 *   "Near Miss reporting": { quarter1: 5, quarter2: 8, quarter3: 6, quarter4: 7 },
 *   ...
 * }
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

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    // Helper to get quarter from date
    const getQuarter = (date) => {
      const month = date.getMonth(); // 0-11
      if (month < 3) return "Q1";
      if (month < 6) return "Q2";
      if (month < 9) return "Q3";
      return "Q4";
    };

    // Helper to initialize quarterly object
    const initQuarterly = () => ({ Q1: 0, Q2: 0, Q3: 0, Q4: 0 });

    // Initialize result object with all KPI fields
    const result = {
      "Mooring Master Feedback": initQuarterly(),
      "Spills to water": initQuarterly(),
      "Critical Incidents": initQuarterly(),
      "Non-Critical Incidents": initQuarterly(),
      "Near Miss reporting": initQuarterly(),
      "Stop Work Authority": initQuarterly(),
      "Injuries to personnel - Minor": initQuarterly(),
      "Injuries to personnel - Severe": initQuarterly(),
      "QHSE Meetings": initQuarterly(),
      "Emergency Drills": initQuarterly(),
      "Safety Bulletins": initQuarterly(),
      "Health Bulletin": initQuarterly(),
      "Best Practices": initQuarterly(),
    };

    // ── 1. Mooring Master Feedback (OPS-OFD-020) ──
    try {
      const feedbackForms = await MasterFeedbackForm.find({
        $or: [
          {
            "jobDetails.dateOfOperation": {
              $gte: yearStart,
              $lt: yearEnd,
            },
          },
          {
            "jobDetails.dateOfOperation": null,
            createdAt: {
              $gte: yearStart,
              $lt: yearEnd,
            },
          },
        ],
      })
        .select("performanceItems jobDetails.dateOfOperation createdAt")
        .lean();

      const quarterlyAvgs = { Q1: [], Q2: [], Q3: [], Q4: [] };

      feedbackForms.forEach((form) => {
        const formDate = form.jobDetails?.dateOfOperation
          ? new Date(form.jobDetails.dateOfOperation)
          : form.createdAt
          ? new Date(form.createdAt)
          : null;

        if (!formDate) return;

        const quarter = getQuarter(formDate);
        const items = form.performanceItems || [];
        const scoredItems = items.filter(
          (item) => item.score && item.score !== "" && !isNaN(Number(item.score))
        );

        if (scoredItems.length > 0) {
          const avg =
            scoredItems.reduce((sum, item) => sum + Number(item.score), 0) /
            scoredItems.length;
          quarterlyAvgs[quarter].push(avg);
        }
      });

      // Calculate average for each quarter
      Object.keys(quarterlyAvgs).forEach((q) => {
        const avgs = quarterlyAvgs[q];
        if (avgs.length > 0) {
          result["Mooring Master Feedback"][q] =
            Math.round(
              (avgs.reduce((sum, v) => sum + v, 0) / avgs.length) * 100
            ) / 100;
        }
      });
    } catch (err) {
      console.error("Error fetching Mooring Master Feedback:", err);
    }

    // ── 2. Near Miss, Spills, Incidents, Injuries (from NearMiss model) ──
    try {
      const nearMisses = await NearMiss.find({
        timeOfIncident: {
          $gte: yearStart,
          $lt: yearEnd,
        },
      })
        .select("timeOfIncident TypeOfReporting")
        .lean();

      nearMisses.forEach((nm) => {
        const quarter = getQuarter(new Date(nm.timeOfIncident));
        const type = nm.TypeOfReporting;

        switch (type) {
          case "Near Miss":
            result["Near Miss reporting"][quarter]++;
            break;
          case "Pollution":
            result["Spills to water"][quarter]++;
            break;
          case "Injury":
            // Note: NearMiss model doesn't have severity field, so we count all as Minor
            // If severity tracking is added later, update this logic
            result["Injuries to personnel - Minor"][quarter]++;
            break;
          case "Collision":
          case "Fatality":
            result["Critical Incidents"][quarter]++;
            break;
          case "Contact Damage":
            result["Non-Critical Incidents"][quarter]++;
            break;
          default:
            // Other types can be categorized as needed
            break;
        }
      });
    } catch (err) {
      console.error("Error fetching Near Miss data:", err);
    }

    // ── 3. Emergency Drills (from DrillReport) ──
    try {
      const drillReports = await DrillReport.find({
        drillDate: {
          $gte: yearStart,
          $lt: yearEnd,
        },
        status: "Completed", // Only count completed drills
      })
        .select("drillDate quarter")
        .lean();

      drillReports.forEach((drill) => {
        // Use quarter field if available, otherwise calculate from drillDate
        const quarter =
          drill.quarter || getQuarter(new Date(drill.drillDate));
        if (quarter && result["Emergency Drills"][quarter] !== undefined) {
          result["Emergency Drills"][quarter]++;
        }
      });
    } catch (err) {
      console.error("Error fetching Emergency Drills:", err);
    }

    // ── 4. Best Practices ──
    try {
      const bestPractices = await BestPractice.find({
        eventDate: {
          $gte: yearStart,
          $lt: yearEnd,
        },
      })
        .select("eventDate")
        .lean();

      bestPractices.forEach((bp) => {
        const quarter = getQuarter(new Date(bp.eventDate));
        result["Best Practices"][quarter]++;
      });
    } catch (err) {
      console.error("Error fetching Best Practices:", err);
    }

    // ── 5. QHSE Meetings, Safety Bulletins, Health Bulletin, Stop Work Authority ──
    // These don't have dedicated models yet, so they remain at 0
    // TODO: Add data sources when these forms/models are created

    return NextResponse.json({
      success: true,
      data: result,
      year,
    });
  } catch (error) {
    console.error("Auto-fetch KPI data error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch KPI data" },
      { status: 500 }
    );
  }
}
