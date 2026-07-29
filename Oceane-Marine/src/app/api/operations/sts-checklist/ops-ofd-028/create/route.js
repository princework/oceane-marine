import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist8 from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-028";
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

    // Handle signature and stamp file uploads if provided
    const signatureFile = formData.get("signature");
    const stampFile = formData.get("stamp");
    let signatureUrl = body.signatureBlock?.signatureImage || "";
    let stampUrl = body.signatureBlock?.stampImage || "";

    const { physicalDir: sigBaseDir, urlDir: sigBaseUrl } = buildOperationsStsSignatureDirs("OPS-OFD-028");
    const uploadDir = path.join(process.cwd(), sigBaseDir);

    // Helper: detect if a string is raw base64 (no data: prefix, no URL path)
    function isRawBase64(str) {
      return str && str.length > 100 && !str.startsWith("/") && !str.startsWith("http") && !str.startsWith("data:");
    }

    // Helper: save base64 string to file and return URL
    async function saveBase64ToFile(base64Str, prefix) {
      // Strip data:image prefix if present
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

    // Handle stamp: file upload → data:image base64 → raw base64
    if (stampFile && typeof stampFile !== "string" && stampFile.name) {
      const bytes = await stampFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${stampFile.name}`;
      await fs.writeFile(path.join(uploadDir, fileName), buffer);
      stampUrl = `${sigBaseUrl}/${fileName}`;
    } else if (stampUrl.startsWith("data:image")) {
      stampUrl = await saveBase64ToFile(stampUrl, "stamp");
    } else if (isRawBase64(stampUrl)) {
      stampUrl = await saveBase64ToFile(stampUrl, "stamp");
    }

    // Normalize: strip full HTTP URLs to relative paths
    signatureUrl = normalizeImageUrl(signatureUrl);
    stampUrl = normalizeImageUrl(stampUrl);

    const revisionNo = await getNextRevisionForCreate(STSChecklist8);

    // Prepare the document data
    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        formNo: body.documentInfo?.formNo || "OPS-OFD-028",
        revisionNo,
        revisionDate: body.documentInfo?.revisionDate ? new Date(body.documentInfo.revisionDate) : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
      },
      jobReference: body.jobReference || "",
      masterName: body.masterName || "",
      vesselName: body.vesselName || "",
      signedDate: body.signedDate ? new Date(body.signedDate) : undefined,
      signedTime: body.signedTime || "",
      timeZoneLabel: body.timeZoneLabel || "LT",
      signatureBlock: {
        signatureImage: signatureUrl || "",
        stampImage: stampUrl || "",
      },
      status: body.status || "SUBMITTED",
      createdBy: body.createdBy || undefined,
    };

    /* ================= DUPLICATE SAFETY CHECK ================= */
    const existing = await STSChecklist8.findOne({
      operationRef: body.operationRef,
    }).sort({ createdAt: -1 });

    if (existing) {
      if (existing.sequenceNumber) {
        console.log(`⚠️ OPS-OFD-028 already exists for ${body.operationRef}, returning existing`);
        return NextResponse.json(
          {
            message: "Checklist already exists",
            data: existing,
            isDuplicate: true,
          },
          { status: 200, headers: corsHeaders }
        );
      }
      await STSChecklist8.findByIdAndDelete(existing._id);
      console.log(`🗑️ Deleted incomplete OPS-OFD-028 without sequenceNumber for ${body.operationRef}`);
    }

    /* ================= STEP 1: SAVE DOCUMENT ================= */
    const newChecklist = await STSChecklist8.create(documentData);
    console.log(`✅ OPS-OFD-028 saved: ${newChecklist._id} with sequenceNumber: ${newChecklist.sequenceNumber}`);

    /* ================= STEP 2: QUEUE BACKGROUND JOB ================= */
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-028", {
        checklistId: newChecklist._id.toString(),
        operationRef: newChecklist.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-028 checklist saved successfully. Document generation queued.",
        data: newChecklist,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-028 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
