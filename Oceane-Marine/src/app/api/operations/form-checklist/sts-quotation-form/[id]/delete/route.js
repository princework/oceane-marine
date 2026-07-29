import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsQuotationForm from "@/lib/mongodb/models/operations-form-checklist/StsQuotationForm";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

export async function DELETE(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;

    // Find the record
    const record = await StsQuotationForm.findById(id);
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    // Delete from database
    await StsQuotationForm.findByIdAndDelete(id);

    void notifyOperationsDelete("STS Quotation", id);
    return NextResponse.json({
      success: true,
      message: "Record deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete record" },
      { status: 500 }
    );
  }
}
