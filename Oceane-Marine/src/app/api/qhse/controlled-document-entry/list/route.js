import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import ControlledDocumentEntry from "@/lib/mongodb/models/qhse-controlled-document/ControlledDocumentEntry";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";

export const runtime = "nodejs";

export async function GET() {
  const guard = await assertQhsePermission("canView");
  if (!guard.ok) return guard.response;

  try {
    await connectDB();
    const items = await ControlledDocumentEntry.find()
      .sort({ updatedAt: -1 })
      .lean();

    const data = items.map((row) => {
      let docCount = row.documents;
      if (typeof docCount !== "number" || Number.isNaN(docCount)) {
        docCount = Math.max(0, Number.parseInt(String(docCount ?? "0"), 10) || 0);
      }
      return {
        ...row,
        documents: docCount,
        revNo: `${row.revMajor ?? 1}.${row.revMinor ?? 0}`,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("controlled-document-entry list error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load" },
      { status: 500 }
    );
  }
}
