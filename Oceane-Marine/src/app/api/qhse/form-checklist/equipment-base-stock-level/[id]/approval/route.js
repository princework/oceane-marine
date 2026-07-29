import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsEquipmentBaseStockLevel from "@/lib/mongodb/models/qhse-form-checklist/StsEquipmentBaseStockLevel";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const body = await req.json();
    const record = await StsEquipmentBaseStockLevel.findById(id);
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    if (record.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: "Only Pending forms can be approved" },
        { status: 403 }
      );
    }
    record.status = body.status;

    await record.save();
    void notifyEdit("QHSE", "form-checklist · equipment-base-stock-level · approval", id);
    return NextResponse.json({ success: true, data: record }, { status: 200 });
  } catch (error) {
    console.error("Equipment Base Stock Level Approval Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
