import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCRiskAssessment from "@/lib/mongodb/models/qhse-moc/mocs-riskAssessment";
import fs from "fs";
import path from "path";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const upload = await MOCRiskAssessment.findById(id);

    if (!upload) {
      return NextResponse.json(
        { success: false, error: "Upload not found" },
        { status: 404 }
      );
    }

    // Delete local files
    if (upload.files && upload.files.length > 0) {
      for (const file of upload.files) {
        const filePath = file.filePath || file.url;
        if (filePath && !filePath.startsWith("http")) {
          try {
            const absPath = path.join(process.cwd(), filePath);
            if (fs.existsSync(absPath)) {
              fs.unlinkSync(absPath);
            }
          } catch (deleteError) {
            console.error(`Failed to delete local file: ${filePath}`, deleteError);
          }
        }
      }
    }

    await MOCRiskAssessment.findByIdAndDelete(id);

    void notifyDelete("QHSE", "moc · risk-assessment", id);
    return NextResponse.json(
      {
        success: true,
        message: "Upload deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Risk Assessment delete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete upload",
      },
      { status: 500 }
    );
  }
}
