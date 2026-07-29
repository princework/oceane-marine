import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MooringMastersJobReport from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-009";
import { incrementRevisionForUpdate } from "../revision.js";
import { createAndScheduleJob } from "../../../../../jobs/agenda/jobHelper.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

// ==================== CONSTANTS ====================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Triggers background job for document generation
 */
async function triggerDocumentGeneration(checklistId, operationRef) {
  await createAndScheduleJob(null, "generate-ops-ofd-009", {
    checklistId,
    operationRef,
  });
}

// ==================== API ROUTE HANDLERS ====================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * GET /api/operations/sts-checklist/ops-ofd-009?operationRef=2026-001
 * Fetches existing job report by operationRef
 */
export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    let operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    operationRef = operationRef.trim();

    console.log(`🔍 Searching for OPS-OFD-009 job report with operationRef: "${operationRef}"`);

    let report = await MooringMastersJobReport.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!report) {
      report = await MooringMastersJobReport.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!report) {
      return NextResponse.json(
        { 
          error: `No OPS-OFD-009 job report found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-009 job report: ${report._id} with operationRef: "${report.operationRef}"`);

    return NextResponse.json(
      { success: true, data: report },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * PUT /api/operations/sts-checklist/ops-ofd-009?operationRef=2026-001
 * Updates existing job report by operationRef
 */
export async function PUT(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    let operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    operationRef = operationRef.trim();

    console.log(`🔍 Searching for OPS-OFD-009 job report to update with operationRef: "${operationRef}"`);

    let existing = await MooringMastersJobReport.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!existing) {
      existing = await MooringMastersJobReport.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!existing) {
      return NextResponse.json(
        { 
          error: `No OPS-OFD-009 job report found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-009 job report to update: ${existing._id} with operationRef: "${existing.operationRef}"`);

    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(dataStr);

    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo} → ${revisionNo} for ${operationRef}`);

    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existingDocInfo.formNo || "OPS-OFD-009",
        revisionNo: revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : existingDocInfo.issueDate || new Date(),
        approvedBy: body.documentInfo?.approvedBy || existingDocInfo.approvedBy || "JS",
      },
      shipToBeLighted: body.shipToBeLighted || existing.shipToBeLighted || {},
      receivingShip: body.receivingShip || existing.receivingShip || {},
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedReport = await MooringMastersJobReport.findByIdAndUpdate(
      existing._id,
      updateData,
      { new: true, runValidators: true }
    );

    await triggerDocumentGeneration(updatedReport._id, updatedReport.operationRef);

    void notifyOperationsEdit("OPS-OFD-009", updatedReport._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-009 job report updated successfully & doc regeneration started",
        data: updatedReport,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
