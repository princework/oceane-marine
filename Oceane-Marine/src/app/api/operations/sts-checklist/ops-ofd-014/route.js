import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSEquipmentChecklist from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-014";
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
  return buildOperationsStsSignatureDirs("OPS-OFD-014");
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
async function saveBase64ToFile(base64Str, prefix, uploadDir, urlDir) {
  const raw = base64Str.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  await fs.mkdir(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${prefix}.png`;
  await fs.writeFile(path.join(uploadDir, fileName), buffer);
  return `${urlDir}/${fileName}`;
}

/**
 * Handles signature file upload from FormData, data:image base64, or raw base64 strings
 */
async function handleSignatureUpload(formData, body, existing = {}) {
  const signatureFile = formData.get("signature");
  let signatureUrl = body.signatureBlock?.mooringMasterSignature || existing.signatureBlock?.mooringMasterSignature || "";

  const { physicalDir, urlDir } = getSignatureUploadDir();
  const uploadDir = path.join(process.cwd(), physicalDir);

  // Handle signature: file upload → data:image base64 → raw base64
  if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
    const bytes = await signatureFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}-${signatureFile.name}`;
    await fs.writeFile(path.join(uploadDir, fileName), buffer);
    signatureUrl = `${urlDir}/${fileName}`;
  } else if (body.signatureBlock?.mooringMasterSignature?.startsWith("data:image")) {
    signatureUrl = await saveBase64ToFile(body.signatureBlock.mooringMasterSignature, "signature", uploadDir, urlDir);
  } else if (isRawBase64(body.signatureBlock?.mooringMasterSignature)) {
    signatureUrl = await saveBase64ToFile(body.signatureBlock.mooringMasterSignature, "signature", uploadDir, urlDir);
  }

  // Normalize: strip full HTTP URLs to relative paths
  signatureUrl = normalizeImageUrl(signatureUrl);

  return signatureUrl;
}

/**
 * Triggers background job for document generation
 */
async function triggerDocumentGeneration(checklistId, operationRef) {
  await createAndScheduleJob(null, "generate-ops-ofd-014", {
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
 * GET /api/operations/sts-checklist/ops-ofd-014?operationRef=2026-001
 * Fetches existing equipment checklist by operationRef
 */
export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    let operationRef = searchParams.get("operationRef");
    const operationPhase = searchParams.get("operationPhase"); // Optional: "BEFORE_OPERATION" or "AFTER_OPERATION"

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    operationRef = operationRef.trim();

    // Build query: include operationPhase if provided
    const baseQuery = { operationRef };
    if (operationPhase && (operationPhase === "BEFORE_OPERATION" || operationPhase === "AFTER_OPERATION")) {
      baseQuery["jobInfo.operationPhase"] = operationPhase;
    }

    console.log(`🔍 Searching for OPS-OFD-014 equipment checklist with operationRef: "${operationRef}"${operationPhase ? `, operationPhase: "${operationPhase}"` : ""}`);

    let checklist = await STSEquipmentChecklist.findOne(baseQuery)
      .sort({ createdAt: -1 })
      .lean();

    // Fallback: if not found with operationPhase filter, try without it (for backward compatibility)
    if (!checklist && operationPhase) {
      checklist = await STSEquipmentChecklist.findOne({ operationRef })
        .sort({ createdAt: -1 })
        .lean();
    }

    if (!checklist) {
      checklist = await STSEquipmentChecklist.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!checklist) {
      return NextResponse.json(
        { 
          error: `No OPS-OFD-014 equipment checklist found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-014 equipment checklist: ${checklist._id} with operationRef: "${checklist.operationRef}"`);

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
 * PUT /api/operations/sts-checklist/ops-ofd-014?operationRef=2026-001
 * Updates existing equipment checklist by operationRef
 */
export async function PUT(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    let operationRef = searchParams.get("operationRef");
    const operationPhase = searchParams.get("operationPhase"); // Optional: "BEFORE_OPERATION" or "AFTER_OPERATION"

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    operationRef = operationRef.trim();

    // Build query: include operationPhase if provided
    const baseQuery = { operationRef };
    if (operationPhase && (operationPhase === "BEFORE_OPERATION" || operationPhase === "AFTER_OPERATION")) {
      baseQuery["jobInfo.operationPhase"] = operationPhase;
    }

    console.log(`🔍 Searching for OPS-OFD-014 equipment checklist to update with operationRef: "${operationRef}"${operationPhase ? `, operationPhase: "${operationPhase}"` : ""}`);

    let existing = await STSEquipmentChecklist.findOne(baseQuery)
      .sort({ createdAt: -1 })
      .lean();

    // Fallback: if not found with operationPhase filter, try without it (for backward compatibility)
    if (!existing && operationPhase) {
      existing = await STSEquipmentChecklist.findOne({ operationRef })
        .sort({ createdAt: -1 })
        .lean();
    }

    if (!existing) {
      existing = await STSEquipmentChecklist.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!existing) {
      return NextResponse.json(
        { 
          error: `No OPS-OFD-014 equipment checklist found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-014 equipment checklist to update: ${existing._id} with operationRef: "${existing.operationRef}"`);

    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(dataStr);

    const signatureUrl = await handleSignatureUpload(formData, body, existing);

    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo} → ${revisionNo} for ${operationRef}`);

    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existingDocInfo.formNo || "OPS-OFD-014",
        revisionNo: revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : existingDocInfo.issueDate || new Date(),
        approvedBy: body.documentInfo?.approvedBy || existingDocInfo.approvedBy || "JS",
        page: body.documentInfo?.page || existingDocInfo.page || "1 of 1",
      },
      jobInfo: body.jobInfo || existing.jobInfo || {},
      fenderEquipment: body.fenderEquipment || existing.fenderEquipment || [],
      hoseEquipment: body.hoseEquipment || existing.hoseEquipment || [],
      otherEquipment: body.otherEquipment || existing.otherEquipment || [],
      remarks: body.remarks || existing.remarks || "",
      signatureBlock: {
        mooringMasterSignature: signatureUrl || "",
      },
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedChecklist = await STSEquipmentChecklist.findByIdAndUpdate(
      existing._id,
      updateData,
      { new: true, runValidators: true }
    );

    await triggerDocumentGeneration(updatedChecklist._id, updatedChecklist.operationRef);

    void notifyOperationsEdit("OPS-OFD-014", updatedChecklist._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-014 equipment checklist updated successfully & doc regeneration started",
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
