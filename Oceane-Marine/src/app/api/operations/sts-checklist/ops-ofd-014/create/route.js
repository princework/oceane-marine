import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSEquipmentChecklist from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-014";
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

// Initial rows per table (match external form: 3 each)
const INITIAL_ROWS = 3;
const FENDER_ROW = { fenderId: "", endPlates: "", bShackle: "", swivel: "", secondShackle: "", mooringShackle: "", fenderBody: "", tires: "", pressure: "" };
const HOSE_ROW = { hoseId: "", endFlanges: "", bodyCondition: "", nutsBolts: "", markings: "" };
const OTHER_ROW = { equipmentId: "", gaskets: "", ropes: "", wires: "", billyPugh: "", liftingStrops: "" };

function defaultEquipmentRows(count, rowTemplate) {
  return Array.from({ length: count }, () => ({ ...rowTemplate }));
}

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

    // Handle signature file upload if provided
    const signatureFile = formData.get("signature");
    let signatureUrl = body.signatureBlock?.mooringMasterSignature || "";

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

    const revisionNo = await getNextRevisionForCreate(STSEquipmentChecklist);

    // Prepare the document data
    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        formNo: body.documentInfo?.formNo || "OPS-OFD-014",
        revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
        page: body.documentInfo?.page || "1 of 1",
      },
      jobInfo: body.jobInfo || {},
      fenderEquipment: Array.isArray(body.fenderEquipment) && body.fenderEquipment.length > 0
        ? body.fenderEquipment
        : defaultEquipmentRows(INITIAL_ROWS, FENDER_ROW),
      hoseEquipment: Array.isArray(body.hoseEquipment) && body.hoseEquipment.length > 0
        ? body.hoseEquipment
        : defaultEquipmentRows(INITIAL_ROWS, HOSE_ROW),
      otherEquipment: Array.isArray(body.otherEquipment) && body.otherEquipment.length > 0
        ? body.otherEquipment
        : defaultEquipmentRows(INITIAL_ROWS, OTHER_ROW),
      remarks: body.remarks || "",
      signatureBlock: {
        mooringMasterSignature: signatureUrl || "",
      },
      status: body.status || "SUBMITTED",
      createdBy: body.createdBy || undefined,
    };

    /* ================= DUPLICATE SAFETY CHECK ================= */
    // Check for existing document with same operationRef AND operationPhase
    // This allows Before and After Operation to coexist for the same operationRef
    const operationPhase = body.jobInfo?.operationPhase || "BEFORE_OPERATION";
    const existing = await STSEquipmentChecklist.findOne({
      operationRef: body.operationRef,
      "jobInfo.operationPhase": operationPhase,
    }).sort({ createdAt: -1 });

    if (existing) {
      if (existing.sequenceNumber) {
        console.log(`⚠️ OPS-OFD-014 already exists for ${body.operationRef} (${operationPhase}), returning existing`);
        return NextResponse.json(
          {
            message: `Equipment checklist already exists for ${operationPhase === "BEFORE_OPERATION" ? "Before" : "After"} Operation`,
            data: existing,
            isDuplicate: true,
          },
          { status: 200, headers: corsHeaders }
        );
      }
      await STSEquipmentChecklist.findByIdAndDelete(existing._id);
      console.log(`🗑️ Deleted incomplete OPS-OFD-014 without sequenceNumber for ${body.operationRef} (${operationPhase})`);
    }

    /* ================= STEP 1: SAVE DOCUMENT ================= */
    const newChecklist = await STSEquipmentChecklist.create(documentData);
    console.log(`✅ OPS-OFD-014 saved: ${newChecklist._id} with sequenceNumber: ${newChecklist.sequenceNumber}`);

    /* ================= STEP 2: QUEUE BACKGROUND JOB ================= */
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-014", {
        checklistId: newChecklist._id.toString(),
        operationRef: newChecklist.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-014 equipment checklist saved successfully. Document generation queued.",
        data: newChecklist,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-014 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
