import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import NearMissForms from "@/lib/mongodb/models/qhse-near-miss/NearMiss";

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");

    const matchStage = {};

    // Year filter
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        matchStage.timeOfIncident = {
          $gte: new Date(Date.UTC(yearNum, 0, 1)),
          $lt: new Date(Date.UTC(yearNum + 1, 0, 1)),
        };
      }
    }

    const pipeline = [];

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Group by quarter
    pipeline.push({
      $addFields: {
        quarter: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    { $gte: [{ $month: "$timeOfIncident" }, 1] },
                    { $lte: [{ $month: "$timeOfIncident" }, 3] },
                  ],
                },
                then: "Q1",
              },
              {
                case: {
                  $and: [
                    { $gte: [{ $month: "$timeOfIncident" }, 4] },
                    { $lte: [{ $month: "$timeOfIncident" }, 6] },
                  ],
                },
                then: "Q2",
              },
              {
                case: {
                  $and: [
                    { $gte: [{ $month: "$timeOfIncident" }, 7] },
                    { $lte: [{ $month: "$timeOfIncident" }, 9] },
                  ],
                },
                then: "Q3",
              },
              {
                case: {
                  $and: [
                    { $gte: [{ $month: "$timeOfIncident" }, 10] },
                    { $lte: [{ $month: "$timeOfIncident" }, 12] },
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

    const result = await NearMissForms.aggregate(pipeline);

    // Format result to ensure all quarters are present
    const quarterlyData = {
      Q1: 0,
      Q2: 0,
      Q3: 0,
      Q4: 0,
    };

    result.forEach((item) => {
      if (quarterlyData.hasOwnProperty(item._id)) {
        quarterlyData[item._id] = item.count;
      }
    });

    return NextResponse.json({
      success: true,
      data: quarterlyData,
    });
  } catch (error) {
    console.error("Near Miss Quarterly Stats Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

