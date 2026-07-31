import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterAuditor from "@/lib/mongodb/models/MasterAuditor";
import { requireQhseSession } from "@/lib/auth/qhseGuard";

export async function GET() {
  const session = await requireQhseSession();
  if (!session.ok) return session.response;

  await connectDB();
  try {
    const auditors = await MasterAuditor.find().sort({ name: 1 }).lean();
    return NextResponse.json({ auditors });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
