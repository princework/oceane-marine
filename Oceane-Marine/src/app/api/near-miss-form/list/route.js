import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import NearMiss from "@/lib/mongodb/models/qhse-near-miss/NearMiss";

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    // Build query
    const query = {};
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    
    // Filter by year if provided (using timeOfIncident)
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${yearNum + 1}-01-01T00:00:00.000Z`);
      query.timeOfIncident = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const nearMisses = await NearMiss.find(query)
      .sort({ timeOfIncident: -1, createdAt: -1 })
      .lean();

    // Get available years from all near misses
    const allNearMisses = await NearMiss.find({ timeOfIncident: { $exists: true, $ne: null } })
      .select("timeOfIncident")
      .lean();

    const yearsSet = new Set();
    allNearMisses.forEach((nearMiss) => {
      if (nearMiss.timeOfIncident) {
        const nearMissYear = new Date(nearMiss.timeOfIncident).getFullYear();
        yearsSet.add(nearMissYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return NextResponse.json({ 
      nearMisses,
      years: years.length > 0 ? years : [new Date().getFullYear()],
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
