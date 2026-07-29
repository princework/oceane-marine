import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSTransferAudit from "@/lib/mongodb/models/qhse-form-checklist/StsTransferAudit";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const form = await STSTransferAudit.findById(id);

    if (!form) {
      return NextResponse.json(
        { success: false, error: "Form not found" },
        { status: 404 }
      );
    }

    if (form.status !== "Pending") {
      return NextResponse.json(
        {
          success: false,
          error: "Only Pending forms can be approved",
        },
        { status: 403 }
      );
    }

    const updatedForm = await STSTransferAudit.findByIdAndUpdate(
      id,
      { status: "Approved" },
      { new: true }
    );

    if (!updatedForm) {
      return NextResponse.json(
        { success: false, error: "Form not found" },
        { status: 404 }
      );
    }

    void notifyEdit("QHSE", "form-checklist · transfer-audit · approve", id);
    return NextResponse.json(
      {
        success: true,
        message: "Transfer Audit form approved successfully",
        data: updatedForm,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Transfer Audit approve error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to approve Transfer Audit form" },
      { status: 500 }
    );
  }
}
