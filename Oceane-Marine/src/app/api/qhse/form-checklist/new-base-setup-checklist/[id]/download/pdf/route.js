import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import NewBaseSetupChecklist from "@/lib/mongodb/models/qhse-form-checklist/NewBaseSetupChecklist";
import { generateNewBaseSetupChecklistPdf } from "@/jobs/services/pdf/NewBaseSetupChecklistReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const record = await NewBaseSetupChecklist.findById(id).lean();

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const buffer = await generateNewBaseSetupChecklistPdf(record);
    const fileName = `New-Base-Setup-Checklist-${record.serialNumber || record._id.toString()}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("New Base Setup Checklist PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
