import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist8 from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-028";
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
  return buildOperationsStsSignatureDirs("OPS-OFD-028");
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
      return parsed.pathname; // "/signature/operation-sts-checklist/..."
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
 * Handles signature and stamp file uploads from FormData, data:image base64, or raw base64 strings
 */
async function handleSignatureUploads(formData, body, existing = {}) {
  const signatureFile = formData.get("signature");
  const stampFile = formData.get("stamp");
  let signatureUrl = body.signatureBlock?.signatureImage || existing.signatureBlock?.signatureImage || "";
  let stampUrl = body.signatureBlock?.stampImage || existing.signatureBlock?.stampImage || "";

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
  } else if (body.signatureBlock?.signatureImage?.startsWith("data:image")) {
    signatureUrl = await saveBase64ToFile(body.signatureBlock.signatureImage, "signature", uploadDir, urlDir);
  } else if (isRawBase64(body.signatureBlock?.signatureImage)) {
    signatureUrl = await saveBase64ToFile(body.signatureBlock.signatureImage, "signature", uploadDir, urlDir);
  }

  // Handle stamp: file upload → data:image base64 → raw base64
  if (stampFile && typeof stampFile !== "string" && stampFile.name) {
    const bytes = await stampFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}-${stampFile.name}`;
    await fs.writeFile(path.join(uploadDir, fileName), buffer);
    stampUrl = `${urlDir}/${fileName}`;
  } else if (body.signatureBlock?.stampImage?.startsWith("data:image")) {
    stampUrl = await saveBase64ToFile(body.signatureBlock.stampImage, "stamp", uploadDir, urlDir);
  } else if (isRawBase64(body.signatureBlock?.stampImage)) {
    stampUrl = await saveBase64ToFile(body.signatureBlock.stampImage, "stamp", uploadDir, urlDir);
  }

  // Normalize: strip full HTTP URLs to relative paths (frontend adds http://localhost:3000 prefix)
  signatureUrl = normalizeImageUrl(signatureUrl);
  stampUrl = normalizeImageUrl(stampUrl);

  return { signatureUrl, stampUrl };
}

/**
 * Triggers background job for document generation
 */
async function triggerDocumentGeneration(checklistId, operationRef) {
  await createAndScheduleJob(null, "generate-ops-ofd-028", {
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
 * GET /api/operations/sts-checklist/ops-ofd-028?operationRef=2026-001
 * Fetches existing checklist data by operationRef
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

    console.log(`🔍 Searching for OPS-OFD-028 checklist with operationRef: "${operationRef}"`);

    let checklist = await STSChecklist8.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!checklist) {
      checklist = await STSChecklist8.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!checklist) {
      return NextResponse.json(
        { 
          error: `No OPS-OFD-028 checklist found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-028 checklist: ${checklist._id} with operationRef: "${checklist.operationRef}"`);

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
 * PUT /api/operations/sts-checklist/ops-ofd-028?operationRef=2026-001
 * Updates existing checklist by operationRef
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

    console.log(`🔍 Searching for OPS-OFD-028 checklist to update with operationRef: "${operationRef}"`);

    let existing = await STSChecklist8.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!existing) {
      existing = await STSChecklist8.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!existing) {
      return NextResponse.json(
        { 
          error: `No OPS-OFD-028 checklist found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-028 checklist to update: ${existing._id} with operationRef: "${existing.operationRef}"`);

    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(dataStr);

    const { signatureUrl, stampUrl } = await handleSignatureUploads(formData, body, existing);

    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo} → ${revisionNo} for ${operationRef}`);

    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existingDocInfo.formNo || "OPS-OFD-028",
        revisionNo: revisionNo,
        revisionDate: body.documentInfo?.revisionDate ? new Date(body.documentInfo.revisionDate) : existingDocInfo.revisionDate || new Date(),
        approvedBy: body.documentInfo?.approvedBy || existingDocInfo.approvedBy || "JS",
      },
      jobReference: body.jobReference || existing.jobReference || "",
      masterName: body.masterName || existing.masterName || "",
      vesselName: body.vesselName || existing.vesselName || "",
      signedDate: body.signedDate ? new Date(body.signedDate) : existing.signedDate,
      signedTime: body.signedTime || existing.signedTime || "",
      timeZoneLabel: body.timeZoneLabel || existing.timeZoneLabel || "LT",
      signatureBlock: {
        signatureImage: signatureUrl || "",
        stampImage: stampUrl || "",
      },
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedChecklist = await STSChecklist8.findByIdAndUpdate(
      existing._id,
      updateData,
      { new: true, runValidators: true }
    );

    await triggerDocumentGeneration(updatedChecklist._id, updatedChecklist.operationRef);

    void notifyOperationsEdit("OPS-OFD-028", updatedChecklist._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-028 checklist updated successfully & doc regeneration started",
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
