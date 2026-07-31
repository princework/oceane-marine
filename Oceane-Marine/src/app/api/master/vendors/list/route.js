import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterVendor from "@/lib/mongodb/models/MasterVendor";
import { requireQhseSession } from "@/lib/auth/qhseGuard";

export async function GET() {
  const session = await requireQhseSession();
  if (!session.ok) return session.response;

  await connectDB();
  try {
    const vendors = await MasterVendor.find().sort({ name: 1 }).lean();
    return NextResponse.json({ vendors });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
