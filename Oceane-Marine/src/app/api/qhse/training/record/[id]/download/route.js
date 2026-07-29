import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TrainingRecord from "@/lib/mongodb/models/qhse-training/TrainingRecord";
import fs from "fs";
import path from "path";
import { streamAttachmentFile } from "@/lib/utils/qhse-attachment-stream";

export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const record = await TrainingRecord.findById(id);

    if (!record) {
      return NextResponse.json(
        { error: "Training record not found" },
        { status: 404 }
      );
    }

    if (!record.attachment?.filePath) {
      return NextResponse.json(
        { error: "No attachment found for this record" },
        { status: 404 }
      );
    }

    const absolutePath = path.join(process.cwd(), record.attachment.filePath);

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json(
        { error: "File not found on server" },
        { status: 404 }
      );
    }

    const fileName =
      record.attachment.fileName || path.basename(absolutePath);
    return streamAttachmentFile(absolutePath, fileName);
  } catch (error) {
    console.error("Training Record Download Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
