import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import HseInductionChecklist from "@/lib/mongodb/models/qhse-form-checklist/HseInductionChecklist";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const form = await HseInductionChecklist.findById(id);

    if (!form) {
      return NextResponse.json(
        { success: false, error: "HSE Induction Checklist not found" },
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

    const body = await req.json();
    const updatedForm = await HseInductionChecklist.findByIdAndUpdate(
      id,
      {
        status: "Approved",
        approvedBy: body.approvedBy || null,
      },
      { new: true }
    );

    if (!updatedForm) {
      return NextResponse.json(
        { success: false, error: "HSE Induction Checklist not found" },
        { status: 404 }
      );
    }

    void notifyEdit("QHSE", "form-checklist · hse-induction-checklist · approve", id);
    return NextResponse.json(
      {
        success: true,
        message: "HSE Induction Checklist approved successfully",
        data: updatedForm,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("HSE Induction Checklist approve error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to approve HSE Induction Checklist",
      },
      { status: 500 }
    );
  }
}

