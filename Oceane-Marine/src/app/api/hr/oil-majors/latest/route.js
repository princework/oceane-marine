import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import OilMajor from "@/lib/mongodb/models/hr/OilMajor";
import { assertHrPermission } from "@/lib/auth/hrGuard";

/**
 * Returns the latest record for each unique company name.
 * This is used for the PDF download — showing the most recent status per company.
 */
export async function GET() {
  const guard = await assertHrPermission("canView");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    // Get all records sorted by createdAt descending
    const allRecords = await OilMajor.find()
      .sort({ createdAt: -1 })
      .lean();

    // Group by companyName (case-insensitive), keep only the latest
    const latestMap = new Map();
    for (const record of allRecords) {
      const key = record.companyName.trim().toUpperCase();
      if (!latestMap.has(key)) {
        latestMap.set(key, {
          companyName: record.companyName,
          status: record.status,
          updatedAt: record.updatedAt,
        });
      }
    }

    // Convert map to array sorted alphabetically by company name
    const latestRecords = Array.from(latestMap.values()).sort((a, b) =>
      a.companyName.localeCompare(b.companyName)
    );

    return NextResponse.json({ data: latestRecords }, { status: 200 });
  } catch (err) {
    console.error("Oil Major latest error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to fetch latest records", error: err.message },
      { status: 500 }
    );
  }
}
