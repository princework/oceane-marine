import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import KpiUpload from "@/lib/mongodb/models/qhse-kpi/KpiUpload";
import { getNextYearwiseSerial } from "@/lib/mongodb/models/YearwiseSerialCounter";
import { getQhseFormCode } from "@/lib/constants/qhse-form-codes";

const LIST_PROJECTION = {
  originalName: 1,
  url: 1,
  size: 1,
  mimeType: 1,
  createdAt: 1,
  year: 1,
  formCode: 1,
  serialNumber: 1,
  _id: 1,
};

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    // Always compute available years
    const all = await KpiUpload.find().select("year createdAt").lean();
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
      items = await KpiUpload.find({ ...baseQuery, year: yr }, LIST_PROJECTION)
        .sort({ createdAt: -1 })
        .lean();
    } else {
      items = await KpiUpload.find(baseQuery, LIST_PROJECTION)
        .sort({ createdAt: -1 })
        .lean();
    }

    // Backfill serialNumber and formCode for existing records that don't have them
    const formCodeDefault = getQhseFormCode("KPI_UPLOAD") || "HSE-001B";
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const needsSerial =
        !item.serialNumber ||
        (typeof item.serialNumber === "string" && !item.serialNumber.trim());
      const needsFormCode =
        !item.formCode ||
        (typeof item.formCode === "string" && !item.formCode.trim());
      if (needsSerial) {
        try {
          const yearForSerial =
            item.year != null && !Number.isNaN(Number(item.year))
              ? Number(item.year)
              : undefined;
          const serialNumber = await getNextYearwiseSerial(
            "KPI_UPLOAD",
            yearForSerial
          );
          const formCode = item.formCode || formCodeDefault;
          await KpiUpload.findByIdAndUpdate(item._id, {
            serialNumber,
            formCode: formCode || undefined,
          });
          items[i] = { ...item, serialNumber, formCode };
        } catch (err) {
          console.error("KPI list backfill serial error for", item._id, err);
        }
      } else if (needsFormCode) {
        try {
          await KpiUpload.findByIdAndUpdate(item._id, {
            formCode: formCodeDefault,
          });
          items[i] = { ...item, formCode: formCodeDefault };
        } catch (err) {
          console.error("KPI list backfill formCode error for", item._id, err);
          items[i] = { ...item, formCode: formCodeDefault };
        }
      }
    }

    return NextResponse.json({ success: true, data: items, years });
  } catch (error) {
    console.error("KPI list error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}