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
    if (mocdoc.status !== "Open") {
      return NextResponse.json(
        { success: false, error: "Only Open records can be closed" },
        { status: 403 }
      );
    }

    await MOCManagementChange.updateOne(
      { _id: id },
      { $set: { status: "Closed", statusReview: "Closed" } }
    );

    const moc = await MOCManagementChange.findById(id);

    void notifyEdit("QHSE", "moc · management-change · close", id);
    return NextResponse.json(
      {
        success: true,
        message: "MOC closed successfully",
        data: moc,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("MOC close error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to close MOC",
      },
      { status: 500 }
    );
  }
}
