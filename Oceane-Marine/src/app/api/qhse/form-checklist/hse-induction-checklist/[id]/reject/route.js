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
          error: "Only Pending forms can be rejected",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (!body.rejectionReason?.trim()) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    const updatedForm = await HseInductionChecklist.findByIdAndUpdate(
      id,
      {
        status: "Rejected",
        rejectionReason: body.rejectionReason.trim(),
      },
      { new: true }
    );

    if (!updatedForm) {
      return NextResponse.json(
        { success: false, error: "HSE Induction Checklist not found" },
        { status: 404 }
      );
    }

    void notifyEdit("QHSE", "form-checklist · hse-induction-checklist · reject", id);
    return NextResponse.json(
      {
        success: true,
        message: "HSE Induction Checklist rejected successfully",
        data: updatedForm,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("HSE Induction Checklist reject error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to reject HSE Induction Checklist",
      },
      { status: 500 }
    );
  }
}

