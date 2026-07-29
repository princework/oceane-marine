import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSDeclaration from "@/lib/mongodb/models/operation-sts-checklist/DeclarationOfSea";
import { incrementRevisionForUpdate } from "../../revision.js";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "node:fs/promises";
import path from "node:path";
import "@/jobs/definitions/declaration-of-sea.job.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";
import { buildOperationsStsSignatureDirs } from "@/lib/utils/signature-storage";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function getSignatureUploadDir() {
  return buildOperationsStsSignatureDirs("OPS-OFD-005E");
}

function isRawBase64(str) {
  return (
    str &&
    str.length > 100 &&
    !str.startsWith("/") &&
    !str.startsWith("http") &&
    !str.startsWith("data:")
  );
}

function normalizeImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
  return url;
}

async function saveBase64ToFile(base64Str, uploadDir, urlDir, prefix) {
  const raw = base64Str.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  await fs.mkdir(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${prefix}.png`;
  await fs.writeFile(path.join(uploadDir, fileName), buffer);
  return `${urlDir}/${fileName}`;
}

async function handleSignatureUpload(formData, body, signatureKey, existingSignature = "") {
  const signatureFile = formData.get(signatureKey);
  let signatureUrl = body[signatureKey]?.signature || existingSignature;

  const { physicalDir, urlDir } = getSignatureUploadDir();
  const uploadDir = path.join(process.cwd(), physicalDir);

  if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
    const bytes = await signatureFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}-${signatureFile.name}`;
    await fs.writeFile(path.join(uploadDir, fileName), buffer);
    signatureUrl = `${urlDir}/${fileName}`;
  } else if (body[signatureKey]?.signature?.startsWith("data:image")) {
    signatureUrl = await saveBase64ToFile(body[signatureKey].signature, uploadDir, urlDir, signatureKey);
  } else if (isRawBase64(body[signatureKey]?.signature)) {
    signatureUrl = await saveBase64ToFile(body[signatureKey].signature, uploadDir, urlDir, signatureKey);
  }

  return normalizeImageUrl(signatureUrl);
}

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

async function triggerDocumentGeneration(checklistId, operationRef) {
  await createAndScheduleJob(null, "generate-declaration-of-sea", {
    checklistId,
    operationRef,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function GET(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const declaration = await STSDeclaration.findById(id).lean();

    if (!declaration) {
      return NextResponse.json(
        { error: "Declaration not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: declaration },
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
    const existing = await STSDeclaration.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Declaration not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Handle signature uploads
    const constantHeadingShipSignatureUrl = await handleSignatureUpload(
      formData,
      body,
      "constantHeadingShip",
      existing.constantHeadingShip?.signature
    );
    const manoeuvringShipSignatureUrl = await handleSignatureUpload(
      formData,
      body,
      "manoeuvringShip",
      existing.manoeuvringShip?.signature
    );

    // Increment revision number
    const revisionNo = incrementRevisionForUpdate(existing.revisionNo);
    console.log(`📝 Revision updated: ${existing.revisionNo} → ${revisionNo} for ${id}`);

    const revisionDate = body.revisionDate
      ? new Date(body.revisionDate)
      : body.issueDate
        ? new Date(body.issueDate)
        : existing.revisionDate || existing.issueDate || new Date();

    const updateData = {
      formNo: body.formNo || existing.formNo || "OPS-OFD-005E",
      revisionNo,
      revisionDate,
      issueDate: revisionDate,
      approvedBy: body.approvedBy || existing.approvedBy || "JS",
      page: body.page || existing.page || "1 of 1",
      constantHeadingShipName: body.constantHeadingShipName ?? existing.constantHeadingShipName ?? "",
      manoeuvringShipName: body.manoeuvringShipName ?? existing.manoeuvringShipName ?? "",
      shipOperationType: body.shipOperationType ?? existing.shipOperationType ?? "",
      declarationAccepted:
        body.declarationAccepted !== undefined
          ? body.declarationAccepted
          : existing.declarationAccepted ?? true,
      checklists: (body.checklists || existing.checklists || []).map((item) => ({
        checklistCode: item.checklistCode || "",
        description: item.description || "",
        selection: item.selection || "NOT_APPLICABLE",
      })),
      repetitiveCheckHours:
        body.repetitiveCheckHours !== undefined
          ? Number(body.repetitiveCheckHours)
          : existing.repetitiveCheckHours,
      constantHeadingShip: mapSignatureBlock(
        body,
        "constantHeadingShip",
        constantHeadingShipSignatureUrl,
        existing.constantHeadingShip || {}
      ),
      manoeuvringShip: mapSignatureBlock(
        body,
        "manoeuvringShip",
        manoeuvringShipSignatureUrl,
        existing.manoeuvringShip || {}
      ),
      status: body.status ?? existing.status ?? "DRAFT",
      createdBy: body.createdBy ?? existing.createdBy ?? undefined,
    };

    const updatedDeclaration = await STSDeclaration.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    await triggerDocumentGeneration(updatedDeclaration._id, updatedDeclaration.operationRef);

    void notifyOperationsEdit("OPS-OFD-005E", id);
    return NextResponse.json({
      success: true,
      message: "Declaration updated successfully & doc regeneration started",
      data: updatedDeclaration,
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
