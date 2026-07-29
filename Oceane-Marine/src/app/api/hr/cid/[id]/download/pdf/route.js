import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Cid from "@/lib/mongodb/models/hr/Cid";
import { generateCidPdf } from "@/jobs/services/pdf/CidPdfReport";
import { assertHrPermission } from "@/lib/auth/hrGuard";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const guard = await assertHrPermission("canDownload");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;
    const record = await Cid.findById(id).lean();

    if (!record) {
      return NextResponse.json(
        { success: false, error: "CID record not found" },
        { status: 404 }
      );
    }

    const buffer = await generateCidPdf(record);
    const safeId = String(id).replace(/[^a-zA-Z0-9-]/g, "-");
    const fileName = `CID-${safeId}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("CID PDF download error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
