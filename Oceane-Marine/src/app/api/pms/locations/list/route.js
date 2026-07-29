import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import PmsLocation from "@/lib/mongodb/models/pms/PmsLocation";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";

/** Readable by any PMS role that can view the module; mutations stay admin-only. */
export async function GET() {
  const guard = await assertPmsPermission("canView");
  if (!guard.ok) return guard.response;

  try {
    await connectDB();
    const locations = await PmsLocation.find().sort({ name: 1 }).lean();
    return NextResponse.json({ locations });
  } catch (error) {
    console.error("PMS locations list error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load locations" },
      { status: 500 }
    );
  }
}
