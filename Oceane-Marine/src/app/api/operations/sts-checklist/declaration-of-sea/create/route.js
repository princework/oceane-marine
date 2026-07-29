import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSDeclaration from "@/lib/mongodb/models/operation-sts-checklist/DeclarationOfSea";
import { getNextRevisionForCreate } from "../../revision.js";
import { createAndScheduleJob } from "../../../../../../jobs/agenda/jobHelper.js";
import fs from "node:fs/promises";
import path from "node:path";
import "../../../../../../jobs/definitions/declaration-of-sea.job.js";
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
    // Accept both JSON and FormData
    let body;
    let formData = null;
    
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      formData = await req.formData();
      const dataStr = formData.get("data");
      if (!dataStr) {
        return NextResponse.json(
          { error: "Form data is required" },
          { status: 400, headers: corsHeaders }
        );
      }
      body = JSON.parse(dataStr);
    } else {
      body = await req.json();
    }

    if (!body.operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    /* ================= SIGNATURE UPLOAD ================= */

    const { physicalDir: sigBaseDir, urlDir: sigBaseUrl } = buildOperationsStsSignatureDirs("OPS-OFD-005E");
    const uploadDir = path.join(process.cwd(), sigBaseDir);

    // Helper: detect if a string is raw base64
    function isRawBase64(str) {
      return (
        str &&
        str.length > 100 &&
        !str.startsWith("/") &&
        !str.startsWith("http") &&
        !str.startsWith("data:")
      );
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
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      }
      return url;
    }

    // Handle signatures for both signature blocks
    async function handleSignature(signatureKey) {
      // 1) If FormData was used, check for file upload first
      if (formData) {
        const signatureFile = formData.get(signatureKey);
        if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
          const bytes = await signatureFile.arrayBuffer();
          const buffer = Buffer.from(bytes);
          await fs.mkdir(uploadDir, { recursive: true });
          const fileName = `${Date.now()}-${signatureFile.name}`;
          await fs.writeFile(path.join(uploadDir, fileName), buffer);
          console.log(`📎 Signature file uploaded for ${signatureKey}: ${sigBaseUrl}/${fileName}`);
          return `${sigBaseUrl}/${fileName}`;
        }
      }

      // 2) Check nested signature inside the body object (e.g. body.constantHeadingShip.signature)
      let signatureUrl = body[signatureKey]?.signature || "";

      if (signatureUrl.startsWith("data:image")) {
        console.log(`📎 Saving base64 data:image signature for ${signatureKey}`);
        signatureUrl = await saveBase64ToFile(signatureUrl, signatureKey);
      } else if (isRawBase64(signatureUrl)) {
        console.log(`📎 Saving raw base64 signature for ${signatureKey}`);
        signatureUrl = await saveBase64ToFile(signatureUrl, signatureKey);
      }

      const result = normalizeImageUrl(signatureUrl);
      if (result) {
        console.log(`✅ Signature resolved for ${signatureKey}: ${result}`);
      } else {
        console.log(`ℹ️ No signature provided for ${signatureKey}`);
      }
      return result;
    }

    const constantHeadingShipSignatureUrl = await handleSignature("constantHeadingShip");
    const manoeuvringShipSignatureUrl = await handleSignature("manoeuvringShip");

    /* ================= REVISION ================= */

    const revisionNo = await getNextRevisionForCreate(STSDeclaration);

    /* ================= DOCUMENT DATA ================= */

    // Handle both issueDate (frontend) and revisionDate (backend)
    const revisionDate = body.revisionDate
      ? new Date(body.revisionDate)
      : body.issueDate
        ? new Date(body.issueDate)
        : new Date();

    const documentData = {
      operationRef: body.operationRef,
      formNo: body.formNo || "OPS-OFD-005E",
      revisionNo,
      revisionDate,
      issueDate: revisionDate, // Keep for backward compatibility
      approvedBy: body.approvedBy || "JS",
      page: body.page || "1 of 1",
      constantHeadingShipName: body.constantHeadingShipName || "",
      manoeuvringShipName: body.manoeuvringShipName || "",
      shipOperationType: body.shipOperationType || "",
      declarationAccepted: body.declarationAccepted !== undefined ? body.declarationAccepted : true,
      checklists: (body.checklists || []).map((item) => ({
        checklistCode: item.checklistCode || "",
        description: item.description || "",
        selection: item.selection || "NOT_APPLICABLE",
      })),
      repetitiveCheckHours: body.repetitiveCheckHours
        ? Number(body.repetitiveCheckHours)
        : undefined,
      constantHeadingShip: {
        name: body.constantHeadingShip?.name || "",
        rank: body.constantHeadingShip?.rank || "",
        signature: constantHeadingShipSignatureUrl,
        date: body.constantHeadingShip?.date
          ? new Date(body.constantHeadingShip.date)
          : undefined,
        time: body.constantHeadingShip?.time || "",
      },
      manoeuvringShip: {
        name: body.manoeuvringShip?.name || "",
        rank: body.manoeuvringShip?.rank || "",
        signature: manoeuvringShipSignatureUrl,
        date: body.manoeuvringShip?.date
          ? new Date(body.manoeuvringShip.date)
          : undefined,
        time: body.manoeuvringShip?.time || "",
      },
      status: body.status || "SUBMITTED",
      createdBy: body.createdBy || undefined,
    };

    /* ================= DUPLICATE SAFETY CHECK ================= */
    const existing = await STSDeclaration.findOne({
      operationRef: body.operationRef,
    })
      .sort({ createdAt: -1 })
      .lean();

    let savedDeclaration;

    if (existing) {
      if (existing.sequenceNumber) {
        console.log(
          `⚠️ Document already exists for ${body.operationRef}, updating with new data`
        );

        // Update existing document with the new submitted data
        savedDeclaration = await STSDeclaration.findByIdAndUpdate(
          existing._id,
          documentData,
          { new: true, runValidators: true }
        );
        console.log(`✅ Existing declaration updated: ${savedDeclaration._id}`);
      } else {
        await STSDeclaration.findByIdAndDelete(existing._id);
        console.log(
          `🗑️ Deleted incomplete document without sequenceNumber for ${body.operationRef}`
        );
      }
    }

    if (!savedDeclaration) {
      /* ================= STEP 1: SAVE NEW DOCUMENT ================= */
      savedDeclaration = await STSDeclaration.create(documentData);
      console.log(
        `✅ Declaration saved successfully: ${savedDeclaration._id} with sequenceNumber: ${savedDeclaration.sequenceNumber}`
      );
    }

    /* ================= STEP 2: QUEUE BACKGROUND JOB (NON-BLOCKING) ================= */
    try {
      await createAndScheduleJob(null, "generate-declaration-of-sea", {
        checklistId: savedDeclaration._id.toString(),
        operationRef: savedDeclaration.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    /* ================= RETURN SUCCESS ================= */
    return NextResponse.json(
      {
        success: true,
        message: "Declaration saved successfully. Document generation queued.",
        data: savedDeclaration,
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
