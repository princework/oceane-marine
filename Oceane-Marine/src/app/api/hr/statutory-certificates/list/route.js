import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StatutoryCertificate from "@/lib/mongodb/models/hr/StatutoryCertificate";
import { assertHrPermission } from "@/lib/auth/hrGuard";

export async function GET(req) {
  const guard = await assertHrPermission("canView");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const certificates = await StatutoryCertificate.find({ status: "ACTIVE" })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ data: certificates }, { status: 200 });
  } catch (err) {
    console.error("Statutory certificates list error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to fetch certificates", error: err.message },
      { status: 500 }
    );
  }
}
