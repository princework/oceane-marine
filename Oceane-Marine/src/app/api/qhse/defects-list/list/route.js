import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";

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
    
    // Filter by year if provided (using targetDate)
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${yearNum + 1}-01-01T00:00:00.000Z`);
      query.targetDate = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const equipmentDefects = await EquipmentDefect.find(query)
      .sort({ targetDate: -1, createdAt: -1 })
      .lean();

    // Ensure attachments array is always present for the UI
    const list = equipmentDefects.map((d) => ({
      ...d,
      attachments: Array.isArray(d.attachments) ? d.attachments : [],
    }));

    // Get available years from all defects
    const allDefects = await EquipmentDefect.find({ targetDate: { $exists: true, $ne: null } })
      .select("targetDate")
      .lean();

    const yearsSet = new Set();
    allDefects.forEach((defect) => {
      if (defect.targetDate) {
        const defectYear = new Date(defect.targetDate).getFullYear();
        yearsSet.add(defectYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return NextResponse.json({ 
      equipmentDefects: list,
      years: years.length > 0 ? years : [new Date().getFullYear()],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
