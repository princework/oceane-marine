import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSTransferAudit from "@/lib/mongodb/models/qhse-form-checklist/StsTransferAudit";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

export const runtime = "nodejs"; 

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const body = await req.json();
    const record = await STSTransferAudit.findById(id);
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    if (record.status !== "Pending") {
      return NextResponse.json(
        { error: "Only pending forms can be updated" },
        { status: 403 }
      );
    }

    record.status = body.status;
    record.approvedBy = body.approvedBy;
    record.approvedAt = new Date();
    record.revNo = getNextRevisionNumber(record.revNo);
    await record.save();
    void notifyEdit("QHSE", "form-checklist · transfer-audit · update", id);
    return NextResponse.json({ success: true, data: record }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
