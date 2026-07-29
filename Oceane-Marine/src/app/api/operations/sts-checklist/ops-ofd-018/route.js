import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSTimesheet from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-018";
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
 * GET /api/operations/sts-checklist/ops-ofd-018?operationRef=2026-001
 * Fetches existing timesheet by operationRef
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

    console.log(`🔍 Searching for OPS-OFD-018 timesheet with operationRef: "${operationRef}"`);

    let timesheet = await STSTimesheet.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!timesheet) {
      timesheet = await STSTimesheet.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!timesheet) {
      return NextResponse.json(
        { 
          error: `No OPS-OFD-018 timesheet found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-018 timesheet: ${timesheet._id} with operationRef: "${timesheet.operationRef}"`);

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
 * PUT /api/operations/sts-checklist/ops-ofd-018?operationRef=2026-001
 * Updates existing timesheet by operationRef
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

    console.log(`🔍 Searching for OPS-OFD-018 timesheet to update with operationRef: "${operationRef}"`);

    let existing = await STSTimesheet.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!existing) {
      existing = await STSTimesheet.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!existing) {
      return NextResponse.json(
        { 
          error: `No OPS-OFD-018 timesheet found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-018 timesheet to update: ${existing._id} with operationRef: "${existing.operationRef}"`);

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
      existing._id,
      updateData,
      { new: true, runValidators: true }
    );

    await triggerDocumentGeneration(updatedTimesheet._id, updatedTimesheet.operationRef);

    void notifyOperationsEdit("OPS-OFD-018", updatedTimesheet._id);
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
