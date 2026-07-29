import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import HseInductionChecklist from "@/lib/mongodb/models/qhse-form-checklist/HseInductionChecklist";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const body = await req.json();
    const record = await HseInductionChecklist.findById(id);
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    if (record.status !== "Pending") {
      return NextResponse.json(
        { error: "Only pending HSE Induction Checklist forms can be reviewed" },
        { status: 403 }
      );
    }

    // Strip system fields and apply the rest. revNo is owned by the server.
    const { revNo: _ignoreRevNo, ...safeBody } = body || {};
    Object.assign(record, safeBody);
    record.revNo = getNextRevisionNumber(record.revNo);
    await record.save();
    void notifyEdit("QHSE", "form-checklist · hse-induction-checklist · update", id);
    return NextResponse.json({ success: true, data: record }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
