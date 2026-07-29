import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import LocationOfficeCheck from "@/lib/mongodb/models/operations/operations-locations/LocationOfficeCheck";

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("location");
    const yearParam = searchParams.get("year");

    const query = {};
    if (locationId) query.locationId = locationId;
    if (yearParam) {
      const yearNum = Number.parseInt(yearParam, 10);
      if (!Number.isNaN(yearNum)) query.year = yearNum;
    }

    const list = await LocationOfficeCheck.find(query)
      .sort({ year: -1, lastUploaded: -1 })
      .lean();

    const allRecords = await LocationOfficeCheck.find({ year: { $exists: true } })
      .select("year")
      .lean();
    const years = Array.from(new Set(allRecords.map((r) => r.year))).sort((a, b) => b - a);

    return NextResponse.json({
      success: true,
      data: list,
      years: years.length > 0 ? years : [new Date().getFullYear()],
    });
  } catch (error) {
    console.error("Location office check list error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
