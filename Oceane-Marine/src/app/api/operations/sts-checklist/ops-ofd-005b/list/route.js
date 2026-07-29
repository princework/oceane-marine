import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist6AB from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005B";

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
        // Check multiple date fields for flexibility
        query.$or = [
          { "documentInfo.revisionDate": { $gte: startDate, $lt: endDate } },
          { "transferInfo.transferDate": { $gte: startDate, $lt: endDate } },
          { createdAt: { $gte: startDate, $lt: endDate } },
        ];
      }
    }

    if (status) {
      query.status = status;
    }

    const checklists = await STSChecklist6AB.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Get available years from all date fields
    const allChecklists = await STSChecklist6AB.find({})
      .select("documentInfo.revisionDate transferInfo.transferDate createdAt")
      .lean();

    const yearsSet = new Set();
    allChecklists.forEach((checklist) => {
      // Check revisionDate first
      if (checklist.documentInfo?.revisionDate) {
        const checklistYear = new Date(checklist.documentInfo.revisionDate).getFullYear();
        yearsSet.add(checklistYear);
      }
      // Fallback to transferDate
      else if (checklist.transferInfo?.transferDate) {
        const checklistYear = new Date(checklist.transferInfo.transferDate).getFullYear();
        yearsSet.add(checklistYear);
      }
      // Fallback to createdAt
      else if (checklist.createdAt) {
        const checklistYear = new Date(checklist.createdAt).getFullYear();
        yearsSet.add(checklistYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return NextResponse.json(
      {
        success: true,
        data: checklists,
        years: years.length > 0 ? years : [new Date().getFullYear()],
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-005B list error:", error);
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
