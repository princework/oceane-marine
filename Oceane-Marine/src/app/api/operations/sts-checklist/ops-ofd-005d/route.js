import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklistFiveF from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005D";
import { incrementRevisionForUpdate } from "../revision.js";
import { createAndScheduleJob } from "../../../../../jobs/agenda/jobHelper.js";
import fs from "node:fs/promises";
import path from "node:path";
import "../../../../../jobs/definitions/ops-ofd-005d.job.js";
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
  return buildOperationsStsSignatureDirs("OPS-OFD-005D");
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
 * @param {string} signatureKey - Key for signature in body (e.g., 'terminalBerthedShipSignature')
 * @returns {Promise<string>} - Signature URL (relative path)
 */
async function handleSignatureUpload(formData, body, signatureKey, existingSignature = "") {
  const signatureFile = formData.get(signatureKey);
  let signatureUrl = body[signatureKey]?.signature || existingSignature;

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
  else if (body[signatureKey]?.signature?.startsWith("data:image")) {
    signatureUrl = await saveBase64ToFile(body[signatureKey].signature, uploadDir, urlDir);
  }
  // Handle raw base64 (frontend strips data:image prefix)
  else if (isRawBase64(body[signatureKey]?.signature)) {
    signatureUrl = await saveBase64ToFile(body[signatureKey].signature, uploadDir, urlDir);
  }

  // Normalize: strip full HTTP URLs to relative paths
  signatureUrl = normalizeImageUrl(signatureUrl);

  return signatureUrl;
}

/**
 * Maps request body to signatureBlock schema structure
 * @param {Object} body - Request body
 * @param {string} signatureKey - Key for signature block
 * @param {string} signatureUrl - Processed signature URL
 * @returns {Object} - Signature block object
 */
function mapSignatureBlock(body, signatureKey, signatureUrl, existing = {}) {
  const sigData = body[signatureKey] || {};
  return {
    name: sigData.name ?? existing.name ?? "",
    rank: sigData.rank ?? existing.rank ?? "",
    signature: signatureUrl || existing.signature || "",
    date: sigData.date ? new Date(sigData.date) : existing.date ?? undefined,
    time: sigData.time ?? existing.time ?? "",
  };
}

/**
 * Transforms frontend checklist format to backend format
 * Frontend: { checklistCode, description, selection }
 * Backend: { checklist, description, terminalBerthedShip, outerShip, terminal, notApplicable }
 */
function transformChecklistsToBackend(checklists) {
  if (!checklists || !Array.isArray(checklists)) return [];
  
  return checklists.map((item) => {
    const selection = item.selection || "";
    return {
      checklist: item.checklistCode || item.checklist || "",
      description: item.description || "",
      terminalBerthedShip: selection === "TERMINAL_BERTHED",
      outerShip: selection === "OUTER_SHIP",
      terminal: selection === "TERMINAL",
      notApplicable: selection === "NOT_APPLICABLE",
    };
  });
}

/**
 * Builds document data object for update operations
 * @param {Object} body - Request body
 * @param {Object} signatureUrls - Object with signature URLs
 * @param {string} revisionNo - Revision number
 * @param {Object} existing - Existing document
 * @returns {Object} - Document data object
 */
function buildUpdateData(body, signatureUrls, revisionNo, existing) {
  // Handle both issueDate (frontend) and revisionDate (backend)
  const revisionDate = body.revisionDate 
    ? new Date(body.revisionDate) 
    : body.issueDate 
      ? new Date(body.issueDate) 
      : new Date();

  // Transform checklists if provided in frontend format
  let checklistItems;
  if (body.checklists && Array.isArray(body.checklists)) {
    // Frontend format: checklists with selection
    checklistItems = transformChecklistsToBackend(body.checklists);
  } else if (body.checklistItems && Array.isArray(body.checklistItems)) {
    // Backend format: checklistItems with boolean fields
    checklistItems = body.checklistItems.map((item) => ({
      checklist: item.checklist || "",
      description: item.description || "",
      terminalBerthedShip: item.terminalBerthedShip || false,
      outerShip: item.outerShip || false,
      terminal: item.terminal || false,
      notApplicable: item.notApplicable || false,
    }));
  } else {
    // Use existing data
    checklistItems = (existing.checklistItems || []).map((item) => ({
      checklist: item.checklist || "",
      description: item.description || "",
      terminalBerthedShip: item.terminalBerthedShip || false,
      outerShip: item.outerShip || false,
      terminal: item.terminal || false,
      notApplicable: item.notApplicable || false,
    }));
  }

  return {
    formNo: body.formNo || existing.formNo || "OPS-OFD-005D",
    revisionNo,
    revisionDate,
    approvedBy: body.approvedBy || existing.approvedBy || "JS",
    page: body.page || existing.page || "1 of 1",
    terminalBerthedShip: body.terminalBerthedShip || existing.terminalBerthedShip || "",
    outerShip: body.outerShip || existing.outerShip || "",
    terminal: body.terminal || existing.terminal || "",
    checklistItems,
    terminalBerthedShipSignature: mapSignatureBlock(body, "terminalBerthedShipSignature", signatureUrls.terminalBerthedShip, existing.terminalBerthedShipSignature || {}),
    outerShipSignature: mapSignatureBlock(body, "outerShipSignature", signatureUrls.outerShip, existing.outerShipSignature || {}),
    terminalSignature: mapSignatureBlock(body, "terminalSignature", signatureUrls.terminal, existing.terminalSignature || {}),
    // Handle both repetitiveCheckHours (frontend) and repetitiveChecksInterval (backend)
    repetitiveChecksInterval: body.repetitiveChecksInterval || 
      (body.repetitiveCheckHours ? String(body.repetitiveCheckHours) : "") ||
      existing.repetitiveChecksInterval || "",
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
  await createAndScheduleJob(null, "generate-ops-ofd-005d", {
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
 * GET /api/operations/sts-checklist/ops-ofd-005d?operationRef=2026-001
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
    console.log(`🔍 Searching for OPS-OFD-005D checklist with operationRef: "${operationRef}"`);

    // Try exact match first
    let checklist = await STSChecklistFiveF.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    // If not found, try case-insensitive search
    if (!checklist) {
      console.log(`⚠️ Exact match not found, trying case-insensitive search...`);
      checklist = await STSChecklistFiveF.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    // If still not found, try to find similar patterns for debugging
    if (!checklist) {
      const similar = await STSChecklistFiveF.find({
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
          error: `No OPS-OFD-005D checklist found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-005D checklist: ${checklist._id} with operationRef: "${checklist.operationRef}"`);

    // Transform backend format to frontend format for compatibility
    const transformToFrontendFormat = (data) => {
      // Transform checklistItems to checklists format
      const checklists = (data.checklistItems || []).map((item) => {
        let selection = "";
        if (item.terminalBerthedShip) selection = "TERMINAL_BERTHED";
        else if (item.outerShip) selection = "OUTER_SHIP";
        else if (item.terminal) selection = "TERMINAL";
        else if (item.notApplicable) selection = "NOT_APPLICABLE";

        return {
          checklistCode: item.checklist || "",
          description: item.description || "",
          selection: selection,
        };
      });

      return {
        ...data,
        // Map revisionDate to issueDate for frontend
        issueDate: data.revisionDate ? new Date(data.revisionDate).toISOString().split('T')[0] : undefined,
        // Map checklistItems to checklists
        checklists: checklists,
        // Map repetitiveChecksInterval to repetitiveCheckHours
        repetitiveCheckHours: data.repetitiveChecksInterval || "",
      };
    };

    const transformedData = transformToFrontendFormat(checklist);

    return NextResponse.json(
      { success: true, data: transformedData },
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
 * PUT /api/operations/sts-checklist/ops-ofd-005d?operationRef=2026-001
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

    console.log(`🔍 Searching for OPS-OFD-005D checklist to update with operationRef: "${operationRef}"`);

    // Find existing checklist - try exact match first
    let existing = await STSChecklistFiveF.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    // If not found, try case-insensitive search
    if (!existing) {
      console.log(`⚠️ Exact match not found, trying case-insensitive search...`);
      existing = await STSChecklistFiveF.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    // If still not found, try to find similar patterns for debugging
    if (!existing) {
      const similar = await STSChecklistFiveF.find({
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
          error: `No OPS-OFD-005D checklist found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-005D checklist to update: ${existing._id} with operationRef: "${existing.operationRef}"`);

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

    // Handle signature uploads for all three signature blocks (pass existing signatures as fallback)
    const terminalBerthedShipSignatureUrl = await handleSignatureUpload(formData, body, "terminalBerthedShipSignature", existing.terminalBerthedShipSignature?.signature);
    const outerShipSignatureUrl = await handleSignatureUpload(formData, body, "outerShipSignature", existing.outerShipSignature?.signature);
    const terminalSignatureUrl = await handleSignatureUpload(formData, body, "terminalSignature", existing.terminalSignature?.signature);

    const signatureUrls = {
      terminalBerthedShip: terminalBerthedShipSignatureUrl,
      outerShip: outerShipSignatureUrl,
      terminal: terminalSignatureUrl,
    };

    // Increment revision number
    const revisionNo = incrementRevisionForUpdate(existing.revisionNo);
    console.log(`📝 Revision updated: ${existing.revisionNo} → ${revisionNo} for ${operationRef}`);

    // Build update data
    const updateData = buildUpdateData(body, signatureUrls, revisionNo, existing);

    // Update checklist
    const updatedChecklist = await STSChecklistFiveF.findByIdAndUpdate(
      existing._id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger background job for document regeneration
    await triggerDocumentGeneration(updatedChecklist._id, updatedChecklist.operationRef);

    void notifyOperationsEdit("OPS-OFD-005D", updatedChecklist._id);
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
