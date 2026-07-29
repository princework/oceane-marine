import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import PoacCrossCompetency from "@/lib/mongodb/models/qhse-poac/PoacCrossCompetency";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export const runtime = "nodejs";

/**
 * In-place rejection (no new revision). Clears approvedBy for PDF header.
 */
export async function PUT(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const rejectionReason =
      typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";

    if (!rejectionReason) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required." },
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
        { success: false, error: "Only the latest version can be rejected." },
        { status: 403 }
      );
    }

    if (record.status === "Approved") {
      return NextResponse.json(
        { success: false, error: "Cannot reject an approved form." },
        { status: 400 }
      );
    }

    if (record.status === "Rejected") {
      return NextResponse.json(
        { success: false, error: "This form is already rejected." },
        { status: 400 }
      );
    }

    record.status = "Rejected";
    record.rejectionReason = rejectionReason;
    record.approvedBy = "";
    await record.save();

    void notifyEdit("QHSE", "cross-competency · reject", id);
    return NextResponse.json(
      {
        success: true,
        message: "POAC Cross Competency form rejected.",
        data: record,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POAC Cross Competency reject error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reject" },
      { status: 500 }
    );
  }
}
