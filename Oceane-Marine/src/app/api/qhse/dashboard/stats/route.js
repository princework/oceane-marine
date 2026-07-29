import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import KpiUpload from "@/lib/mongodb/models/qhse-kpi/KpiUpload";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence";
import NearMissForms from "@/lib/mongodb/models/qhse-near-miss/NearMiss";

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    // Build date filters
    const buildDateFilter = () => {
      const filter = {};
      if (year) {
        const yearNum = Number.parseInt(year, 10);
        if (!Number.isNaN(yearNum)) {
          if (month) {
            const monthNum = Number.parseInt(month, 10);
            if (!Number.isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
              filter.$gte = new Date(Date.UTC(yearNum, monthNum - 1, 1));
              filter.$lt = new Date(Date.UTC(yearNum, monthNum, 1));
            }
          } else {
            filter.$gte = new Date(Date.UTC(yearNum, 0, 1));
            filter.$lt = new Date(Date.UTC(yearNum + 1, 0, 1));
          }
        }
      }
      return Object.keys(filter).length > 0 ? filter : null;
    };

    const dateFilter = buildDateFilter();

    // 1. KPI Stats
    const kpiMatch = {};
    if (dateFilter) {
      kpiMatch.createdAt = dateFilter;
    }
    if (year) {
      kpiMatch.year = Number.parseInt(year, 10);
    }
    const kpiStats = await KpiUpload.aggregate([
      ...(Object.keys(kpiMatch).length > 0 ? [{ $match: kpiMatch }] : []),
      {
        $group: {
          _id: null,
          completed: { $sum: 1 },
        },
      },
    ]);

    // 2. Due Diligence Stats
    const ddMatch = {};
    if (dateFilter) {
      ddMatch.createdAt = dateFilter;
    }
    const ddStats = await SupplierDueDiligence.aggregate([
      ...(Object.keys(ddMatch).length > 0 ? [{ $match: ddMatch }] : []),
      {
        $group: {
          _id: null,
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
    ]);

    // 3. Near Miss Stats
    const nmMatch = {};
    if (dateFilter) {
      nmMatch.timeOfIncident = dateFilter;
    }
    const nmStats = await NearMissForms.aggregate([
      ...(Object.keys(nmMatch).length > 0 ? [{ $match: nmMatch }] : []),
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pendingReview: {
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
      },
    ]);

    return NextResponse.json({
      success: true,
      data: {
        kpi: kpiStats[0] || { completed: 0 },
        dueDiligence: ddStats[0] || { completed: 0, pending: 0, total: 0 },
        nearMiss: nmStats[0] || {
          total: 0,
          pendingReview: 0,
          reviewed: 0,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

