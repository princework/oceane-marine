import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import NearMissForms from "@/lib/mongodb/models/qhse-near-miss/NearMiss";

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    const matchStage = {};

    /* YEAR FILTER (UTC SAFE) */
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        matchStage.timeOfIncident = {
          $gte: new Date(Date.UTC(yearNum, 0, 1)),
          $lt: new Date(Date.UTC(yearNum + 1, 0, 1)),
        };
      }
    }

    /* MONTH FILTER (UTC SAFE) */
    if (month) {
      const monthNum = Number.parseInt(month, 10);
      if (!Number.isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        const filterYear = year
          ? Number.parseInt(year, 10)
          : new Date().getUTCFullYear();

        matchStage.timeOfIncident = {
          $gte: new Date(Date.UTC(filterYear, monthNum - 1, 1)),
          $lt: new Date(Date.UTC(filterYear, monthNum, 1)),
        };
      }
    }

    const pipeline = [];

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }
    const count = await NearMissForms.countDocuments();
    // console.log("TOTAL DOCUMENTS IN DB:", count);
    pipeline.push({
      $group: {
        _id: null,
        total: { $sum: 1 },
        underReview: {
          $sum: {
            $cond: [{ $eq: ["$status", "Under Review"] }, 1, 0],
          },
        },
        reviewed: {
          $sum: {
            $cond: [{ $eq: ["$status", "Reviewed"] }, 1, 0],
          },
        },
      },
    });

    const result = await NearMissForms.aggregate(pipeline);

    const stats = result[0] || {
      total: 0,
      underReview: 0,
      reviewed: 0,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Near-Miss Dashboard API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
