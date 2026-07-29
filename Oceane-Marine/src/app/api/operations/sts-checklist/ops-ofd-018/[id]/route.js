import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSTimesheet from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-018";
import { incrementRevisionForUpdate } from "../../revision";
import { createAndScheduleJob } from "../../../../../../jobs/agenda/jobHelper.js";
import "../../../../../../jobs/definitions/ops-ofd-018.job.js";
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
  await createAndScheduleJob(null, "generate-ops-ofd-018", {
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
 * GET /api/operations/sts-checklist/ops-ofd-018/[id]
 * Fetches timesheet by ID
 */
export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const timesheet = await STSTimesheet.findById(id).lean();

    if (!timesheet) {
      return NextResponse.json(
        { error: "OPS-OFD-018 timesheet not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: timesheet },
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
 * PUT /api/operations/sts-checklist/ops-ofd-018/[id]
 * Updates timesheet by ID and triggers document regeneration
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

    const existing = await STSTimesheet.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "OPS-OFD-018 timesheet not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo} → ${revisionNo} for ${id}`);

    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existingDocInfo.formNo || "OPS-OFD-018",
        revisionNo: revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : existingDocInfo.issueDate || new Date(),
        approvedBy: body.documentInfo?.approvedBy || existingDocInfo.approvedBy || "JS",
        page: body.documentInfo?.page ?? existingDocInfo.page ?? "1 of 1",
      },
      basicInfo: body.basicInfo || existing.basicInfo || {},
      operationTimings: (body.operationTimings || existing.operationTimings || []).map((timing) => ({
        activityName: timing.activityName || "",
        fromDate: timing.fromDate ? new Date(timing.fromDate) : undefined,
        fromTime: timing.fromTime || "",
        toDate: timing.toDate ? new Date(timing.toDate) : undefined,
        toTime: timing.toTime || "",
        remarks: timing.remarks || "",
      })),
      additionalActivities: (body.additionalActivities || existing.additionalActivities || []).map((timing) => ({
        activityName: timing.activityName || "",
        fromDate: timing.fromDate ? new Date(timing.fromDate) : undefined,
        fromTime: timing.fromTime || "",
        toDate: timing.toDate ? new Date(timing.toDate) : undefined,
        toTime: timing.toTime || "",
        remarks: timing.remarks || "",
      })),
      weatherDelay: body.weatherDelay || existing.weatherDelay || {},
      cargoInfo: body.cargoInfo || existing.cargoInfo || {},
      finalRemarks: body.finalRemarks || existing.finalRemarks || "",
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedTimesheet = await STSTimesheet.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    await triggerDocumentGeneration(updatedTimesheet._id, updatedTimesheet.operationRef);

    void notifyOperationsEdit("OPS-OFD-018", id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-018 timesheet updated successfully & doc regeneration started",
        data: updatedTimesheet,
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
