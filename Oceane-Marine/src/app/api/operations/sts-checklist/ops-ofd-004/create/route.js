import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist4AF from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-004";
import { getNextRevisionForCreate } from "../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-004.job.js";
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

    // Handle signature file upload if provided
    const signatureFile = formData.get("signature");
    let signatureUrl = body.signatureBlock?.signature || body.signature?.signature;

    console.log("OPS-OFD-004 Signature handling:", {
      signatureFileExists: !!signatureFile,
      signatureFileType: typeof signatureFile,
      signatureFileName: signatureFile?.name,
      bodySignature: body.signature?.signature?.substring(0, 50) + "..."
    });

    if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
      console.log("Processing signature file upload:", signatureFile.name);
      const bytes = await signatureFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-004").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${signatureFile.name}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-004").urlDir}/${fileName}`;
      console.log("Signature saved to:", signatureUrl);
    } else if ((body.signatureBlock?.signature || body.signature?.signature) && (body.signatureBlock?.signature || body.signature?.signature).startsWith("data:image")) {
      // Handle base64 signature from body.signature or signatureBlock
      console.log("Processing base64 signature from body.signature or signatureBlock");
      const signatureData = body.signatureBlock?.signature || body.signature?.signature;
      const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-004").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-signature.png`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-004").urlDir}/${fileName}`;
      console.log("Base64 signature saved to:", signatureUrl);
    } else if ((body.signatureBlock?.signature || body.signature?.signature) && !(body.signatureBlock?.signature || body.signature?.signature).startsWith("http") && !(body.signatureBlock?.signature || body.signature?.signature).startsWith("/")) {
      // Handle raw base64 from body.signature or signatureBlock (without data:image prefix)
      console.log("Processing raw base64 from body.signature or signatureBlock");
      const signatureData = body.signatureBlock?.signature || body.signature?.signature;
      try {
        const buffer = Buffer.from(signatureData, "base64");
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-004").physicalDir);
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = `${Date.now()}-signature.png`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, buffer);
        signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-004").urlDir}/${fileName}`;
        console.log("Raw base64 signature saved to:", signatureUrl);
      } catch (err) {
        console.error("Failed to process raw base64 signature:", err);
      }
    }

    const revisionNo = await getNextRevisionForCreate(STSChecklist4AF);

    // Prepare the document data - map frontend fields to schema
    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        formNo: body.documentInfo?.formNo || body.formNo || "OPS-OFD-004",
        revisionNo,
        revisionDate: body.documentInfo?.revisionDate || body.revisionDate ? new Date(body.documentInfo?.revisionDate || body.revisionDate) : undefined,
        approvedBy: body.documentInfo?.approvedBy || body.approvedBy || "JS",
        page: body.documentInfo?.page || body.page || "",
      },
      transferInfo: body.transferInfo || {},
      checklist4A: body.checklist4A || {},
      checklist4B: body.checklist4B || {},
      checklist4C: body.checklist4C || [],
      checklist4D: body.checklist4D || [],
      checklist4E: body.checklist4E || {},
      checklist4F: body.checklist4F || {},
      signature: {
        name: body.signature?.name || "",
        rank: body.signature?.rank || "",
        signature: signatureUrl || "",
        date: body.signature?.date ? new Date(body.signature.date) : undefined,
      },
      status: body.status || "DRAFT",
      createdBy: body.createdBy || undefined,
    };

    const newChecklist = await STSChecklist4AF.create(documentData);

    // Schedule DOCX generation job
    await createAndScheduleJob(null, "generate-ops-ofd-004", {
      checklistId: newChecklist._id.toString(),
      operationRef: newChecklist.operationRef,
    });

    return NextResponse.json(
      {
        message: "OPS-OFD-004 checklist created successfully & doc generation started",
        data: newChecklist,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-004 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
