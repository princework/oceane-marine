import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import STSTransferLocationQuest from "@/lib/mongodb/models/qhse-form-checklist/StsTransferLocationQuest";
import { generateTransferLocationQuestDoc } from "@/jobs/services/pdf/TransferLocationQuest";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const quest = await STSTransferLocationQuest.findById(id).lean();

    if (!quest) {
      return NextResponse.json(
        { error: "Questionnaire not found" },
        { status: 404 }
      );
    }

    // Generate temporary file path
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `TransferLocationQuest-${quest.serialNumber || quest._id.toString()}.docx`;
    const tempFilePath = path.join(tempDir, fileName);

    // Generate DOCX document
    await generateTransferLocationQuestDoc(quest, tempFilePath);

    // Read the generated file
    const fileBuffer = fs.readFileSync(tempFilePath);

    // Clean up temporary file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (err) {
      console.error("Error deleting temp file:", err);
    }

    // Return the file
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Transfer Location Questionnaire download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}
