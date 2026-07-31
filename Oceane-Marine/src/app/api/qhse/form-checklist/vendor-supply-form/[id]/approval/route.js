import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import VendorSupplierApproval from "@/lib/mongodb/models/qhse-form-checklist/VendorSupplierApproval";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";

export async function PUT(req, { params }) {
  const guard = await assertQhsePermission("canApprove");
  if (!guard.ok) return guard.response;

  await connectDB();
  try {
    const { id } = await params;
    const body = await req.json();

    if (!["APPROVED", "REJECTED"].includes(body.status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status value. Allowed: APPROVED or REJECTED." },
        { status: 400 }
      );
    }
    if (body.status === "REJECTED" && !body.rejectionReason?.trim()) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required." },
        { status: 400 }
      );
    }

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
      record.approvedBy = guard.user.employeeName || String(guard.user._id);
      record.approvedAt = new Date();
      record.rejectionReason = "";
    } else if (body.status === "REJECTED") {
      record.rejectionReason = body.rejectionReason.trim();
      record.approvedBy = "";
      record.approvedAt = null;
    }
    await record.save();
    void notifyEdit("QHSE", "form-checklist · vendor-supply-form · approval", id);
    return NextResponse.json({ success: true, data: record }, { status: 200 });
  } catch (error) {
    console.error("Vendor Supplier Approval Approval Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
