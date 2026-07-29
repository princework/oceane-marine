import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange";
import { generateMOCManagementChangePdf } from "@/jobs/services/pdf/MOCManagementChangePdfReport";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing MOC ID" },
        { status: 400 }
      );
    }

    const moc = await MOCManagementChange.findById(id).lean();
    if (!moc) {
      return NextResponse.json(
        { success: false, error: "MOC not found" },
        { status: 404 }
      );
    }

    const buffer = await generateMOCManagementChangePdf(moc);
    const safeSerial = String(moc.serialNumber || id).replace(
      /[^a-zA-Z0-9-]/g,
      "-"
    );
    const fileName = `MOC-${safeSerial}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("MOC PDF download error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate PDF",
      },
      { status: 500 }
    );
  }
}
