import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import Manual from "@/lib/mongodb/models/operations-form-checklist/Manual";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

export async function DELETE(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const record = await Manual.findById(id);

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const filePath = path.join(process.cwd(), record.filePath);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (fileErr) {
        console.error("Manual delete: could not remove file:", fileErr);
      }
    }

    await Manual.findByIdAndDelete(id);

    void notifyOperationsDelete("Manual Form", id);
    return NextResponse.json({
      success: true,
      message: "Manual record deleted successfully",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
