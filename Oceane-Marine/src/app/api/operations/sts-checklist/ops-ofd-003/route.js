import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist3A3B from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-003";
import { incrementRevisionForUpdate } from "../revision.js";
import { createAndScheduleJob } from "../../../../../jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "../../../../../jobs/definitions/ops-ofd-003.job.js";
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
  return buildOperationsStsSignatureDirs("OPS-OFD-003");
}

function isRawBase64(str) {
  return str && str.length > 100 && !str.startsWith("/") && !str.startsWith("http") && !str.startsWith("data:");
}

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

async function saveBase64ToFile(base64Str, uploadDir, urlDir) {
  const raw = base64Str.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  await fs.mkdir(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-signature.png`;
  await fs.writeFile(path.join(uploadDir, fileName), buffer);
  return `${urlDir}/${fileName}`;
}

async function handleSignatureUpload(formData, body, existingSignature = "") {
  const signatureFile = formData.get("signature");
  let signatureUrl = body.signature?.signature || existingSignature;

  const { physicalDir, urlDir } = getSignatureUploadDir();
  const uploadDir = path.join(process.cwd(), physicalDir);

  if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
    const bytes = await signatureFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}-${signatureFile.name}`;
    await fs.writeFile(path.join(uploadDir, fileName), buffer);
    signatureUrl = `${urlDir}/${fileName}`;
  } else if (body.signature?.signature?.startsWith("data:image")) {
    signatureUrl = await saveBase64ToFile(body.signature.signature, uploadDir, urlDir);
  } else if (isRawBase64(body.signature?.signature)) {
    signatureUrl = await saveBase64ToFile(body.signature.signature, uploadDir, urlDir);
  }

  signatureUrl = normalizeImageUrl(signatureUrl);
  return signatureUrl;
}

function buildUpdateData(body, signatureUrl, revisionNo, existing) {
  return {
    documentInfo: {
      formNo: body.formNo || existing.documentInfo?.formNo || "OPS-OFD-003",
      revisionNo,
      issueDate: body.issueDate ? new Date(body.issueDate) : (existing.documentInfo?.issueDate || new Date()),
      approvedBy: body.approvedBy || existing.documentInfo?.approvedBy || "JS",
    },
    transferInfo: {
      constantHeadingShip: body.constantHeadingShip || existing.transferInfo?.constantHeadingShip || "",
      manoeuvringShip: body.manoeuvringShip || existing.transferInfo?.manoeuvringShip || "",
      designatedPOACName: body.designatedPOACName || existing.transferInfo?.designatedPOACName || "",
      stsSuperintendentName: body.stsSuperintendentName || existing.transferInfo?.stsSuperintendentName || "",
      transferDate: body.transferDate ? new Date(body.transferDate) : (existing.transferInfo?.transferDate || undefined),
      transferLocation: body.transferLocation || existing.transferInfo?.transferLocation || "",
    },
    checklist3A: (body.checklist3A || existing.checklist3A || []).map((item) => ({
      clNumber: item.clNumber,
      description: item.description || "",
      status: item.status === "YES" ? "YES" : "NO",
      remarks: item.remarks === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : (item.remarks || ""),
    })),
    checklist3B: (body.checklist3B || existing.checklist3B || []).map((item) => ({
      clNumber: item.clNumber,
      description: item.description || "",
      status: item.status === "YES" ? "YES" : "NO",
      remarks: item.remarks === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : (item.remarks || ""),
    })),
    signature: {
      rank: body.signature?.rank || existing.signature?.rank || "",
      signature: signatureUrl,
      date: body.signature?.date ? new Date(body.signature.date) : (existing.signature?.date || undefined),
    },
    status: body.status || existing.status || "DRAFT",
    createdBy: body.createdBy || existing.createdBy || undefined,
  };
}

async function triggerDocumentGeneration(checklistId, operationRef) {
  await createAndScheduleJob(null, "generate-ops-ofd-003", {
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

    let checklist = await STSChecklist3A3B.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!checklist) {
      checklist = await STSChecklist3A3B.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
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

    let existing = await STSChecklist3A3B.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!existing) {
      existing = await STSChecklist3A3B.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
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

    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(dataStr);

    const signatureUrl = await handleSignatureUpload(formData, body, existing.signature?.signature || "");

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    const updateData = buildUpdateData(body, signatureUrl, revisionNo, existing);

    const updatedChecklist = await STSChecklist3A3B.findByIdAndUpdate(
      existing._id,
      updateData,
      { new: true, runValidators: true }
    );

    await triggerDocumentGeneration(updatedChecklist._id, updatedChecklist.operationRef);

    void notifyOperationsEdit("OPS-OFD-003", updatedChecklist._id);
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
