import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import InspectionChecklist from "@/lib/mongodb/models/operations-form-checklist/InspectionChecklist";
import mongoose from "mongoose";

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const locationId = searchParams.get("locationId");
    const formCode = searchParams.get("formNumber"); // formNumber from frontend is formCode in backend
    const boatName = searchParams.get("boatName");
    const filterYear = searchParams.get("filterYear"); // For form 013 year filter

    let query = {};
    
    // Date-based year filter (for general date filtering)
    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
      query.date = { $gte: startDate, $lte: endDate };
    }

    if (locationId) {
      // Convert string to ObjectId for proper query
      query["location.locationId"] = mongoose.Types.ObjectId.isValid(locationId) 
        ? new mongoose.Types.ObjectId(locationId) 
        : locationId;
    }

    if (formCode) {
      query.formCode = formCode;
    }

    // For form 013, filter by year and boatName
    if (formCode === "OPS-OFD-013") {
      if (filterYear) {
        query.year = parseInt(filterYear);
      }
      if (boatName) {
        query.boatName = boatName;
      }
    }

    const records = await InspectionChecklist.find(query)
      .sort({ uploadedAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: records,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

