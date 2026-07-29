import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import PoacCrossCompetency from "@/lib/mongodb/models/qhse-poac/PoacCrossCompetency";
import { findWithMongoIdCursor } from "@/lib/qhse/mongoIdCursorPagination";

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);

    /* =========================
       QUERY PARAMS
       ========================= */
    const page = Math.max(Number(searchParams.get("page")) || 1, 1);
    const limit = Math.min(Number(searchParams.get("limit")) || 10, 50);
    const status = searchParams.get("status");
    const latestOnly = searchParams.get("latestOnly") !== "false";
    const search = searchParams.get("search");
    const year = searchParams.get("year");
    const useCursor = searchParams.get("paged") === "cursor";
    const cursor = searchParams.get("cursor");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    /* =========================
       BUILD FILTER
       ========================= */
    const filter = {};

    if (!includeArchived) {
      filter.isArchived = { $ne: true };
    }

    if (latestOnly) {
      filter.isLatest = true;
    }

    if (status) {
      filter.status = status;
    }

    if (year) {
      const yearNum = Number.parseInt(year, 10);
      filter.evaluationDate = {
        $gte: new Date(`${yearNum}-01-01T00:00:00.000Z`),
        $lte: new Date(`${yearNum}-12-31T23:59:59.999Z`),
      };
    }

    if (search && search.trim()) {
      filter.$or = [
        { formCode: { $regex: search, $options: "i" } },
        { jobRefNo: { $regex: search, $options: "i" } },
        { nameOfPOAC: { $regex: search, $options: "i" } },
      ];
    }

    /* =========================
       QUERY DB
       ========================= */
    const selectFields =
      "formCode serialNumber nameOfPOAC jobRefNo evaluationDate leadPOAC status revNo isLatest createdAt";

    if (useCursor) {
      const { items, hasNext } = await findWithMongoIdCursor(
        PoacCrossCompetency,
        filter,
        {
          cursor,
          limit,
          select: selectFields,
        }
      );

      const allForms = await PoacCrossCompetency.find({
        evaluationDate: { $exists: true, $ne: null },
      })
        .select("evaluationDate")
        .lean();
      const years = [
        ...new Set(
          allForms
            .map((f) => new Date(f.evaluationDate).getFullYear())
            .filter((y) => !Number.isNaN(y))
        ),
      ].sort((a, b) => b - a);

      return NextResponse.json(
        {
          success: true,
          limit,
          data: items,
          hasNext,
          years: years.length > 0 ? years : [new Date().getFullYear()],
        },
        { status: 200 }
      );
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      PoacCrossCompetency.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(selectFields)
        .lean(),
      PoacCrossCompetency.countDocuments(filter),
    ]);

    // Get available years from all forms
    const allForms = await PoacCrossCompetency.find({
      evaluationDate: { $exists: true, $ne: null },
    })
      .select("evaluationDate")
      .lean();
    const years = [
      ...new Set(
        allForms
          .map((f) => new Date(f.evaluationDate).getFullYear())
          .filter((y) => !Number.isNaN(y))
      ),
    ].sort((a, b) => b - a);

    /* =========================
       RESPONSE
       ========================= */
    return NextResponse.json(
      {
        success: true,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        data,
        years: years.length > 0 ? years : [new Date().getFullYear()],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POAC LIST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch POAC evaluations",
      },
      { status: 500 }
    );
  }
}
