import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsEquipmentBaseStockLevel from "@/lib/mongodb/models/qhse-form-checklist/StsEquipmentBaseStockLevel";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

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

    /* ---------------------------
       ALLOW UPDATE ONLY IN DRAFT
    ---------------------------- */
    if (record.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: "Only draft forms can be updated" },
        { status: 403 }
      );
    }

    /* ---------------------------
       ALLOWED FIELDS ONLY
    ---------------------------- */
    const allowedUpdates = ["equipmentCategories", "revisionDate", "status", "year"];

    allowedUpdates.forEach((field) => {
      if (body[field] !== undefined) {
        record[field] = body[field];
      }
    });

    record.updatedAt = new Date();
    record.revNo = getNextRevisionNumber(record.revNo);

    await record.save();

    void notifyEdit("QHSE", "form-checklist · equipment-base-stock-level · update", id);
    return NextResponse.json({ success: true, data: record }, { status: 200 });
  } catch (error) {
    console.error("Update Draft Error:", error);

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
