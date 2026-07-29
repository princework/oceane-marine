import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Compatibility from "@/lib/mongodb/models/operations/Compatibility";

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const locationId = searchParams.get("locationId");

    let query = {};
    if (year) {
      const y = Number(year);
      if (Number.isFinite(y)) query.year = y;
    }
    if (locationId) {
      query["location.locationId"] = locationId;
    }

    const data = await Compatibility.find(query)
      .sort({ year: -1, operationNumber: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
