import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TransferLocationQuestionnaire from "@/lib/mongodb/models/qhse-form-checklist/TransferLocationQuestionnaire";
import { requireQhseSession } from "@/lib/auth/qhseGuard";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const session = await requireQhseSession();
  if (!session.ok) return session.response;

  await connectDB();

  try {
    const { id } = await params;
    const record = await TransferLocationQuestionnaire.findById(id);

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Transfer Location Questionnaire not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("Get Transfer Location Questionnaire error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
