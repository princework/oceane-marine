import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";

export async function POST(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const defect = await EquipmentDefect.findById(id);
    if (!defect) {
      return NextResponse.json(
        { error: "Defect not found" },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    let files = formData.getAll("files");
    if (!files.length && formData.get("files")) {
      files = [formData.get("files")];
    }
    files = files.filter((f) => f && typeof f.name === "string");

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const recordDate = defect.targetDate ? new Date(defect.targetDate) : new Date();

    const newAttachments = [];
    for (const file of files) {
      if (!file || typeof file.name !== "string") continue;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const filePath = await saveQhseFile({
        formCode: "QAF-OFD-025",
        location: defect.base || null,
        date: recordDate,
        title: defect.equipmentDefect || "Equipment-Defect",
        fileType: "attachments",
        fileName: file.name,
        buffer,
      });

      newAttachments.push({
        path: filePath,
        originalName: file.name,
      });
    }

    const updated = await EquipmentDefect.findByIdAndUpdate(
      id,
      { $push: { attachments: { $each: newAttachments } } },
      { new: true }
    ).lean();

    return NextResponse.json(
      { message: "Files uploaded successfully", data: updated },
      { status: 200 }
    );
  } catch (error) {
    console.error("Equipment defect upload error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
