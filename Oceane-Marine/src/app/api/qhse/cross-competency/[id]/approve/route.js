import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import PoacCrossCompetency from "@/lib/mongodb/models/qhse-poac/PoacCrossCompetency";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export const runtime = "nodejs";

/**
 * In-place approval only (does not create a new revision — unlike PUT …/update).
 */
export async function PUT(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const approvedBy = typeof body.approvedBy === "string" ? body.approvedBy.trim() : "";

    if (!approvedBy) {
      return NextResponse.json(
        { success: false, error: "approvedBy is required (approver name for PDF header)." },
        { status: 400 }
      );
    }

    const record = await PoacCrossCompetency.findById(id);

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Form not found" },
        { status: 404 }
      );
    }

    if (record.isLatest === false) {
      return NextResponse.json(
        { success: false, error: "Only the latest version can be approved." },
        { status: 403 }
      );
    }

    if (record.status === "Approved") {
      return NextResponse.json(
        { success: false, error: "This form is already approved." },
        { status: 400 }
      );
    }

    if (record.status === "Rejected") {
      return NextResponse.json(
        {
          success: false,
          error:
            "This form was rejected. Resubmit from the source app (or change status) before approving.",
        },
        { status: 400 }
      );
    }

    record.status = "Approved";
    record.rejectionReason = "";
    record.approvedBy = approvedBy;
    await record.save();

    void notifyEdit("QHSE", "cross-competency · approve", id);
    return NextResponse.json(
      {
        success: true,
        message: "POAC Cross Competency form approved.",
        data: record,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POAC Cross Competency approve error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to approve" },
      { status: 500 }
    );
  }
}
