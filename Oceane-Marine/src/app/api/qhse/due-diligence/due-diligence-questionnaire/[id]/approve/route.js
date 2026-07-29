import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const body = await req.json();

    // Allow only specific status values coming from frontend
    if (!["Approved", "Rejected"].includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid status value. Allowed: Approved or Rejected." },
        { status: 400 }
      );
    }

    const record = await SupplierDueDiligence.findById(id);

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Once form is Approved/Rejected, status cannot be changed again
    if (record.status !== "Pending") {
      return NextResponse.json(
        { error: "Only Pending forms can be updated." },
        { status: 403 }
      );
    }

    record.status = body.status;
    record.approvedBy = body.approvedBy;
    record.approvedAt = new Date();

    await record.save();

    void notifyEdit("QHSE", "due-diligence · due-diligence-questionnaire · approve", id);
    return NextResponse.json(
      {
        message: "Supplier Due Diligence status updated successfully",
        data: record,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
