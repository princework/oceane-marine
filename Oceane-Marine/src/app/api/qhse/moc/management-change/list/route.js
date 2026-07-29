import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange";
import { findWithMongoIdCursor } from "@/lib/qhse/mongoIdCursorPagination";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildYearFilter(yearParam) {
  if (!yearParam) return null;
  const yearNum = Number.parseInt(yearParam, 10);
  if (Number.isNaN(yearNum)) return null;
  return {
    $or: [
      { year: yearNum },
      {
        $and: [
          { $or: [{ year: { $exists: false } }, { year: null }] },
          {
            initiationDate: {
              $gte: new Date(`${yearNum}-01-01T00:00:00.000Z`),
              $lte: new Date(`${yearNum}-12-31T23:59:59.999Z`),
            },
          },
        ],
      },
    ],
  };
}

async function computeYears() {
  const allMocs = await MOCManagementChange.find({})
    .select("year initiationDate")
    .lean();
  const years = [
    ...new Set(
      allMocs.flatMap((m) => {
        const fromYear =
          m.year != null && !Number.isNaN(Number(m.year)) ? [Number(m.year)] : [];
        const fromDate =
          m.initiationDate && !Number.isNaN(new Date(m.initiationDate).getTime())
            ? [new Date(m.initiationDate).getFullYear()]
            : [];
        return [...fromYear, ...fromDate];
      })
    ),
  ]
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => b - a);
  return years.length > 0 ? years : [new Date().getFullYear()];
}

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const useCursor = searchParams.get("paged") === "cursor";
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    if (useCursor) {
      const statusParam = searchParams.get("status");
      const search = searchParams.get("search");
      const cursor = searchParams.get("cursor");
      const limit = searchParams.get("limit");

      const parts = [];
      if (!includeArchived) {
        parts.push({ isArchived: { $ne: true } });
      }
      const yf = buildYearFilter(year);
      if (yf) parts.push(yf);
      if (statusParam && statusParam !== "All") {
        parts.push({ status: statusParam });
      }
      if (search && search.trim()) {
        const rx = new RegExp(escapeRegex(search.trim()), "i");
        parts.push({
          $or: [
            { serialNumber: rx },
            { formCode: rx },
            { proposedChange: rx },
          ],
        });
      }

      const filter = parts.length === 0 ? {} : { $and: parts };

      const { items, hasNext } = await findWithMongoIdCursor(
        MOCManagementChange,
        filter,
        { cursor, limit }
      );

      await MOCManagementChange.populate(items, {
        path: "changeMadeBy",
        select: "name email",
      });

      const years = await computeYears();

      return NextResponse.json({
        success: true,
        data: items,
        hasNext,
        years,
      });
    }

    const query = {};
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    if (year) {
      const yf = buildYearFilter(year);
      if (yf) Object.assign(query, yf);
    }

    const moc = await MOCManagementChange.find(query)
      .populate("changeMadeBy", "name email")
      .sort({ createdAt: -1 });

    const years = await computeYears();

    return NextResponse.json({
      success: true,
      data: moc,
      years,
    });
  } catch (error) {
    console.error("MOC list error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
