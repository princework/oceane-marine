import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import VendorSupplierApproval from "@/lib/mongodb/models/qhse-form-checklist/VendorSupplierApproval";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const body = await req.json();
    const record = await VendorSupplierApproval.findById(id);
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Vendor Supplier Approval not found" },
        { status: 404 }
      );
    }

    if (record.status !== "UNDER_REVIEW") {
      return NextResponse.json(
        { success: false, error: "Only Under Review forms can be approved" },
        { status: 403 }
      );
    }

    record.status = body.status;
    if (body.status === "APPROVED") {
        record.approvedBy = body.approvedBy;
      record.approvedAt = new Date();
    } else if (body.status === "REJECTED") {
      record.rejectionReason = body.rejectionReason;
    }
    await record.save();
    void notifyEdit("QHSE", "form-checklist · vendor-supply-form · approval", id);
    return NextResponse.json({ success: true, data: record }, { status: 200 });
  } catch (error) {
    console.error("Vendor Supplier Approval Approval Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
