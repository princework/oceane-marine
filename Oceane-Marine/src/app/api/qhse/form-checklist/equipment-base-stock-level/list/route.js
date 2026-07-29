import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsEquipmentBaseStockLevel from "@/lib/mongodb/models/qhse-form-checklist/StsEquipmentBaseStockLevel";
import { findWithMongoIdCursor } from "@/lib/qhse/mongoIdCursorPagination";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const useCursor = searchParams.get("paged") === "cursor";
    const year = searchParams.get("year");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    const allRecords = await StsEquipmentBaseStockLevel.find({})
      .select("serialNumber year")
      .lean();

    const yearsSet = new Set();
    allRecords.forEach((record) => {
      if (record.year != null && !Number.isNaN(Number(record.year))) {
        yearsSet.add(Number(record.year));
      }
      if (record.serialNumber && /^\d{4}-/.test(record.serialNumber)) {
        const recordYear = Number(record.serialNumber.split("-")[0]);
        if (!Number.isNaN(recordYear)) yearsSet.add(recordYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    if (useCursor) {
      const statusParam = searchParams.get("status");
      const excludeDraft = searchParams.get("excludeDraft") === "1";
      const search = searchParams.get("search");
      const cursor = searchParams.get("cursor");
      const limit = searchParams.get("limit");

      const parts = [];
      if (!includeArchived) {
        parts.push({ isArchived: { $ne: true } });
      }
      if (year) {
        const yearNum = Number.parseInt(year, 10);
        if (!Number.isNaN(yearNum)) {
          parts.push({
            $or: [
              { serialNumber: new RegExp(`^${yearNum}-`) },
              { year: yearNum },
            ],
          });
        }
      }
      if (excludeDraft) {
        parts.push({ status: { $ne: "DRAFT" } });
      }
      if (statusParam && statusParam !== "ALL") {
        parts.push({ status: statusParam });
      }
      if (search && search.trim()) {
        const rx = new RegExp(escapeRegex(search.trim()), "i");
        parts.push({
          $or: [
            { serialNumber: rx },
            { formCode: rx },
          ],
        });
      }

      const filter = parts.length === 0 ? {} : { $and: parts };

      const { items, hasNext } = await findWithMongoIdCursor(
        StsEquipmentBaseStockLevel,
        filter,
        { cursor, limit }
      );

      return NextResponse.json({
        success: true,
        data: items,
        hasNext,
        years: years.length > 0 ? years : [new Date().getFullYear()],
      });
    }

    const query = {};
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        query.$or = [
          { serialNumber: new RegExp(`^${yearNum}-`) },
          { year: yearNum },
        ];
      }
    }

    const records = await StsEquipmentBaseStockLevel.find(query)
      .sort({ revisionDate: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: records,
      years: years.length > 0 ? years : [new Date().getFullYear()],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
