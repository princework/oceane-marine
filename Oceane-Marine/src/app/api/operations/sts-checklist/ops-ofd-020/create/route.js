import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterFeedbackForm from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-020";
import { getNextRevisionForCreate } from "../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-020.job.js";
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

    // Handle signature file upload
    const signatureFile = formData.get("signature");
    let signatureUrl = body.signature?.stampSignature;

    if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
      const bytes = await signatureFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-020").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${signatureFile.name}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      signatureUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-020").urlDir}/${fileName}`;
    }

    if (!body.operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const revisionNo = await getNextRevisionForCreate(MasterFeedbackForm);

    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        ...(body.documentInfo || {}),
        formNo: body.documentInfo?.formNo || "OPS-OFD-020",
        revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
      },
      jobDetails: body.jobDetails || {},
      performanceItems: body.performanceItems || [],
      overallFeedback: body.overallFeedback || "",
      signature: {
        masterName: body.signature?.masterName || "",
        stampSignature: signatureUrl || "",
        date: body.signature?.date ? new Date(body.signature.date) : undefined,
      },
      status: body.status || "DRAFT",
      createdBy: body.createdBy || undefined,
    };

    const newForm = await MasterFeedbackForm.create(documentData);

    // Trigger DOCX generation
    await createAndScheduleJob(null, "generate-ops-ofd-020", {
      checklistId: newForm._id.toString(),
      operationRef: newForm.operationRef,
    });

    return NextResponse.json(
      {
        message: "OPS-OFD-020 Master Feedback Form created successfully & doc generation started",
        data: newForm,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-020 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
