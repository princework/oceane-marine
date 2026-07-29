import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import BestPractice from "@/lib/mongodb/models/qhse-best-practices/BestPractice";
import { generateBestPracticePdf } from "@/jobs/services/pdf/BestPracticePdfReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const practice = await BestPractice.findById(id).lean();

    if (!practice) {
      return NextResponse.json(
        { error: "Best practice not found" },
        { status: 404 }
      );
    }

    const buffer = await generateBestPracticePdf(practice);
    const safeSerial = String(practice.serialNumber || id).replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `Best-Practice-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Best practice PDF download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
