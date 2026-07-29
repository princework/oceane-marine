import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import ShipStandardQuestionnaire from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-001-A";
import { getNextRevisionForCreate } from "../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-001a.job.js";
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
    let signatureUrl = body.signature?.signature;

    console.log("OPS-OFD-001A Signature handling:", {
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

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-001").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${signatureFile.name}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-001").urlDir}/${fileName}`;
      console.log("Signature saved to:", signatureUrl);
    } else if (body.signature?.signature && body.signature.signature.startsWith("data:image")) {
      // Handle base64 signature from body.signature
      console.log("Processing base64 signature from body.signature");
      const base64Data = body.signature.signature.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-001").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-signature.png`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-001").urlDir}/${fileName}`;
      console.log("Base64 signature saved to:", signatureUrl);
    } else if (body.signature?.signature && !body.signature.signature.startsWith("http") && !body.signature.signature.startsWith("/")) {
      // Handle raw base64 (without data:image prefix)
      console.log("Processing raw base64 signature");
      try {
        const buffer = Buffer.from(body.signature.signature, "base64");
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-001").physicalDir);
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = `${Date.now()}-signature.png`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, buffer);
        signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-001").urlDir}/${fileName}`;
        console.log("Raw base64 signature saved to:", signatureUrl);
      } catch (err) {
        console.error("Failed to process raw base64 signature:", err);
      }
    }

    const revisionNo = await getNextRevisionForCreate(ShipStandardQuestionnaire);

    console.log("[OPS-OFD-001A CREATE] Received body keys:", Object.keys(body));
    console.log("[OPS-OFD-001A CREATE] body.basicInfo:", body.basicInfo);
    console.log("[OPS-OFD-001A CREATE] body.documentInfo:", body.documentInfo);

    // ✅ Read from body.basicInfo and body.documentInfo (matching frontend payload structure)
    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        formNo: body.documentInfo?.formNo || body.formNo || "OPS-OFD-001A",
        revisionNo,
        revisionDate: body.documentInfo?.revisionDate
          ? new Date(body.documentInfo.revisionDate)
          : body.revisionDate
            ? new Date(body.revisionDate)
            : undefined,
        approvedBy: body.documentInfo?.approvedBy || body.approvedBy || "JS",
      },
      basicInfo: {
        proposedLocation: body.basicInfo?.proposedLocation || body.proposedLocation || "",
        shipName: body.basicInfo?.shipName || body.shipName || "",
        date: body.basicInfo?.date
          ? new Date(body.basicInfo.date)
          : body.date
            ? new Date(body.date)
            : undefined,
      },
      responses: body.responses || {},
      signature: {
        name: body.signature?.name || "",
        rank: body.signature?.rank || "",
        signature: signatureUrl || "",
        date: body.signature?.date ? new Date(body.signature.date) : undefined,
      },
      status: body.status || "DRAFT",
      createdBy: body.createdBy || undefined,
    };

    console.log("[OPS-OFD-001A CREATE] Saving basicInfo:", documentData.basicInfo);
    console.log("[OPS-OFD-001A CREATE] Saving documentInfo:", documentData.documentInfo);

    const newQuestionnaire = await ShipStandardQuestionnaire.create(documentData);

    // Schedule DOCX generation job
    await createAndScheduleJob(null, "generate-ops-ofd-001a", {
      checklistId: newQuestionnaire._id.toString(),
      operationRef: newQuestionnaire.operationRef,
    });

    return NextResponse.json(
      {
        message: "OPS-OFD-001A questionnaire created successfully & doc generation started",
        data: newQuestionnaire,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-001A create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
