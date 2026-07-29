import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { connectDB } from "@/lib/config/connection";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";

/**
 * DELETE /api/qhse/defects-list/[id]/attachments/[index]
 *
 * Removes a single attachment (by array index) from an Equipment Defect
 * record. Used by the edit form so the user can drop individual photos/files
 * without having to delete the whole defect.
 *
 * The file on disk is best-effort unlinked — failure to unlink does not
 * roll back the DB change (the row was already detached and would otherwise
 * leave the user stuck with a phantom attachment).
 */
export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id, index } = await params;

    const idx = Number.parseInt(index, 10);
    if (Number.isNaN(idx) || idx < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid attachment index." },
        { status: 400 }
      );
    }

    const defect = await EquipmentDefect.findById(id);
    if (!defect) {
      return NextResponse.json(
        { success: false, error: "Defect not found." },
        { status: 404 }
      );
    }

    if (!Array.isArray(defect.attachments) || idx >= defect.attachments.length) {
      return NextResponse.json(
        { success: false, error: "Attachment not found at that index." },
        { status: 404 }
      );
    }

    const removed = defect.attachments[idx];
    defect.attachments.splice(idx, 1);
    await defect.save();

    if (removed?.path) {
      try {
        const absPath = path.join(process.cwd(), removed.path);
        await fs.unlink(absPath);
      } catch (unlinkErr) {
        // Disk file may already be missing; log and continue so the API
        // still returns success — the DB change is the source of truth.
        console.warn(
          "Equipment defect – attachment file already missing:",
          unlinkErr?.message || unlinkErr
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Attachment removed.",
        data: defect.toObject(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Equipment defect – delete attachment error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to remove attachment.",
      },
      { status: 500 }
    );
  }
}
