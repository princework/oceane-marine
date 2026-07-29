import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import NearMiss from "@/lib/mongodb/models/qhse-near-miss/NearMiss";
import { generateNearMissPdf } from "@/jobs/services/pdf/NearMissPdfReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const report = await NearMiss.findById(id).lean();

    if (!report) {
      return NextResponse.json(
        { error: "Near-miss report not found" },
        { status: 404 }
      );
    }

    const buffer = await generateNearMissPdf(report);
    const safeSerial = String(report.serialNumber || id).replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Near-Miss-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Near-miss PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
