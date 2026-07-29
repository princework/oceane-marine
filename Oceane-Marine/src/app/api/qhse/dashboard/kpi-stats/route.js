import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import KpiUpload from "@/lib/mongodb/models/qhse-kpi/KpiUpload";

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    const matchStage = {};

    // Year filter
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        matchStage.year = yearNum;
      }
    }

    // Month filter (based on createdAt)
    if (month) {
      const monthNum = Number.parseInt(month, 10);
      if (!Number.isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        const filterYear = year
          ? Number.parseInt(year, 10)
          : new Date().getUTCFullYear();

        matchStage.createdAt = {
          $gte: new Date(Date.UTC(filterYear, monthNum - 1, 1)),
          $lt: new Date(Date.UTC(filterYear, monthNum, 1)),
        };
      }
    }

    const pipeline = [];

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push({
      $group: {
        _id: null,
        completed: { $sum: 1 },
      },
    });

    const result = await KpiUpload.aggregate(pipeline);

    const stats = result[0] || {
      completed: 0,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("KPI Stats Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

