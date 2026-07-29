import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSHourlyQuantityLog from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-015";
import { incrementRevisionForUpdate } from "../../revision";
import { createAndScheduleJob } from "../../../../../../jobs/agenda/jobHelper.js";
import "../../../../../../jobs/definitions/ops-ofd-015.job.js";
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
  await createAndScheduleJob(null, "generate-ops-ofd-015", {
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
 * GET /api/operations/sts-checklist/ops-ofd-015/[id]
 * Fetches hourly quantity log by ID
 */
export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const log = await STSHourlyQuantityLog.findById(id).lean();

    if (!log) {
      return NextResponse.json(
        { error: "OPS-OFD-015 hourly quantity log not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: log },
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
 * PUT /api/operations/sts-checklist/ops-ofd-015/[id]
 * Updates hourly quantity log by ID and triggers document regeneration
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

    const existing = await STSHourlyQuantityLog.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "OPS-OFD-015 hourly quantity log not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo} → ${revisionNo} for ${id}`);

    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existingDocInfo.formNo || "OPS-OFD-015",
        revisionNo: revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : existingDocInfo.issueDate || new Date(),
        approvedBy: body.documentInfo?.approvedBy || existingDocInfo.approvedBy || "JS",
      },
      transferInfo: body.transferInfo || existing.transferInfo || {},
      hourlyRecords: (body.hourlyRecords || existing.hourlyRecords || []).map((record) => ({
        serialNumber: record.serialNumber,
        date: record.date ? new Date(record.date) : undefined,
        time: record.time || "",
        dischargedQuantity: record.dischargedQuantity || 0,
        receivedQuantity: record.receivedQuantity || 0,
        differenceQuantity: record.differenceQuantity || 0,
        checkedBy: record.checkedBy || "",
      })),
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedLog = await STSHourlyQuantityLog.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    await triggerDocumentGeneration(updatedLog._id, updatedLog.operationRef);

    void notifyOperationsEdit("OPS-OFD-015", id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-015 hourly quantity log updated successfully & doc regeneration started",
        data: updatedLog,
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
