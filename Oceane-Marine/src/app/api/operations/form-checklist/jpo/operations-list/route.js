import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";

export const runtime = "nodejs";

/**
 * Operation Ref No picker for the JPO create/edit form. Only the latest
 * version of each operation chain is offered, matching how every other
 * ref-based lookup in this app resolves "the current state" of an operation.
 */
export async function GET() {
  await connectDB();

  try {
    const operations = await StsOperation.find({ isLatest: true })
      .select("Operation_Ref_No client chs ms operationStatus location createdAt")
      .populate("location", "name")
      .sort({ createdAt: -1 })
      .lean();

    const data = operations
      .filter((op) => op.Operation_Ref_No)
      .map((op) => ({
        operationRef: op.Operation_Ref_No,
        client: op.client || "",
        chs: op.chs || "",
        ms: op.ms || "",
        operationStatus: op.operationStatus || "",
        locationId: op.location?._id ? String(op.location._id) : "",
        locationName: op.location?.name || "",
      }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("JPO operations-list lookup error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
