import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import KpiUpload from "@/lib/mongodb/models/qhse-kpi/KpiUpload";

/**
 * GET /api/qhse/dashboard/kpi-quarterly?year=2026
 * Returns KPI uploads count by quarter for the given year (Mooring Masters Feedback chart).
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
        matchStage.createdAt = {
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
                    { $gte: [{ $month: "$createdAt" }, 1] },
                    { $lte: [{ $month: "$createdAt" }, 3] },
                  ],
                },
                then: "Q1",
              },
              {
                case: {
                  $and: [
                    { $gte: [{ $month: "$createdAt" }, 4] },
                    { $lte: [{ $month: "$createdAt" }, 6] },
                  ],
                },
                then: "Q2",
              },
              {
                case: {
                  $and: [
                    { $gte: [{ $month: "$createdAt" }, 7] },
                    { $lte: [{ $month: "$createdAt" }, 9] },
                  ],
                },
                then: "Q3",
              },
              {
                case: {
                  $and: [
                    { $gte: [{ $month: "$createdAt" }, 10] },
                    { $lte: [{ $month: "$createdAt" }, 12] },
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

    const result = await KpiUpload.aggregate(pipeline);

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

    return NextResponse.json({
      success: true,
      data: quarterlyData,
    });
  } catch (error) {
    console.error("KPI Quarterly Stats Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
