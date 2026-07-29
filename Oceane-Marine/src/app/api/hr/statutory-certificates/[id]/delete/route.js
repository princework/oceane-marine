import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StatutoryCertificate from "@/lib/mongodb/models/hr/StatutoryCertificate";
import path from "path";
import fs from "fs/promises";
import { assertHrPermission } from "@/lib/auth/hrGuard";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

// Helper: remove empty parent directories up to the "hr" folder
async function cleanEmptyDirs(dirPath) {
  const hrRoot = path.join(process.cwd(), "public/uploads/hr");
  let current = dirPath;
  while (current !== hrRoot && current.startsWith(hrRoot)) {
    try {
      const entries = await fs.readdir(current);
      if (entries.length === 0) {
        await fs.rmdir(current);
        current = path.dirname(current);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}

export async function DELETE(req, { params }) {
  const guard = await assertHrPermission("canDelete");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;

    const certificate = await StatutoryCertificate.findById(id);
    if (!certificate) {
      return NextResponse.json(
        { message: "Certificate not found" },
        { status: 404 }
      );
    }

    // Delete the attached file and clean up empty directories
    if (certificate.attachment?.fileUrl) {
      try {
        const filePath = path.join(process.cwd(), "public", certificate.attachment.fileUrl);
        await fs.unlink(filePath).catch(() => {});
        // Clean up empty parent folders (validity → year → typeOfDocs → location)
        await cleanEmptyDirs(path.dirname(filePath));
      } catch (err) {
        console.error("Error deleting file:", err);
      }
    }

    // Delete certificate from database
    await StatutoryCertificate.findByIdAndDelete(id);

    void notifyDelete("HR", "statutory-certificates · delete", id);
    return NextResponse.json({ message: "Certificate deleted successfully" }, { status: 200 });
  } catch (err) {
    console.error("Statutory certificate deletion error:", err);
    return NextResponse.json(
      { message: err.message || "Deletion failed", error: err.message },
      { status: 500 }
    );
  }
}
