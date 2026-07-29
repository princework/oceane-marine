import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Equipment from "@/lib/mongodb/models/pms/Equipment";
import { getNextYearwiseSerial } from "@/lib/mongodb/models/YearwiseSerialCounter";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";

/**
 * One-time / idempotent: assign serialCode to legacy rows created before the field existed
 * or when an old cached Mongoose schema stripped serialCode on insert.
 *
 * POST — requires canDelete (typically PMS editor).
 */
export async function POST() {
  const guard = await assertPmsPermission("canDelete");
  if (!guard.ok) return guard.response;

  try {
    await connectDB();

    const missing = await Equipment.find({
      $or: [
        { serialCode: { $exists: false } },
        { serialCode: null },
        { serialCode: "" },
      ],
    })
      .sort({ createdAt: 1 })
      .select("_id createdAt")
      .lean();

    const updated = [];

    for (const doc of missing) {
      const year = doc.createdAt
        ? new Date(doc.createdAt).getFullYear()
        : new Date().getFullYear();
      const serialCode = await getNextYearwiseSerial(
        "PMS_PRIMARY_EQUIPMENT",
        year
      );
      await Equipment.updateOne({ _id: doc._id }, { $set: { serialCode } });
      updated.push({ id: String(doc._id), serialCode });
    }

    return NextResponse.json({
      message:
        updated.length === 0
          ? "All equipment records already have a serial code"
          : `Assigned serial code to ${updated.length} record(s)`,
      updated,
    });
  } catch (error) {
    console.error("Backfill serial codes error:", error);
    return NextResponse.json(
      { message: error.message || "Backfill failed" },
      { status: 500 }
    );
  }
}
