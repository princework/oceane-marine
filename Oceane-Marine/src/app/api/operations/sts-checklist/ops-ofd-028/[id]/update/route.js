import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist8 from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-028";
import { incrementRevisionForUpdate } from "../../../revision";
import { createAndScheduleJob } from "../../../../../../../jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";
import { buildOperationsStsSignatureDirs } from "@/lib/utils/signature-storage";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

    const existing = await STSChecklist8.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Handle signature and stamp file uploads if provided
    const signatureFile = formData.get("signature");
    const stampFile = formData.get("stamp");
    let signatureUrl = body.signatureBlock?.signatureImage || existing.signatureBlock?.signatureImage || "";
    let stampUrl = body.signatureBlock?.stampImage || existing.signatureBlock?.stampImage || "";

    const { physicalDir: sigBaseDir, urlDir: sigBaseUrl } = buildOperationsStsSignatureDirs("OPS-OFD-028");
    const uploadDir = path.join(process.cwd(), sigBaseDir);

    // Helper: detect if a string is raw base64 (no data: prefix, no URL path)
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

    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo} → ${revisionNo} for ${id}`);

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
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger background job for document regeneration
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-028", {
        checklistId: updatedChecklist._id.toString(),
        operationRef: updatedChecklist.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    void notifyOperationsEdit("OPS-OFD-028", updatedChecklist._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-028 checklist updated successfully & doc regeneration started",
        data: updatedChecklist,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-028 update error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
