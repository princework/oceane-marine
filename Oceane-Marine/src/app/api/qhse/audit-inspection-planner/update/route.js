import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import AuditInspectionPlanner from "@/lib/mongodb/models/qhse-audit-inspection/AuditInspectionPlanner";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function PATCH(req) {
  await connectDB();
  try {
    const body = await req.json();
    const { id, status } = body || {};

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const existing = await AuditInspectionPlanner.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Planner not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const updated = await AuditInspectionPlanner.findByIdAndUpdate(
      id,
      { status, revNo: getNextRevisionNumber(existing.revNo) },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Planner not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    void notifyEdit("QHSE", "audit-inspection-planner · update", updated._id);
    return NextResponse.json(
      { success: true, data: updated },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

