import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist5C from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005C";
import { incrementRevisionForUpdate } from "../revision.js";
import { createAndScheduleJob } from "../../../../../jobs/agenda/jobHelper.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

// ==================== CONSTANTS ====================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Triggers background job for document generation
 * @param {string} checklistId - Checklist ID
 * @param {string} operationRef - Operation reference number
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
 * GET /api/operations/sts-checklist/ops-ofd-005c?operationRef=2026-001
 * Fetches existing checklist data by operationRef (for external form)
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

    // Trim whitespace and normalize
    operationRef = operationRef.trim();

    // Debug logging
    console.log(`🔍 Searching for OPS-OFD-005C checklist with operationRef: "${operationRef}"`);

    // Try exact match first
    let checklist = await STSChecklist5C.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    // If not found, try case-insensitive search
    if (!checklist) {
      console.log(`⚠️ Exact match not found, trying case-insensitive search...`);
      checklist = await STSChecklist5C.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    // If still not found, try to find similar patterns for debugging
    if (!checklist) {
      const similar = await STSChecklist5C.find({
        operationRef: { $regex: operationRef.replace(/[^0-9-]/g, ""), $options: "i" }
      })
      .select("operationRef sequenceNumber createdAt")
      .limit(5)
      .sort({ createdAt: -1 })
      .lean();
      
      if (similar.length > 0) {
        console.log(`🔍 Found similar operationRefs:`, similar.map(d => ({
          operationRef: d.operationRef,
          sequenceNumber: d.sequenceNumber
        })));
      }
    }

    if (!checklist) {
      return NextResponse.json(
        { 
          error: `No checklist found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-005C checklist: ${checklist._id} with operationRef: "${checklist.operationRef}"`);

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
 * PUT /api/operations/sts-checklist/ops-ofd-005c?operationRef=2026-001
 * Updates existing checklist by operationRef (for external form)
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

    // Trim whitespace and normalize
    operationRef = operationRef.trim();

    console.log(`🔍 Searching for OPS-OFD-005C checklist to update with operationRef: "${operationRef}"`);

    // Find existing checklist - try exact match first (.lean() for plain JS object)
    let existing = await STSChecklist5C.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    // If not found, try case-insensitive search
    if (!existing) {
      console.log(`⚠️ Exact match not found, trying case-insensitive search...`);
      existing = await STSChecklist5C.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    // If still not found, try to find similar patterns for debugging
    if (!existing) {
      const similar = await STSChecklist5C.find({
        operationRef: { $regex: operationRef.replace(/[^0-9-]/g, ""), $options: "i" }
      })
      .select("operationRef sequenceNumber createdAt")
      .limit(5)
      .sort({ createdAt: -1 })
      .lean();
      
      if (similar.length > 0) {
        console.log(`🔍 Found similar operationRefs:`, similar.map(d => ({
          operationRef: d.operationRef,
          sequenceNumber: d.sequenceNumber
        })));
      }
    }

    if (!existing) {
      return NextResponse.json(
        { 
          error: `No checklist found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-005C checklist to update: ${existing._id} with operationRef: "${existing.operationRef}"`);

    // Parse request body
    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(dataStr);

    // Increment revision number
    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo || "N/A"} → ${revisionNo} for ${operationRef}`);

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
      existing._id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger background job for document regeneration
    await triggerDocumentGeneration(updatedChecklist._id, updatedChecklist.operationRef);

    void notifyOperationsEdit("OPS-OFD-005C", updatedChecklist._id);
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
