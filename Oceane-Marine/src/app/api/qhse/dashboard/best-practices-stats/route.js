import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import BestPractice from "@/lib/mongodb/models/qhse-best-practices/BestPractice";

/**
 * GET /api/qhse/dashboard/best-practices-stats?year=2026
 * Returns Best Practices count by quarter (eventDate) for the given year.
 * Frontend uses this for the Best Practices donut chart (Q1–Q4 segments).
 */
export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");

    const matchStage = {};

    if (year) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        matchStage.eventDate = {
          $gte: new Date(Date.UTC(yearNum, 0, 1)),
          $lt: new Date(Date.UTC(yearNum + 1, 0, 1)),
        };
      }
    }

    const pipeline = [];

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push({
      $addFields: {
        quarter: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    { $gte: [{ $month: "$eventDate" }, 1] },
                    { $lte: [{ $month: "$eventDate" }, 3] },
                  ],
                },
                then: "Q1",
              },
              {
                case: {
                  $and: [
                    { $gte: [{ $month: "$eventDate" }, 4] },
                    { $lte: [{ $month: "$eventDate" }, 6] },
                  ],
                },
                then: "Q2",
              },
              {
                case: {
                  $and: [
                    { $gte: [{ $month: "$eventDate" }, 7] },
                    { $lte: [{ $month: "$eventDate" }, 9] },
                  ],
                },
                then: "Q3",
              },
              {
                case: {
                  $and: [
                    { $gte: [{ $month: "$eventDate" }, 10] },
                    { $lte: [{ $month: "$eventDate" }, 12] },
                  ],
                },
                then: "Q4",
              },
            ],
            default: "Unknown",
          },
        },
      },
    });

    pipeline.push({
      $group: {
        _id: "$quarter",
        count: { $sum: 1 },
      },
    });

    const result = await BestPractice.aggregate(pipeline);

    const quarterlyData = {
      Q1: 0,
      Q2: 0,
      Q3: 0,
      Q4: 0,
    };

    result.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(quarterlyData, item._id)) {
        quarterlyData[item._id] = item.count;
      }
    });

    const total = Object.values(quarterlyData).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      data: {
        byQuarter: quarterlyData,
        total,
      },
    });
  } catch (error) {
    console.error("Best Practices Stats Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
