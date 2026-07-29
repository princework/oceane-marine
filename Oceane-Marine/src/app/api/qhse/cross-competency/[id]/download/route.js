import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import PoacCrossCompetency from "@/lib/mongodb/models/qhse-poac/PoacCrossCompetency";
import { generatePoacCrossCompetencyDoc } from "@/jobs/services/pdf/PoacCrossCompetencyReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const record = await PoacCrossCompetency.findById(id).lean();

    if (!record) {
      return NextResponse.json(
        { error: "POAC Cross Competency form not found" },
        { status: 404 }
      );
    }

    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `POAC-Cross-Competency-${record.serialNumber || record._id.toString()}.docx`;
    const tempFilePath = path.join(tempDir, fileName);

    await generatePoacCrossCompetencyDoc(record, tempFilePath);

    const fileBuffer = fs.readFileSync(tempFilePath);

    try {
      fs.unlinkSync(tempFilePath);
    } catch (err) {
      console.error("Error deleting temp file:", err);
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("POAC Cross Competency download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate document" },
      { status: 500 }
    );
  }
}
