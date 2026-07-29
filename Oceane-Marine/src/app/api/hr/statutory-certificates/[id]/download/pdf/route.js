import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StatutoryCertificate from "@/lib/mongodb/models/hr/StatutoryCertificate";
import { generateStatutoryCertificatePdf } from "@/jobs/services/pdf/StatutoryCertificatePdfReport";
import { assertHrPermission } from "@/lib/auth/hrGuard";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const guard = await assertHrPermission("canDownload");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;
    const record = await StatutoryCertificate.findById(id).lean();

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Certificate not found" },
        { status: 404 }
      );
    }

    const buffer = await generateStatutoryCertificatePdf(record);
    const safeYear = String(record.year || "cert").replace(/[^a-zA-Z0-9-]/g, "-");
    const safeId = String(id).replace(/[^a-zA-Z0-9-]/g, "-");
    const fileName = `Statutory-Certificate-${safeYear}-${safeId}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Statutory certificate PDF download error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
