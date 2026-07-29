import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSTransferLocationQuest from "@/lib/mongodb/models/qhse-form-checklist/StsTransferLocationQuest";
import { generateTransferLocationQuestPdf } from "@/jobs/services/pdf/TransferLocationQuest";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const quest = await STSTransferLocationQuest.findById(id).lean();

    if (!quest) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const buffer = await generateTransferLocationQuestPdf(quest);
    const fileName = `TransferLocationQuest-${quest.serialNumber || quest._id.toString()}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Transfer Location Questionnaire PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
