import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TransferLocationQuestionnaire from "@/lib/mongodb/models/qhse-form-checklist/TransferLocationQuestionnaire";
import { requireQhseSession } from "@/lib/auth/qhseGuard";

export const runtime = "nodejs";

export async function GET(req) {
  const session = await requireQhseSession();
  if (!session.ok) return session.response;

  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const query = {};
    if (status) query.status = status;

    const records = await TransferLocationQuestionnaire.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error("List Transfer Location Questionnaire error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
