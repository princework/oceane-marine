import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import TransferLocationQuestionnaire from "@/lib/mongodb/models/qhse-form-checklist/TransferLocationQuestionnaire";

export const runtime = "nodejs";

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Anonymous submission from the QHSE-FORMS app. Upserts by operationRef so a
 * client re-opening the same emailed link (e.g. after a rejection) overwrites
 * the prior submission and resets status to "Pending Approval" instead of
 * needing a separate update endpoint.
 */
export async function POST(req) {
  await connectDB();

  try {
    const body = await req.json().catch(() => ({}));
    const operationRef = str(body.operationRef);
    const locationName = str(body.location?.locationName);

    if (!operationRef) {
      return NextResponse.json(
        { success: false, error: "operationRef is required" },
        { status: 400 }
      );
    }
    if (!locationName) {
      return NextResponse.json(
        { success: false, error: "Location Name is required" },
        { status: 400 }
      );
    }

    const existing = await TransferLocationQuestionnaire.findOne({ operationRef });

    const payload = {
      operationRef,
      location: body.location || {},
      environmental: body.environmental || {},
      traffic: body.traffic || {},
      regulatory: body.regulatory || {},
      emergencySupport: body.emergencySupport || {},
      communication: body.communication || {},
      operationalRestrictions: body.operationalRestrictions || {},
      submittedByName: str(body.submittedByName),
      submittedByEmail: str(body.submittedByEmail),
      status: "Pending Approval",
      rejectionReason: "",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
    };

    let record;
    if (existing) {
      Object.assign(existing, payload);
      existing.bumpRevision();
      record = await existing.save();
    } else {
      record = await TransferLocationQuestionnaire.create(payload);
    }

    return NextResponse.json(
      { success: true, message: "Transfer Location Questionnaire submitted", data: record },
      { status: existing ? 200 : 201 }
    );
  } catch (error) {
    console.error("Transfer Location Questionnaire submit error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit" },
      { status: 500 }
    );
  }
}
