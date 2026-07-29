import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklistOne from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-001";

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

    // Year filter - check multiple date fields for flexibility
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${yearNum + 1}-01-01T00:00:00.000Z`);
        
        // Use $or to check multiple date fields
        // This ensures forms show up even if one date field is missing
        query.$or = [
          { "vesselDetails.plannedTransferDateTime": { $gte: startDate, $lt: endDate } },
          { revisionDate: { $gte: startDate, $lt: endDate } },
          { createdAt: { $gte: startDate, $lt: endDate } },
        ];
      }
    }
    // If no year is provided, show all forms

    if (status) {
      query.status = status;
    }

    let checklists = await STSChecklistOne.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    console.log(`📋 Found ${checklists.length} checklists for year ${year || 'all'}`);

    // Backfill root-level revisionNo for docs created before revision was added
    const byCreatedAsc = [...checklists].reverse();
    checklists = checklists.map((doc) => {
      const hasRevision = doc.revisionNo != null && String(doc.revisionNo).trim() !== "";
      if (hasRevision) return doc;
      const index = byCreatedAsc.findIndex((d) => String(d._id) === String(doc._id));
      return { ...doc, revisionNo: index >= 0 ? `${index + 1}.0` : "1.0" };
    });

    // Get available years from all date fields
    const allChecklists = await STSChecklistOne.find({})
      .select("vesselDetails.plannedTransferDateTime revisionDate createdAt")
      .lean();

    const yearsSet = new Set();
    allChecklists.forEach((checklist) => {
      // Check plannedTransferDateTime first
      if (checklist.vesselDetails?.plannedTransferDateTime) {
        const checklistYear = new Date(
          checklist.vesselDetails.plannedTransferDateTime
        ).getFullYear();
        yearsSet.add(checklistYear);
      }
      // Fallback to revisionDate
      else if (checklist.revisionDate) {
        const checklistYear = new Date(checklist.revisionDate).getFullYear();
        yearsSet.add(checklistYear);
      }
      // Fallback to createdAt
      else if (checklist.createdAt) {
        const checklistYear = new Date(checklist.createdAt).getFullYear();
        yearsSet.add(checklistYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);
    
    // Always include current year if no years found
    if (years.length === 0) {
      years.push(new Date().getFullYear());
    }

    console.log(`📅 Available years: ${years.join(', ')}`);

    return NextResponse.json(
      {
        success: true,
        data: checklists,
        years: years,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-001 list error:", error);
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
