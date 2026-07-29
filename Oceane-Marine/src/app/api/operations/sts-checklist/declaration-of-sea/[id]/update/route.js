import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSDeclaration from "@/lib/mongodb/models/operation-sts-checklist/DeclarationOfSea";
import { incrementRevisionForUpdate } from "../../../revision.js";
import { createAndScheduleJob } from "../../../../../../../jobs/agenda/jobHelper.js";
import fs from "node:fs/promises";
import path from "node:path";
import "../../../../../../../jobs/definitions/declaration-of-sea.job.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";
import { buildOperationsStsSignatureDirs } from "@/lib/utils/signature-storage";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function processSignature(signatureValue, existingSignature, prefix) {
  if (!signatureValue) return existingSignature || "";

  const { physicalDir, urlDir } = getSignatureUploadDir();
  const uploadDir = path.join(process.cwd(), physicalDir);

  if (typeof signatureValue === "string" && signatureValue.startsWith("data:image")) {
    return await saveBase64ToFile(signatureValue, uploadDir, urlDir, prefix);
  }

  if (isRawBase64(signatureValue)) {
    return await saveBase64ToFile(signatureValue, uploadDir, urlDir, prefix);
  }

  return normalizeImageUrl(signatureValue) || existingSignature || "";
}

function sanitizeSignatureBlock(sigData, existingSig, signatureUrl) {
  if (!sigData || typeof sigData !== "object") {
    return existingSig || { name: "", rank: "", signature: "", date: null, time: "" };
  }

  return {
    name: sigData.name ?? existingSig?.name ?? "",
    rank: sigData.rank ?? existingSig?.rank ?? "",
    signature: signatureUrl,
    date: sigData.date ? new Date(sigData.date) : existingSig?.date ?? null,
    time: sigData.time ?? existingSig?.time ?? "",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const body = JSON.parse(dataStr);
    const existing = await STSDeclaration.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Declaration not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Process signatures
    const constantHeadingShipSigUrl = await processSignature(
      body.constantHeadingShip?.signature,
      existing.constantHeadingShip?.signature,
      "constantHeadingShip"
    );

    const manoeuvringShipSigUrl = await processSignature(
      body.manoeuvringShip?.signature,
      existing.manoeuvringShip?.signature,
      "manoeuvringShip"
    );

    // Increment revision
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
      constantHeadingShip: sanitizeSignatureBlock(
        body.constantHeadingShip,
        existing.constantHeadingShip,
        constantHeadingShipSigUrl
      ),
      manoeuvringShip: sanitizeSignatureBlock(
        body.manoeuvringShip,
        existing.manoeuvringShip,
        manoeuvringShipSigUrl
      ),
      status: body.status ?? existing.status ?? "DRAFT",
      createdBy: body.createdBy ?? existing.createdBy ?? undefined,
    };

    const updatedDeclaration = await STSDeclaration.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger document regeneration
    try {
      await createAndScheduleJob(null, "generate-declaration-of-sea", {
        checklistId: updatedDeclaration._id.toString(),
        operationRef: updatedDeclaration.operationRef,
      });
    } catch (jobErr) {
      console.error("Job queue error:", jobErr);
    }

    void notifyOperationsEdit("OPS-OFD-005E", updatedDeclaration._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-005E declaration updated successfully & doc regeneration started",
        data: updatedDeclaration,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("OPS-OFD-005E update error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
