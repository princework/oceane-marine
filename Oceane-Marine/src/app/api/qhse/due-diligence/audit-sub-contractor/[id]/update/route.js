import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import SubContractorAudit from "@/lib/mongodb/models/qhse-due-diligence/SubContractorAudit";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const body = await req.json();
    const subContractorAudit = await SubContractorAudit.findById(id);
    if (!subContractorAudit) {
      return NextResponse.json(
        { error: "Sub contractor audit not found" },
        { status: 404 }
      );
    }

    // Field updates only — approve/reject now live at [id]/approve and [id]/reject.
    if (subContractorAudit.status !== "Pending") {
      return NextResponse.json(
        { error: "Only pending forms can be updated" },
        { status: 403 }
      );
    }
    Object.keys(body).forEach((key) => {
      if (
        key !== "status" &&
        key !== "approvedBy" &&
        key !== "approvedAt" &&
        key !== "rejectedBy" &&
        key !== "rejectedAt" &&
        key !== "rejectionReason" &&
        key !== "vendorId" &&
        key !== "formCode" &&
        key !== "createdBy" &&
        key !== "createdAt" &&
        key !== "revNo"
      ) {
        subContractorAudit[key] = body[key];
      }
    });
    subContractorAudit.revNo = getNextRevisionNumber(subContractorAudit.revNo);
    await subContractorAudit.save();
    void notifyEdit("QHSE", "due-diligence · audit-sub-contractor · update", id);
    return NextResponse.json(
      { success: true, data: subContractorAudit },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
