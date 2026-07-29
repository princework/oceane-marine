import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection.js";
import WarehouseManagement from "@/lib/mongodb/models/pms/WarehouseManagement.js";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";

export async function GET(req) {
  const guard = await assertPmsPermission("canView");
  if (!guard.ok) return guard.response;
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const location = searchParams.get("location");
    const yearParam = searchParams.get("year");

    const filter = {
      isDeleted: false,
      ...(location && { location: location.trim() }),
    };

    const yearNum = yearParam ? Number(yearParam) : NaN;
    if (!Number.isNaN(yearNum)) {
      const start = new Date(yearNum, 0, 1);
      const end = new Date(yearNum + 1, 0, 1);

      // Filter primarily on startDate; fall back to createdAt when startDate is missing
      filter.$or = [
        { startDate: { $gte: start, $lt: end } },
        {
          startDate: { $exists: false },
          createdAt: { $gte: start, $lt: end },
        },
      ];
    }

    const data = await WarehouseManagement.find(filter).sort({
      startDate: -1,
      createdAt: -1,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Warehouse list error:", error);
    return NextResponse.json(
      { message: error.message },
      { status: 500 }
    );
  }
}
