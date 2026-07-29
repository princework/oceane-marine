import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSHourlyQuantityLog from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-015";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const status = searchParams.get("status");

    const query = {};

    if (year) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${yearNum + 1}-01-01T00:00:00.000Z`);
        query["transferInfo.transferStartDate"] = {
          $gte: startDate,
          $lt: endDate,
        };
      }
    }

    if (status) {
      query.status = status;
    }

    let logs = await STSHourlyQuantityLog.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Backfill documentInfo.revisionNo for docs created before revision was added (oldest = 1.0, next = 2.0, ...)
    const byCreatedAsc = [...logs].reverse();
    const withRevisions = logs.map((log) => {
      const hasRevision = log.documentInfo?.revisionNo != null && String(log.documentInfo.revisionNo).trim() !== "";
      if (hasRevision) return log;
      const index = byCreatedAsc.findIndex((l) => String(l._id) === String(log._id));
      const revisionNo = index >= 0 ? `${index + 1}.0` : "1.0";
      return {
        ...log,
        documentInfo: {
          ...(log.documentInfo || {}),
          formNo: log.documentInfo?.formNo || "OPS-OFD-015",
          revisionNo,
          issueDate: log.documentInfo?.issueDate,
          approvedBy: log.documentInfo?.approvedBy,
        },
      };
    });

    logs = withRevisions;

    // Get available years
    const allLogs = await STSHourlyQuantityLog.find({
      "transferInfo.transferStartDate": { $exists: true, $ne: null },
    })
      .select("transferInfo.transferStartDate")
      .lean();

    const yearsSet = new Set();
    allLogs.forEach((log) => {
      if (log.transferInfo?.transferStartDate) {
        const logYear = new Date(log.transferInfo.transferStartDate).getFullYear();
        yearsSet.add(logYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return NextResponse.json(
      {
        success: true,
        data: logs,
        years: years.length > 0 ? years : [new Date().getFullYear()],
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-015 list error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
