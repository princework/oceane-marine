import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence";

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    const matchStage = {};

    // Year filter (based on createdAt)
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        matchStage.createdAt = {
          $gte: new Date(Date.UTC(yearNum, 0, 1)),
          $lt: new Date(Date.UTC(yearNum + 1, 0, 1)),
        };
      }
    }

    // Month filter
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
        completed: {
          $sum: {
            $cond: [{ $eq: ["$status", "Approved"] }, 1, 0],
          },
        },
        pending: {
          $sum: {
            $cond: [{ $eq: ["$status", "Pending"] }, 1, 0],
          },
        },
        total: { $sum: 1 },
      },
    });

    const result = await SupplierDueDiligence.aggregate(pipeline);

    const stats = result[0] || {
      completed: 0,
      pending: 0,
      total: 0,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Due Diligence Stats Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

