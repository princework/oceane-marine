import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist5C from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005C";
import { incrementRevisionForUpdate } from "../../revision";
import { createAndScheduleJob } from "../../../../../../jobs/agenda/jobHelper.js";
import "../../../../../../jobs/definitions/ops-ofd-005c.job.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

// ==================== CONSTANTS ====================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Triggers background job for document generation
 */
async function triggerDocumentGeneration(checklistId, operationRef) {
  await createAndScheduleJob(null, "generate-ops-ofd-005c", {
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
 * GET /api/operations/sts-checklist/ops-ofd-005c/[id]
 * Fetches checklist by ID
 */
export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const checklist = await STSChecklist5C.findById(id).lean();

    if (!checklist) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: checklist },
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
 * PUT /api/operations/sts-checklist/ops-ofd-005c/[id]
 * Updates checklist by ID and triggers document regeneration
 */
export async function PUT(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(dataStr);

    // Get existing checklist
    const existing = await STSChecklist5C.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Increment revision number
    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo || "N/A"} → ${revisionNo} for ${id}`);

    // Build update data — explicitly construct documentInfo to avoid stale/overwritten revisionNo
    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existingDocInfo.formNo || "OPS-OFD-005C",
        revisionNo,
        issueDate: body.documentInfo?.issueDate
          ? new Date(body.documentInfo.issueDate)
          : existingDocInfo.issueDate || new Date(),
        approvedBy: body.documentInfo?.approvedBy || existingDocInfo.approvedBy || "JS",
      },
      terminalTransferInfo: body.terminalTransferInfo || existing.terminalTransferInfo || {},
      checklistItems: (body.checklistItems || existing.checklistItems || []).map((item, idx) => ({
        clNumber: item.clNumber || idx + 1,
        description: item.description || "",
        status: {
          terminalBerthedShip: item.status?.terminalBerthedShip || false,
          outerShip: item.status?.outerShip || false,
          terminal: item.status?.terminal || false,
        },
        remarks: item.remarks || "",
      })),
      responsiblePersons: body.responsiblePersons || existing.responsiblePersons || {},
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    // Update checklist
    const updatedChecklist = await STSChecklist5C.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger background job for document regeneration
    await triggerDocumentGeneration(updatedChecklist._id, updatedChecklist.operationRef);

    void notifyOperationsEdit("OPS-OFD-005C", id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-005C checklist updated successfully & doc regeneration started",
        data: updatedChecklist,
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
