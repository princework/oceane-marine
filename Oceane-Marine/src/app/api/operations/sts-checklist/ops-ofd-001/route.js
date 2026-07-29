import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklistOne from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-001";
import { incrementRevisionForUpdate } from "../revision.js";
import { createAndScheduleJob } from "../../../../../jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";
import { buildOperationsStsSignatureDirs } from "@/lib/utils/signature-storage";

// ==================== CONSTANTS ====================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ==================== HELPER FUNCTIONS ====================

function getSignatureUploadDir() {
  return buildOperationsStsSignatureDirs("OPS-OFD-001");
}

/**
 * Detect if a string is raw base64 (no data: prefix, no URL path)
 */
function isRawBase64(str) {
  return str && str.length > 100 && !str.startsWith("/") && !str.startsWith("http") && !str.startsWith("data:");
}

/**
 * Normalize image URL: strip full HTTP URLs back to relative path
 * e.g. "http://localhost:3000/signature/..." → "/signature/..."
 */
function normalizeImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      return parsed.pathname;
    } catch {
      return url;
    }
  }
  return url;
}

/**
 * Save base64 string to file and return the URL path
 */
async function saveBase64ToFile(base64Str, uploadDir, urlDir) {
  const raw = base64Str.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  await fs.mkdir(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-signature.png`;
  await fs.writeFile(path.join(uploadDir, fileName), buffer);
  return `${urlDir}/${fileName}`;
}

/**
 * Handles signature file upload from FormData, data:image base64, or raw base64 strings
 * @param {FormData} formData - FormData object
 * @param {Object} body - Parsed request body
 * @returns {Promise<string>} - Signature URL (relative path)
 */
async function handleSignatureUpload(formData, body) {
  const signatureFile = formData.get("signature");
  let signatureUrl = body.signatureBlock?.signature || "";

  const { physicalDir, urlDir } = getSignatureUploadDir();
  const uploadDir = path.join(process.cwd(), physicalDir);

  // Handle file upload from FormData
  if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
    const bytes = await signatureFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}-${signatureFile.name}`;
    await fs.writeFile(path.join(uploadDir, fileName), buffer);
    signatureUrl = `${urlDir}/${fileName}`;
  }
  // Handle data:image base64
  else if (body.signatureBlock?.signature?.startsWith("data:image")) {
    signatureUrl = await saveBase64ToFile(body.signatureBlock.signature, uploadDir, urlDir);
  }
  // Handle raw base64 (frontend strips data:image prefix)
  else if (isRawBase64(body.signatureBlock?.signature)) {
    signatureUrl = await saveBase64ToFile(body.signatureBlock.signature, uploadDir, urlDir);
  }

  // Normalize: strip full HTTP URLs to relative paths
  signatureUrl = normalizeImageUrl(signatureUrl);

  return signatureUrl;
}

/**
 * Maps request body to vesselDetails schema structure
 * Supports both nested (body.vesselDetails) and flat (body.vesselName) structures
 * @param {Object} body - Request body
 * @returns {Object} - Vessel details object
 */
function mapVesselDetails(body) {
  const vesselData = body.vesselDetails || {};

  return {
    vesselName: vesselData.vesselName || body.vesselName || "",
    shipOperator: vesselData.shipOperator || body.shipOperator || "",
    charterer: vesselData.charterer || body.charterer || "",
    stsOrganizer: vesselData.stsOrganizer || body.stsOrganizer || "",
    plannedTransferDateTime: vesselData.plannedTransferDateTime || body.plannedDateAndTime || body.plannedTransferDateTime
      ? new Date(vesselData.plannedTransferDateTime || body.plannedDateAndTime || body.plannedTransferDateTime)
      : undefined,
    transferLocation: vesselData.transferLocation || body.transferLocation || "",
    cargo: vesselData.cargo || body.cargo || "",
    constantHeadingOrBerthedShip: vesselData.constantHeadingOrBerthedShip || body.constantHeadingShip || body.constantHeadingOrBerthedShip || "",
    manoeuvringOrOuterShip: vesselData.manoeuvringOrOuterShip || body.maneuveringShip || body.manoeuvringOrOuterShip || "",
    poacOrStsSuperintendent: vesselData.poacOrStsSuperintendent || body.poacStsSuperintendent || "",
    applicableJointPlanOperation: vesselData.applicableJointPlanOperation || body.applicableSpecificJointPlanOperation || body.applicableJointPlanOperation || "",
  };
}

/**
 * Maps request body to genericChecks array
 * @param {Array} checks - Array of check objects from request
 * @returns {Array} - Mapped generic checks array
 */
function mapGenericChecks(checks = []) {
  return checks.map((check) => ({
    clNumber: check.id || check.clNumber,
    description: check.description || "",
    status: check.status ? "YES" : check.notApplicable ? "NOT_APPLICABLE" : "NO",
    remarks: check.userRemark || check.remarks || "",
  }));
}

/**
 * Maps request body to signatureBlock schema structure
 * @param {Object} body - Request body
 * @param {string} signatureUrl - Processed signature URL
 * @returns {Object} - Signature block object
 */
function mapSignatureBlock(body, signatureUrl) {
  return {
    name: body.signatureBlock?.name || body.signature?.name || "",
    rank: body.signatureBlock?.rank || body.signature?.rank || "",
    signature: signatureUrl,
    date: body.signatureBlock?.date || body.signature?.date
      ? new Date(body.signatureBlock?.date || body.signature?.date)
      : undefined,
  };
}

/**
 * Builds document data object for update operations
 * @param {Object} body - Request body
 * @param {string} signatureUrl - Processed signature URL
 * @param {string} revisionNo - Revision number
 * @param {Object} existing - Existing document
 * @returns {Object} - Document data object
 */
function buildUpdateData(body, signatureUrl, revisionNo, existing) {
  const existingVessel = existing.vesselDetails || {};
  return {
    formNo: body.formNo || existing.formNo || "OPS-OFD-001",
    revisionNo,
    revisionDate: body.revisionDate ? new Date(body.revisionDate) : new Date(), // Update revisionDate on update
    approvedBy: body.approvedBy || existing.approvedBy || "JS",
    page: body.page || existing.page || "",
    vesselDetails: mapVesselDetails(body, existingVessel),
    genericChecks: mapGenericChecks(body.genericChecks || existing.genericChecks || []),
    signatureBlock: mapSignatureBlock(body, signatureUrl),
    status: body.status || existing.status || "DRAFT",
    createdBy: body.createdBy || existing.createdBy || undefined,
  };
}

/**
 * Triggers background job for document generation
 * @param {string} checklistId - Checklist ID
 * @param {string} operationRef - Operation reference number
 */
async function triggerDocumentGeneration(checklistId, operationRef) {
  await createAndScheduleJob(null, "generate-ops-ofd-001", {
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
 * GET /api/operations/sts-checklist/ops-ofd-001?operationRef=2026-001
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
    console.log(`🔍 Searching for checklist with operationRef: "${operationRef}"`);

    // Try exact match first
    let checklist = await STSChecklistOne.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    // If not found, try case-insensitive search
    if (!checklist) {
      console.log(`⚠️ Exact match not found, trying case-insensitive search...`);
      checklist = await STSChecklistOne.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    // If still not found, try to find similar patterns for debugging
    if (!checklist) {
      const similar = await STSChecklistOne.find({
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

    console.log(`✅ Found checklist: ${checklist._id} with operationRef: "${checklist.operationRef}"`);

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
 * PUT /api/operations/sts-checklist/ops-ofd-001?operationRef=2026-001
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

    console.log(`🔍 Searching for checklist to update with operationRef: "${operationRef}"`);

    // Find existing checklist - try exact match first (use .lean() to get plain JS object)
    let existing = await STSChecklistOne.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    // If not found, try case-insensitive search
    if (!existing) {
      console.log(`⚠️ Exact match not found, trying case-insensitive search...`);
      existing = await STSChecklistOne.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    // If still not found, try to find similar patterns for debugging
    if (!existing) {
      const similar = await STSChecklistOne.find({
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

    console.log(`✅ Found checklist to update: ${existing._id} with operationRef: "${existing.operationRef}"`);

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

    // Handle signature upload
    const signatureUrl = await handleSignatureUpload(formData, body);

    // Increment revision number
    const revisionNo = incrementRevisionForUpdate(existing.revisionNo);
    console.log(`📝 Revision updated: ${existing.revisionNo} → ${revisionNo} for ${operationRef}`);

    // Build update data
    const updateData = buildUpdateData(body, signatureUrl, revisionNo, existing);

    // Update checklist
    const updatedChecklist = await STSChecklistOne.findByIdAndUpdate(
      existing._id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger background job for document regeneration
    await triggerDocumentGeneration(updatedChecklist._id, updatedChecklist.operationRef);

    void notifyOperationsEdit("OPS-OFD-001", updatedChecklist._id);
    return NextResponse.json(
      {
        success: true,
        message: "Checklist updated successfully & doc regeneration started",
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
