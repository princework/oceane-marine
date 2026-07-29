import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist3A3B from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-003";
import { getNextRevisionForCreate } from "../../revision.js";
import { createAndScheduleJob } from "../../../../../../jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "../../../../../../jobs/definitions/ops-ofd-003.job.js";
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

    // Handle signature file upload if provided
    const signatureFile = formData.get("signature");
    let signatureUrl = body.signature?.signature || "";

    const { physicalDir, urlDir } = buildOperationsStsSignatureDirs("OPS-OFD-003");
    const uploadDir = path.join(process.cwd(), physicalDir);

    // Helper: detect if a string is raw base64
    function isRawBase64(str) {
      return str && str.length > 100 && !str.startsWith("/") && !str.startsWith("http") && !str.startsWith("data:");
    }

    // Helper: save base64 string to file and return URL
    async function saveBase64ToFile(base64Str) {
      const raw = base64Str.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(raw, "base64");
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-signature.png`;
      await fs.writeFile(path.join(uploadDir, fileName), buffer);
      return `${urlDir}/${fileName}`;
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
      signatureUrl = `${urlDir}/${fileName}`;
    } else if (signatureUrl.startsWith("data:image")) {
      signatureUrl = await saveBase64ToFile(signatureUrl);
    } else if (isRawBase64(signatureUrl)) {
      signatureUrl = await saveBase64ToFile(signatureUrl);
    }

    // Normalize: strip full HTTP URLs to relative paths
    signatureUrl = normalizeImageUrl(signatureUrl);

    const revisionNo = await getNextRevisionForCreate(STSChecklist3A3B);

    // Prepare the document data
    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        formNo: body.formNo || "OPS-OFD-003",
        revisionNo,
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        approvedBy: body.approvedBy || "JS",
      },
      transferInfo: {
        constantHeadingShip: body.constantHeadingShip || "",
        manoeuvringShip: body.manoeuvringShip || "",
        designatedPOACName: body.designatedPOACName || "",
        stsSuperintendentName: body.stsSuperintendentName || "",
        transferDate: body.transferDate ? new Date(body.transferDate) : undefined,
        transferLocation: body.transferLocation || "",
      },
      checklist3A: (body.checklist3A || []).map((item) => ({
        clNumber: item.clNumber,
        description: item.description || "",
        status: item.status === "YES" ? "YES" : "NO",
        remarks: item.remarks === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : (item.remarks || ""),
      })),
      checklist3B: (body.checklist3B || []).map((item) => ({
        clNumber: item.clNumber,
        description: item.description || "",
        status: item.status === "YES" ? "YES" : "NO",
        remarks: item.remarks === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : (item.remarks || ""),
      })),
      signature: {
        rank: body.signature?.rank || "",
        signature: signatureUrl || "",
        date: body.signature?.date ? new Date(body.signature.date) : undefined,
      },
      status: body.status || "DRAFT",
      createdBy: body.createdBy || undefined,
    };

    const newChecklist = await STSChecklist3A3B.create(documentData);

    // Queue background job for document generation
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-003", {
        checklistId: newChecklist._id.toString(),
        operationRef: newChecklist.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-003 checklist created successfully. Document generation queued.",
        data: newChecklist,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-003 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
