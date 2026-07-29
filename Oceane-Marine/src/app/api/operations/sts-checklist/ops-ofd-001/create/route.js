import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklistOne from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-001";
import { getNextRevisionForCreate } from "../../revision.js";

import { createAndScheduleJob } from "../../../../../../jobs/agenda/jobHelper.js";

import fs from "fs/promises";
import path from "path";
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

    const signatureFile = formData.get("signature");
    let signatureUrl = body.signatureBlock?.signature || "";

    const { physicalDir: sigBaseDir, urlDir: sigBaseUrl } = buildOperationsStsSignatureDirs("OPS-OFD-001");
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

    // Handle signature: file upload → data:image base64 → raw base64
    if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
      const bytes = await signatureFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${signatureFile.name}`;
      await fs.writeFile(path.join(uploadDir, fileName), buffer);
      signatureUrl = `${sigBaseUrl}/${fileName}`;
    } else if (signatureUrl.startsWith("data:image")) {
      signatureUrl = await saveBase64ToFile(signatureUrl, "signature");
    } else if (isRawBase64(signatureUrl)) {
      signatureUrl = await saveBase64ToFile(signatureUrl, "signature");
    }

    // Normalize: strip full HTTP URLs to relative paths
    signatureUrl = normalizeImageUrl(signatureUrl);

    /* ================= REVISION ================= */

    const revisionNo = await getNextRevisionForCreate(STSChecklistOne);

    /* ================= DOCUMENT DATA ================= */

    // Handle both nested (body.vesselDetails) and flat (body.vesselName) structures
    const vesselData = body.vesselDetails || {};

    const documentData = {
      operationRef: body.operationRef,

      formNo: body.formNo || "OPS-OFD-001",
      revisionNo,
      revisionDate: body.revisionDate ? new Date(body.revisionDate) : undefined,
      approvedBy: body.approvedBy || "JS",
      page: body.page || "",

      vesselDetails: {
        vesselName: vesselData.vesselName || body.vesselName || "",
        shipOperator: vesselData.shipOperator || body.shipOperator || "",
        charterer: vesselData.charterer || body.charterer || "",
        stsOrganizer: vesselData.stsOrganizer || body.stsOrganizer || "",
        plannedTransferDateTime: vesselData.plannedTransferDateTime || body.plannedDateAndTime || body.plannedTransferDateTime
          ? new Date(vesselData.plannedTransferDateTime || body.plannedDateAndTime || body.plannedTransferDateTime)
          : undefined,
        transferLocation: vesselData.transferLocation || body.transferLocation || "",
        cargo: vesselData.cargo || body.cargo || "",
        constantHeadingOrBerthedShip: vesselData.constantHeadingOrBerthedShip || body.constantHeadingShip || body.constantHeadingOrBerthedShip || "",
        manoeuvringOrOuterShip: vesselData.manoeuvringOrOuterShip || body.maneuveringShip || body.manoeuvringOrOuterShip || "",
        poacOrStsSuperintendent: vesselData.poacOrStsSuperintendent || body.poacStsSuperintendent || "",
        applicableJointPlanOperation:
          vesselData.applicableJointPlanOperation || body.applicableSpecificJointPlanOperation || body.applicableJointPlanOperation || "",
      },

      genericChecks: (body.genericChecks || []).map((check) => ({
        clNumber: check.id || check.clNumber,
        description: check.description || "",
        status: check.status
          ? "YES"
          : check.notApplicable
            ? "NOT_APPLICABLE"
            : "NO",
        remarks: check.userRemark || check.remarks || "",
      })),

      signatureBlock: {
        name: body.signatureBlock?.name || body.signature?.name || "",
        rank: body.signatureBlock?.rank || body.signature?.rank || "",
        signature: signatureUrl,
        date: body.signatureBlock?.date || body.signature?.date
          ? new Date(body.signatureBlock?.date || body.signature?.date)
          : undefined,
      },

      status: body.status || "SUBMITTED",
      createdBy: body.createdBy || undefined,
    };

    /* ================= DUPLICATE SAFETY CHECK ================= */
    // Check if document with same operationRef already exists
    const existing = await STSChecklistOne.findOne({
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
      await STSChecklistOne.findByIdAndDelete(existing._id);
      console.log(`🗑️ Deleted incomplete document without sequenceNumber for ${body.operationRef}`);
    }

    /* ================= STEP 1: SAVE DOCUMENT ================= */
    const newChecklist = await STSChecklistOne.create(documentData);
    console.log(`✅ Checklist saved successfully: ${newChecklist._id} with sequenceNumber: ${newChecklist.sequenceNumber}`);

    /* ================= STEP 2: QUEUE BACKGROUND JOB (NON-BLOCKING) ================= */
    // Queue job asynchronously - don't wait for it to complete
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-001", {
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
