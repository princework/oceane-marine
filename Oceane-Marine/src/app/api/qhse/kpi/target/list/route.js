import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TargetKpi from "@/lib/mongodb/models/qhse-kpi/TargetKpi";
import { getQhseFormCode } from "@/lib/constants/qhse-form-codes";

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    const all = await TargetKpi.find()
      .select("year formCode serialNumber createdAt")
      .lean();
    const years = [
      ...new Set(
        all
          .map((i) => i.year)
          .filter((y) => typeof y === "number" && !Number.isNaN(y))
      ),
    ].sort((a, b) => b - a);

    const baseQuery = includeArchived ? {} : { isArchived: { $ne: true } };

    let items;
    if (year) {
      const yr = Number.parseInt(year, 10);
      items = await TargetKpi.find({ ...baseQuery, year: yr })
        .sort({ createdAt: -1 })
        .lean();
    } else {
      items = await TargetKpi.find(baseQuery).sort({ createdAt: -1 }).lean();
    }

    // Backfill formCode for existing records (HSE-001A)
    const formCodeDefault = getQhseFormCode("TARGET_KPI") || "HSE-001A";
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.formCode || (typeof item.formCode === "string" && !item.formCode.trim())) {
        try {
          await TargetKpi.findByIdAndUpdate(item._id, {
            formCode: formCodeDefault,
          });
          items[i] = { ...item, formCode: formCodeDefault };
        } catch (err) {
          console.error("Target KPI list backfill formCode error for", item._id, err);
          items[i] = { ...item, formCode: formCodeDefault };
        }
      }
    }

    return NextResponse.json({ success: true, data: items, years });
  } catch (error) {
    console.error("Target KPI list error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
