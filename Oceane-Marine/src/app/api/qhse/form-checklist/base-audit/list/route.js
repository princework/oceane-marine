import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/config/connection";
import StsBaseAuditReport from "@/lib/mongodb/models/qhse-form-checklist/StsBaseAuditReport";

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const locationId = searchParams.get("locationId");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    // Build query
    const query = {};
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    
    // Filter by year — match either the serialNumber prefix (e.g.
    // "2028-001" -> 2028) OR the report `date` falling within that calendar
    // year. The date fallback covers legacy/imported records that don't
    // carry a yearwise serial.
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${yearNum + 1}-01-01T00:00:00.000Z`);
        query.$or = [
          { serialNumber: new RegExp(`^${yearNum}-`) },
          { date: { $gte: startDate, $lt: endDate } },
        ];
      }
    }

    if (locationId && mongoose.Types.ObjectId.isValid(locationId)) {
      query["location.locationId"] = new mongoose.Types.ObjectId(locationId);
    }

    const list = await StsBaseAuditReport.find(query)
      .sort({ date: -1, uploadedAt: -1 })
      .lean();

    // Build the year list from both the serialNumber prefix and the report
    // date so that records imported without a yearwise serial still surface
    // their year in the dropdown.
    const allReports = await StsBaseAuditReport.find({})
      .select("serialNumber date")
      .lean();

    const yearsSet = new Set();
    allReports.forEach((report) => {
      if (report.serialNumber && /^\d{4}-/.test(report.serialNumber)) {
        const reportYear = Number(report.serialNumber.split("-")[0]);
        if (!Number.isNaN(reportYear)) yearsSet.add(reportYear);
      }
      if (report.date) {
        const dateYear = new Date(report.date).getFullYear();
        if (!Number.isNaN(dateYear)) yearsSet.add(dateYear);
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
