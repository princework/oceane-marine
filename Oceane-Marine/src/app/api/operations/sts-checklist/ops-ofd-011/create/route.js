import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSStandingOrder from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-011";
import { getNextRevisionForCreate } from "../../revision.js";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-011.job.js";
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

    // Handle ship stamp file upload if provided
    const stampFile = formData.get("stamp");
    let stampUrl = body.signatureBlock?.shipStampImage;

    if (stampFile && typeof stampFile !== "string" && stampFile.name) {
      const bytes = await stampFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadDir = path.join(process.cwd(), buildOperationsStsSignatureDirs("OPS-OFD-011").physicalDir);
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${stampFile.name}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);
      stampUrl = `${buildOperationsStsSignatureDirs("OPS-OFD-011").urlDir}/${fileName}`;
    }

    const revisionNo = await getNextRevisionForCreate(STSStandingOrder);

    if (!body.operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Prepare the document data
    const documentData = {
      operationRef: body.operationRef.trim(),
      documentInfo: {
        ...(body.documentInfo || {}),
        formNo: body.documentInfo?.formNo || "OPS-OFD-011",
        revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
      },
      superintendentSpecificInstructions: body.superintendentSpecificInstructions || "",
      signatureBlock: {
        masterName: body.signatureBlock?.masterName || "",
        vesselName: body.signatureBlock?.vesselName || "",
        signedDate: body.signatureBlock?.signedDate
          ? new Date(body.signatureBlock.signedDate)
          : undefined,
        signedTime: body.signatureBlock?.signedTime || "",
        shipStampImage: stampUrl || "",
      },
      status: body.status || "DRAFT",
      createdBy: body.createdBy || undefined,
    };

    const newOrder = await STSStandingOrder.create(documentData);

    // Trigger DOCX generation
    if (newOrder.operationRef) {
      try {
        await createAndScheduleJob(null, "generate-ops-ofd-011", {
          checklistId: newOrder._id.toString(),
          operationRef: newOrder.operationRef,
        });
      } catch (err) {
        console.error("Job queue error:", err);
      }
    }

    return NextResponse.json(
      {
        message: "OPS-OFD-011 standing order created successfully. Document generation queued.",
        data: newOrder,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-011 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
