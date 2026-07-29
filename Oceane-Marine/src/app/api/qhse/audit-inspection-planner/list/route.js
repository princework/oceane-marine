// list/route.js
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import AuditInspectionPlanner from "@/lib/mongodb/models/qhse-audit-inspection/AuditInspectionPlanner";

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    const query = {};
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        // Filter by document's year (used for serial); fallback for old docs without year: match issueDate in that year
        query.$or = [
          { year: yearNum },
          {
            year: { $in: [null, undefined] },
            issueDate: {
              $gte: new Date(`${yearNum}-01-01T00:00:00.000Z`),
              $lte: new Date(`${yearNum}-12-31T23:59:59.999Z`),
            },
          },
        ];
      }
    }

    const list = await AuditInspectionPlanner.find(query).sort({
      createdAt: -1,
    });

    // Available years: from document year and from issueDate (for old docs)
    const allPlanners = await AuditInspectionPlanner.find({})
      .select("year issueDate")
      .lean();
    const years = [
      ...new Set(
        allPlanners.flatMap((p) => {
          const fromYear = p.year != null && !Number.isNaN(Number(p.year)) ? [Number(p.year)] : [];
          const fromIssue = p.issueDate ? [new Date(p.issueDate).getFullYear()] : [];
          return [...fromYear, ...fromIssue].filter((y) => !Number.isNaN(y));
        })
      ),
    ].sort((a, b) => b - a);

    return NextResponse.json({
      success: true,
      data: list,
      years: years.length > 0 ? years : [new Date().getFullYear()],
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}