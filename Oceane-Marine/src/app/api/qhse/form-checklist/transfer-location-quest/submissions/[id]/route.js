import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TransferLocationQuestionnaire from "@/lib/mongodb/models/qhse-form-checklist/TransferLocationQuestionnaire";
import { requireQhseSession, assertQhsePermission } from "@/lib/auth/qhseGuard";
import { notifyDelete } from "@/lib/notifications/moduleNotify";

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

export async function DELETE(req, { params }) {
  const guard = await assertQhsePermission("canDelete");
  if (!guard.ok) return guard.response;

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

    await TransferLocationQuestionnaire.findByIdAndDelete(id);
    void notifyDelete("QHSE", "transfer-location-quest · submission", id);

    return NextResponse.json(
      { success: true, message: "Submission deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete Transfer Location Questionnaire error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
