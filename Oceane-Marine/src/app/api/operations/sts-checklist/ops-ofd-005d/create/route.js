import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklistFiveF from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005D";
import { getNextRevisionForCreate } from "../../revision.js";

import { createAndScheduleJob } from "../../../../../../jobs/agenda/jobHelper.js";

import fs from "node:fs/promises";
import path from "node:path";
import "../../../../../../jobs/definitions/ops-ofd-005d.job.js";
import { buildOperationsStsSignatureDirs } from "@/lib/utils/signature-storage";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  await connectDB();

  try {
    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const body = JSON.parse(dataStr);

    if (!body.operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    /* ================= SIGNATURE UPLOAD ================= */

    const { physicalDir: sigBaseDir, urlDir: sigBaseUrl } = buildOperationsStsSignatureDirs("OPS-OFD-005D");
    const uploadDir = path.join(process.cwd(), sigBaseDir);

    // Helper: detect if a string is raw base64
    function isRawBase64(str) {
      return str && str.length > 100 && !str.startsWith("/") && !str.startsWith("http") && !str.startsWith("data:");
    }

    // Helper: save base64 string to file and return URL
    async function saveBase64ToFile(base64Str, prefix) {
      const raw = base64Str.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(raw, "base64");
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${prefix}.png`;
      await fs.writeFile(path.join(uploadDir, fileName), buffer);
      return `${sigBaseUrl}/${fileName}`;
    }

    // Helper: strip full HTTP URLs back to relative path
    function normalizeImageUrl(url) {
      if (!url) return "";
      if (url.startsWith("http://") || url.startsWith("https://")) {
        try { return new URL(url).pathname; } catch { return url; }
      }
      return url;
    }

    // Handle signatures for all three signature blocks
    async function handleSignature(signatureKey) {
      const signatureFile = formData.get(signatureKey);
      let signatureUrl = body[signatureKey]?.signature || "";

      if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
        const bytes = await signatureFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await fs.mkdir(uploadDir, { recursive: true });
        const fileName = `${Date.now()}-${signatureFile.name}`;
        await fs.writeFile(path.join(uploadDir, fileName), buffer);
        signatureUrl = `${sigBaseUrl}/${fileName}`;
      } else if (signatureUrl.startsWith("data:image")) {
        signatureUrl = await saveBase64ToFile(signatureUrl, signatureKey);
      } else if (isRawBase64(signatureUrl)) {
        signatureUrl = await saveBase64ToFile(signatureUrl, signatureKey);
      }

      return normalizeImageUrl(signatureUrl);
    }

    const terminalBerthedShipSignatureUrl = await handleSignature("terminalBerthedShipSignature");
    const outerShipSignatureUrl = await handleSignature("outerShipSignature");
    const terminalSignatureUrl = await handleSignature("terminalSignature");

    /* ================= REVISION ================= */

    const revisionNo = await getNextRevisionForCreate(STSChecklistFiveF);

    /* ================= DOCUMENT DATA ================= */

    // Transform frontend format to backend format
    // Frontend sends: checklists with checklistCode and selection
    // Backend expects: checklistItems with checklist and boolean fields
    const transformChecklists = (checklists) => {
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
    };

    // Handle both issueDate (frontend) and revisionDate (backend)
    const revisionDate = body.revisionDate 
      ? new Date(body.revisionDate) 
      : body.issueDate 
        ? new Date(body.issueDate) 
        : undefined;

    const documentData = {
      operationRef: body.operationRef,

      formNo: body.formNo || "OPS-OFD-005D",
      revisionNo,
      revisionDate,
      approvedBy: body.approvedBy || "JS",
      page: body.page || "1 of 1",

      terminalBerthedShip: body.terminalBerthedShip || "",
      outerShip: body.outerShip || "",
      terminal: body.terminal || "",

      // Transform checklists from frontend format to backend format
      checklistItems: body.checklistItems 
        ? body.checklistItems.map((item) => ({
            checklist: item.checklist || "",
            description: item.description || "",
            terminalBerthedShip: item.terminalBerthedShip || false,
            outerShip: item.outerShip || false,
            terminal: item.terminal || false,
            notApplicable: item.notApplicable || false,
          }))
        : transformChecklists(body.checklists || []),

      terminalBerthedShipSignature: {
        name: body.terminalBerthedShipSignature?.name || "",
        rank: body.terminalBerthedShipSignature?.rank || "",
        signature: terminalBerthedShipSignatureUrl,
        date: body.terminalBerthedShipSignature?.date
          ? new Date(body.terminalBerthedShipSignature.date)
          : undefined,
        time: body.terminalBerthedShipSignature?.time || "",
      },

      outerShipSignature: {
        name: body.outerShipSignature?.name || "",
        rank: body.outerShipSignature?.rank || "",
        signature: outerShipSignatureUrl,
        date: body.outerShipSignature?.date
          ? new Date(body.outerShipSignature.date)
          : undefined,
        time: body.outerShipSignature?.time || "",
      },

      terminalSignature: {
        name: body.terminalSignature?.name || "",
        rank: body.terminalSignature?.rank || "",
        signature: terminalSignatureUrl,
        date: body.terminalSignature?.date
          ? new Date(body.terminalSignature.date)
          : undefined,
        time: body.terminalSignature?.time || "",
      },

      // Handle both repetitiveCheckHours (frontend) and repetitiveChecksInterval (backend)
      repetitiveChecksInterval: body.repetitiveChecksInterval || 
        (body.repetitiveCheckHours ? String(body.repetitiveCheckHours) : ""),

      status: body.status || "SUBMITTED",
      createdBy: body.createdBy || undefined,
    };

    /* ================= DUPLICATE SAFETY CHECK ================= */
    // Check if document with same operationRef already exists
    const existing = await STSChecklistFiveF.findOne({
      operationRef: body.operationRef
    }).sort({ createdAt: -1 });

    if (existing) {
      // If existing document has sequenceNumber, return it (duplicate prevention)
      if (existing.sequenceNumber) {
        console.log(`⚠️ Document already exists for ${body.operationRef}, returning existing`);
        return NextResponse.json(
          {
            message: "Checklist already exists",
            data: existing,
            isDuplicate: true,
          },
          { status: 200, headers: corsHeaders }
        );
      }
      // If existing document doesn't have sequenceNumber, delete it first (incomplete)
      await STSChecklistFiveF.findByIdAndDelete(existing._id);
      console.log(`🗑️ Deleted incomplete document without sequenceNumber for ${body.operationRef}`);
    }

    /* ================= STEP 1: SAVE DOCUMENT ================= */
    const newChecklist = await STSChecklistFiveF.create(documentData);
    console.log(`✅ Checklist saved successfully: ${newChecklist._id} with sequenceNumber: ${newChecklist.sequenceNumber}`);

    /* ================= STEP 2: QUEUE BACKGROUND JOB (NON-BLOCKING) ================= */
    // Queue job asynchronously - don't wait for it to complete
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-005d", {
        checklistId: newChecklist._id.toString(),
        operationRef: newChecklist.operationRef,
      });

    } catch (err) {
      console.error("Job queue error:", err);
    }


    /* ================= RETURN SUCCESS ================= */
    return NextResponse.json(
      {
        success: true,
        message: "Checklist saved successfully. Document generation queued.",
        data: newChecklist,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Create Error:", error);

    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
