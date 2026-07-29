import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklistOne from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-001";
import { incrementRevisionForUpdate } from "../../revision";
import { createAndScheduleJob } from "../../../../../../jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "../../../../../../jobs/definitions/ops-ofd-001.job.js";
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
 */
async function handleSignatureUpload(formData, body, existingSignature = "") {
  const signatureFile = formData.get("signature");
  let signatureUrl = body.signatureBlock?.signature || existingSignature;

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
 */
function mapVesselDetails(body, existing = {}) {
  const vesselData = body.vesselDetails || {};
  return {
    vesselName: vesselData.vesselName || body.vesselName || existing.vesselName || "",
    shipOperator: vesselData.shipOperator || body.shipOperator || existing.shipOperator || "",
    charterer: vesselData.charterer || body.charterer || existing.charterer || "",
    stsOrganizer: vesselData.stsOrganizer || body.stsOrganizer || existing.stsOrganizer || "",
    plannedTransferDateTime: vesselData.plannedTransferDateTime || body.plannedDateAndTime || body.plannedTransferDateTime
      ? new Date(vesselData.plannedTransferDateTime || body.plannedDateAndTime || body.plannedTransferDateTime)
      : existing.plannedTransferDateTime,
    transferLocation: vesselData.transferLocation || body.transferLocation || existing.transferLocation || "",
    cargo: vesselData.cargo || body.cargo || existing.cargo || "",
    constantHeadingOrBerthedShip: vesselData.constantHeadingOrBerthedShip || body.constantHeadingShip || body.constantHeadingOrBerthedShip || existing.constantHeadingOrBerthedShip || "",
    manoeuvringOrOuterShip: vesselData.manoeuvringOrOuterShip || body.maneuveringShip || body.manoeuvringOrOuterShip || existing.manoeuvringOrOuterShip || "",
    poacOrStsSuperintendent: vesselData.poacOrStsSuperintendent || body.poacStsSuperintendent || existing.poacOrStsSuperintendent || "",
    applicableJointPlanOperation: vesselData.applicableJointPlanOperation || body.applicableSpecificJointPlanOperation || body.applicableJointPlanOperation || existing.applicableJointPlanOperation || "",
  };
}

/**
 * Maps request body to genericChecks array
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
 */
function mapSignatureBlock(body, signatureUrl, existing = {}) {
  return {
    name: body.signatureBlock?.name || body.signature?.name || existing.name || "",
    rank: body.signatureBlock?.rank || body.signature?.rank || existing.rank || "",
    signature: signatureUrl || existing.signature || "",
    date: body.signatureBlock?.date || body.signature?.date
      ? new Date(body.signatureBlock?.date || body.signature?.date)
      : existing.date,
  };
}

/**
 * Triggers background job for document generation
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
 * GET /api/operations/sts-checklist/ops-ofd-001/[id]
 * Fetches checklist by ID
 */
export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const checklist = await STSChecklistOne.findById(id).lean();

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
 * PUT /api/operations/sts-checklist/ops-ofd-001/[id]
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
    const existing = await STSChecklistOne.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Handle signature upload
    const signatureUrl = await handleSignatureUpload(
      formData,
      body,
      existing.signatureBlock?.signature
    );

    // Increment revision number
    const revisionNo = incrementRevisionForUpdate(existing.revisionNo);
    console.log(`📝 Revision updated: ${existing.revisionNo} → ${revisionNo} for ${id}`);

    // Build update data
    const updateData = {
      formNo: body.formNo || existing.formNo || "OPS-OFD-001",
      revisionNo,
      revisionDate: body.revisionDate ? new Date(body.revisionDate) : new Date(), // Update revisionDate on update
      approvedBy: body.approvedBy || existing.approvedBy || "JS",
      page: body.page || existing.page || "",
      vesselDetails: mapVesselDetails(body, existing.vesselDetails || {}),
      genericChecks: mapGenericChecks(body.genericChecks || existing.genericChecks || []),
      signatureBlock: mapSignatureBlock(body, signatureUrl, existing.signatureBlock || {}),
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    // Update checklist
    const updatedChecklist = await STSChecklistOne.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger background job for document regeneration
    await triggerDocumentGeneration(updatedChecklist._id, updatedChecklist.operationRef);

    void notifyOperationsEdit("OPS-OFD-001", id);
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
