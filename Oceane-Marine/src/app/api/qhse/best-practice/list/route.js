import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import BestPractice from "@/lib/mongodb/models/qhse-best-practices/BestPractice";

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
    
    // Filter by year if provided (using eventDate)
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${yearNum + 1}-01-01T00:00:00.000Z`);
      query.eventDate = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const bestPractices = await BestPractice.find(query)
      .sort({ eventDate: -1, createdAt: -1 })
      .lean();

    // Get available years from all best practices
    const allPractices = await BestPractice.find({ eventDate: { $exists: true, $ne: null } })
      .select("eventDate")
      .lean();

    const yearsSet = new Set();
    allPractices.forEach((practice) => {
      if (practice.eventDate) {
        const practiceYear = new Date(practice.eventDate).getFullYear();
        yearsSet.add(practiceYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return NextResponse.json({ 
      bestPractices,
      years: years.length > 0 ? years : [new Date().getFullYear()],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}