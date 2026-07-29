import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklistFiveF from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005D";
import { incrementRevisionForUpdate } from "../../../revision";
import { createAndScheduleJob } from "../../../../../../../jobs/agenda/jobHelper.js";
import fs from "node:fs/promises";
import path from "node:path";
import "../../../../../../../jobs/definitions/ops-ofd-005d.job.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";
import { buildOperationsStsSignatureDirs } from "@/lib/utils/signature-storage";

// ==================== CONSTANTS ====================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ==================== HELPERS ====================

function getSignatureUploadDir() {
  return buildOperationsStsSignatureDirs("OPS-OFD-005D");
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

/**
 * Processes a signature value from the request body:
 * - If it's a base64 string (data:image or raw), saves to file and returns path
 * - If it's an existing relative URL path, returns as-is
 * - Falls back to existing signature from DB
 */
async function processSignature(signatureValue, existingSignature, prefix) {
  if (!signatureValue) return existingSignature || "";

  const { physicalDir, urlDir } = getSignatureUploadDir();
  const uploadDir = path.join(process.cwd(), physicalDir);

  // Handle data:image base64
  if (typeof signatureValue === "string" && signatureValue.startsWith("data:image")) {
    return await saveBase64ToFile(signatureValue, uploadDir, urlDir, prefix);
  }

  // Handle raw base64 (frontend may strip data:image prefix)
  if (isRawBase64(signatureValue)) {
    return await saveBase64ToFile(signatureValue, uploadDir, urlDir, prefix);
  }

  // Normalize: strip full HTTP URLs to relative paths
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

// ==================== ROUTE HANDLERS ====================

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

    // Get existing checklist
    const existing = await STSChecklistFiveF.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // ==================== HANDLE SIGNATURES ====================
    // Process each signature: save base64 to file if new, keep existing if unchanged
    const terminalBerthedShipSigUrl = await processSignature(
      body.terminalBerthedShipSignature?.signature,
      existing.terminalBerthedShipSignature?.signature,
      "terminalBerthedShip"
    );

    const outerShipSigUrl = await processSignature(
      body.outerShipSignature?.signature,
      existing.outerShipSignature?.signature,
      "outerShip"
    );

    const terminalSigUrl = await processSignature(
      body.terminalSignature?.signature,
      existing.terminalSignature?.signature,
      "terminal"
    );

    // ==================== REVISION ====================
    const revisionNo = incrementRevisionForUpdate(existing.revisionNo);
    console.log(`📝 Revision updated: ${existing.revisionNo} → ${revisionNo} for ${id}`);

    // ==================== TRANSFORM CHECKLISTS ====================
    let checklistItems;

    if (body.checklists && Array.isArray(body.checklists)) {
      // Frontend format: checklists with selection
      checklistItems = body.checklists.map((item) => {
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

    // ==================== BUILD UPDATE DATA ====================
    const revisionDate = body.revisionDate
      ? new Date(body.revisionDate)
      : body.issueDate
        ? new Date(body.issueDate)
        : existing.revisionDate || new Date();

    const updateData = {
      formNo: body.formNo || existing.formNo || "OPS-OFD-005D",
      revisionNo,
      revisionDate,
      approvedBy: body.approvedBy || existing.approvedBy || "JS",
      page: body.page || existing.page || "1 of 1",
      terminalBerthedShip: body.terminalBerthedShip ?? existing.terminalBerthedShip ?? "",
      outerShip: body.outerShip ?? existing.outerShip ?? "",
      terminal: body.terminal ?? existing.terminal ?? "",
      checklistItems,
      terminalBerthedShipSignature: sanitizeSignatureBlock(
        body.terminalBerthedShipSignature,
        existing.terminalBerthedShipSignature,
        terminalBerthedShipSigUrl
      ),
      outerShipSignature: sanitizeSignatureBlock(
        body.outerShipSignature,
        existing.outerShipSignature,
        outerShipSigUrl
      ),
      terminalSignature: sanitizeSignatureBlock(
        body.terminalSignature,
        existing.terminalSignature,
        terminalSigUrl
      ),
      repetitiveChecksInterval:
        body.repetitiveChecksInterval ||
        (body.repetitiveCheckHours ? String(body.repetitiveCheckHours) : "") ||
        existing.repetitiveChecksInterval ||
        "",
      status: body.status ?? existing.status ?? "DRAFT",
      createdBy: body.createdBy ?? existing.createdBy ?? undefined,
    };

    // ==================== UPDATE DOCUMENT ====================
    const updatedChecklist = await STSChecklistFiveF.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // ==================== TRIGGER DOC REGENERATION ====================
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-005d", {
        checklistId: updatedChecklist._id.toString(),
        operationRef: updatedChecklist.operationRef,
      });
    } catch (jobErr) {
      console.error("Job queue error:", jobErr);
    }

    void notifyOperationsEdit("OPS-OFD-005D", updatedChecklist._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-005D checklist updated successfully & doc regeneration started",
        data: updatedChecklist,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("OPS-OFD-005D update error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
