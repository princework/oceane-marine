import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const mocdoc = await MOCManagementChange.findById(id);
    if (!mocdoc) {
      return NextResponse.json(
        { success: false, error: "MOC Management of Change not found" },
        { status: 404 }
      );
    }
    // Only Open records can be rejected (and then closed)
    if (mocdoc.status !== "Open") {
      return NextResponse.json(
        { success: false, error: "Only Open records can be closed" },
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

    const updateData = {
      $set: {
        status: "Closed",
        statusReview: "Rejected",
        rejectionReason: body.rejectionReason.trim(),
      },
    };

    console.log("Rejecting MOC:", id, "Update data:", updateData);

    const updateResult = await MOCManagementChange.updateOne(
      { _id: id },
      updateData,
      { runValidators: true }
    );

    console.log("Update result:", updateResult);

    const moc = await MOCManagementChange.findById(id);

    if (!moc) {
      return NextResponse.json(
        { success: false, error: "MOC Management of Change not found" },
        { status: 404 }
      );
    }

    if (!moc) {
      return NextResponse.json(
        { success: false, error: "MOC Management of Change not found" },
        { status: 404 }
      );
    }

    console.log("MOC after update:", {
      id: moc._id,
      status: moc.status,
      statusReview: moc.statusReview,
    });

    void notifyEdit("QHSE", "moc · management-change · reject", id);
    return NextResponse.json(
      {
        success: true,
        message: "MOC Management of Change rejected successfully",
        data: moc,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("MOC reject error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reject MOC Management of Change" },
      { status: 500 }
    );
  }
}
