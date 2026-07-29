import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterFeedbackForm from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-020";
import { incrementRevisionForUpdate } from "../../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-020.job.js";
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

    const existing = await MasterFeedbackForm.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Form not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const signatureFile = formData.get("signature");
    let signatureUrl = body.signature?.stampSignature || existing.signature?.stampSignature;

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

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    const updateData = {
      documentInfo: {
        ...(body.documentInfo || existing.documentInfo || {}),
        revisionNo,
      },
      jobDetails: body.jobDetails || existing.jobDetails || {},
      performanceItems: body.performanceItems || existing.performanceItems || [],
      overallFeedback: body.overallFeedback ?? existing.overallFeedback ?? "",
      signature: {
        masterName: body.signature?.masterName || existing.signature?.masterName || "",
        stampSignature: signatureUrl || "",
        date: body.signature?.date
          ? new Date(body.signature.date)
          : existing.signature?.date,
      },
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedForm = await MasterFeedbackForm.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger DOCX generation
    await createAndScheduleJob(null, "generate-ops-ofd-020", {
      checklistId: updatedForm._id.toString(),
      operationRef: updatedForm.operationRef,
    });

    void notifyOperationsEdit("OPS-OFD-020", updatedForm._id);
    return NextResponse.json(
      {
        message: "OPS-OFD-020 Form updated successfully & doc regeneration started",
        data: updatedForm,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-020 update error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
