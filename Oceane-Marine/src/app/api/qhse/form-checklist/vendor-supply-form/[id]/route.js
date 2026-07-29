import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import VendorSupplierApproval from "@/lib/mongodb/models/qhse-form-checklist/VendorSupplierApproval";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await VendorSupplierApproval.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }
    await VendorSupplierApproval.findByIdAndDelete(id);
    void notifyDelete("QHSE", "form-checklist · vendor-supply-form", id);
    return NextResponse.json(
      { success: true, message: "Record deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete vendor supplier approval error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
