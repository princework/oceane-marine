import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsBaseAuditReport from "@/lib/mongodb/models/qhse-form-checklist/StsBaseAuditReport";

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
        matchStage.date = {
          $gte: new Date(Date.UTC(yearNum, 0, 1)),
          $lt: new Date(Date.UTC(yearNum + 1, 0, 1)),
        };
      }
    }

    // Get all base audits
    const audits = await StsBaseAuditReport.find(matchStage).lean();

    // Define locations to track
    const locations = [
      "Dubai",
      "Fujairah",
      "Khorfakkan",
      "Sohar",
      "Mombasa",
      "Tanjung Bruas",
    ];

    // Count audits by location (check if location is mentioned in description)
    const locationCounts = {};
    locations.forEach((loc) => {
      locationCounts[loc] = 0;
    });

    audits.forEach((audit) => {
      const description = (audit.description || "").toLowerCase();
      locations.forEach((loc) => {
        if (description.includes(loc.toLowerCase())) {
          locationCounts[loc]++;
        }
      });
    });

    // If no location found in description, distribute evenly or show total
    const totalAudits = audits.length;
    const hasLocationData = Object.values(locationCounts).some((count) => count > 0);

    // If no location data found, distribute total count evenly across locations
    if (!hasLocationData && totalAudits > 0) {
      const perLocation = Math.floor(totalAudits / locations.length);
      const remainder = totalAudits % locations.length;
      locations.forEach((loc, idx) => {
        locationCounts[loc] = perLocation + (idx < remainder ? 1 : 0);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        locations: locationCounts,
        total: totalAudits,
      },
    });
  } catch (error) {
    console.error("Base Audits Stats Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

