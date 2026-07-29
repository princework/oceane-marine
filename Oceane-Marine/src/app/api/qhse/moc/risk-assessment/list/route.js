import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCRiskAssessment from "@/lib/mongodb/models/qhse-moc/mocs-riskAssessment";

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
        query.$or = [
          { year: yearNum },
          {
            $and: [
              { $or: [{ year: { $exists: false } }, { year: null }] },
              {
                $or: [
                  { createdAt: { $gte: new Date(`${yearNum}-01-01T00:00:00.000Z`), $lte: new Date(`${yearNum}-12-31T23:59:59.999Z`) } },
                  { uploadedAt: { $gte: new Date(`${yearNum}-01-01T00:00:00.000Z`), $lte: new Date(`${yearNum}-12-31T23:59:59.999Z`) } },
                ],
              },
            ],
          },
        ];
      }
    }

    const uploads = await MOCRiskAssessment.find(query)
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 });

    // Available years from year field, createdAt, uploadedAt
    const allUploads = await MOCRiskAssessment.find({}).select("year createdAt uploadedAt").lean();
    const years = [
      ...new Set(
        allUploads.flatMap((u) => {
          const fromYear = u.year != null && !Number.isNaN(Number(u.year)) ? [Number(u.year)] : [];
          const fromCreated = u.createdAt && !Number.isNaN(new Date(u.createdAt).getTime()) ? [new Date(u.createdAt).getFullYear()] : [];
          const fromUploaded = u.uploadedAt && !Number.isNaN(new Date(u.uploadedAt).getTime()) ? [new Date(u.uploadedAt).getFullYear()] : [];
          return [...fromYear, ...fromCreated, ...fromUploaded];
        })
      ),
    ]
      .filter((y) => !Number.isNaN(y))
      .sort((a, b) => b - a);

    return NextResponse.json({
      success: true,
      data: uploads,
      years: years.length > 0 ? years : [new Date().getFullYear()],
    });
  } catch (error) {
    console.error("Risk Assessment list error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

