import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSEquipmentChecklist from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-014";
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

    const existing = await STSEquipmentChecklist.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Equipment checklist not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Handle signature file upload if provided
    const signatureFile = formData.get("signature");
    let signatureUrl = body.signatureBlock?.mooringMasterSignature || existing.signatureBlock?.mooringMasterSignature || "";

    const { physicalDir: sigBaseDir, urlDir: sigBaseUrl } = buildOperationsStsSignatureDirs("OPS-OFD-014");
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

    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo} → ${revisionNo} for ${id}`);

    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existingDocInfo.formNo || "OPS-OFD-014",
        revisionNo: revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : existingDocInfo.issueDate || new Date(),
        approvedBy: body.documentInfo?.approvedBy || existingDocInfo.approvedBy || "JS",
        page: body.documentInfo?.page || existingDocInfo.page || "1 of 1",
      },
      jobInfo: body.jobInfo || existing.jobInfo || {},
      fenderEquipment: body.fenderEquipment || existing.fenderEquipment || [],
      hoseEquipment: body.hoseEquipment || existing.hoseEquipment || [],
      otherEquipment: body.otherEquipment || existing.otherEquipment || [],
      remarks: body.remarks || existing.remarks || "",
      signatureBlock: {
        mooringMasterSignature: signatureUrl || "",
      },
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedChecklist = await STSEquipmentChecklist.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger background job for document regeneration
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-014", {
        checklistId: updatedChecklist._id.toString(),
        operationRef: updatedChecklist.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    void notifyOperationsEdit("OPS-OFD-014", updatedChecklist._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-014 equipment checklist updated successfully & doc regeneration started",
        data: updatedChecklist,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-014 update error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
