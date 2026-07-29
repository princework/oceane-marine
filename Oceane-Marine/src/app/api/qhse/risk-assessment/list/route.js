import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import RiskAssessment from "@/lib/mongodb/models/qhse-risk-assessment/RiskAssessment";
import { findWithMongoIdCursor } from "@/lib/qhse/mongoIdCursorPagination";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const useCursor = searchParams.get("paged") === "cursor";

    const location = searchParams.get("location");
    const yearParam = searchParams.get("year");
    const search = searchParams.get("search");
    const cursor = searchParams.get("cursor");
    const limit = searchParams.get("limit");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    const query = {};
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    if (location && location.trim()) {
      query.locationName = location.trim();
    }
    if (yearParam) {
      const year = Number.parseInt(yearParam, 10);
      if (!Number.isNaN(year)) {
        const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
        const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);
        query.$or = [
          { assessmentDate: { $gte: yearStart, $lte: yearEnd } },
          {
            assessmentDate: { $exists: false },
            createdAt: { $gte: yearStart, $lte: yearEnd },
          },
          { assessmentDate: null, createdAt: { $gte: yearStart, $lte: yearEnd } },
        ];
      }
    }

    if (useCursor) {
      const parts = [];
      if (Object.keys(query).length) parts.push(query);
      if (search && search.trim()) {
        const rx = new RegExp(escapeRegex(search.trim()), "i");
        parts.push({
          $or: [
            { locationName: rx },
            { formCode: rx },
            { serialNumber: rx },
          ],
        });
      }
      const filter = parts.length === 0 ? {} : parts.length === 1 ? parts[0] : { $and: parts };

      const { items, hasNext } = await findWithMongoIdCursor(
        RiskAssessment,
        filter,
        { cursor, limit }
      );
      return NextResponse.json({ success: true, data: items, hasNext });
    }

    const items = await RiskAssessment.find(query).sort({
      assessmentDate: -1,
      createdAt: -1,
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
