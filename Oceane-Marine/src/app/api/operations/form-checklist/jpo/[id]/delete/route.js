import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Jpo from "@/lib/mongodb/models/operations-form-checklist/Jpo";
import fs from "fs";
import path from "path";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

export async function DELETE(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;

    // Find the record
    const record = await Jpo.findById(id);
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    // Delete the file from filesystem
    try {
      const isVercel = process.env.VERCEL === "1";
      const baseDir = isVercel ? "/tmp" : process.cwd();
      const filePath = path.join(baseDir, record.filePath);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.error("Error deleting file:", fileError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await Jpo.findByIdAndDelete(id);

    void notifyOperationsDelete("JPO", id);
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
