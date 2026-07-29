import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSEquipmentChecklist from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-014";
import { incrementRevisionForUpdate } from "../../revision";
import { createAndScheduleJob } from "../../../../../../jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "../../../../../../jobs/definitions/ops-ofd-014.job.js";
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
 * GET /api/operations/sts-checklist/ops-ofd-014/[id]
 * Fetches equipment checklist by ID
 */
export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const checklist = await STSEquipmentChecklist.findById(id).lean();

    if (!checklist) {
      return NextResponse.json(
        { error: "OPS-OFD-014 equipment checklist not found" },
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
 * PUT /api/operations/sts-checklist/ops-ofd-014/[id]
 * Updates equipment checklist by ID and triggers document regeneration
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

    const existing = await STSEquipmentChecklist.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "OPS-OFD-014 equipment checklist not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const signatureUrl = await handleSignatureUpload(formData, body, existing);

    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo} → ${revisionNo} for ${id}`);

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
      id,
      updateData,
      { new: true, runValidators: true }
    );

    await triggerDocumentGeneration(updatedChecklist._id, updatedChecklist.operationRef);

    void notifyOperationsEdit("OPS-OFD-014", id);
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
