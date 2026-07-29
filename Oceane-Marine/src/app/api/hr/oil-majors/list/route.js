import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import OilMajor from "@/lib/mongodb/models/hr/OilMajor";
import { assertHrPermission } from "@/lib/auth/hrGuard";

export async function GET() {
  const guard = await assertHrPermission("canView");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const records = await OilMajor.find()
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ data: records }, { status: 200 });
  } catch (err) {
    console.error("Oil Major list error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to fetch records", error: err.message },
      { status: 500 }
    );
  }
}
