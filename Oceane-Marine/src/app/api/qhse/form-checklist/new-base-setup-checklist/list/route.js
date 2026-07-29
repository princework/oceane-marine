import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import NewBaseSetupChecklist from "@/lib/mongodb/models/qhse-form-checklist/NewBaseSetupChecklist";

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
    
    // Filter by year if provided
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${yearNum + 1}-01-01T00:00:00.000Z`);
      query.date = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const list = await NewBaseSetupChecklist.find(query)
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // Get available years from all forms
    const allForms = await NewBaseSetupChecklist.find({ date: { $exists: true, $ne: null } })
      .select("date")
      .lean();

    const yearsSet = new Set();
    allForms.forEach((form) => {
      if (form.date) {
        const formYear = new Date(form.date).getFullYear();
        yearsSet.add(formYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return NextResponse.json({ 
      success: true, 
      data: list,
      years: years.length > 0 ? years : [new Date().getFullYear()],
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
