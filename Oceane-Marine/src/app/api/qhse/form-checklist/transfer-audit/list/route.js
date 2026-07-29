import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsTransferAudit from "@/lib/mongodb/models/qhse-form-checklist/StsTransferAudit";


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
    
    // Filter by year if provided (using header.date)
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${yearNum + 1}-01-01T00:00:00.000Z`);
      query["header.date"] = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const forms = await StsTransferAudit.find(query)
      .sort({ "header.date": -1, createdAt: -1 })
      .lean();

    // Get available years from all forms
    const allForms = await StsTransferAudit.find({ "header.date": { $exists: true, $ne: null } })
      .select("header.date")
      .lean();

    const yearsSet = new Set();
    allForms.forEach((form) => {
      if (form.header?.date) {
        const formYear = new Date(form.header.date).getFullYear();
        yearsSet.add(formYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return NextResponse.json({ 
      success: true, 
      data: forms,
      years: years.length > 0 ? years : [new Date().getFullYear()],
    });
  } catch (error) {
    console.error("Transfer Audit list error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

