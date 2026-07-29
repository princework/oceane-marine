import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist4AF from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-004";
import { incrementRevisionForUpdate } from "../../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-004.job.js";
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

    // Get existing checklist
    const existing = await STSChecklist4AF.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Handle signature file upload if provided
    const signatureFile = formData.get("signature");
    let signatureUrl = body.signature?.signature || existing.signature?.signature;

    if (signatureFile && typeof signatureFile !== "string" && signatureFile.name) {
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
    }

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    // Prepare update data - merge with existing
    const updateData = {
      documentInfo: {
        ...(body.documentInfo || existing.documentInfo || {}),
        revisionNo,
      },
      transferInfo: body.transferInfo || existing.transferInfo || {},
      checklist4A: body.checklist4A || existing.checklist4A || {},
      checklist4B: body.checklist4B || existing.checklist4B || {},
      checklist4C: body.checklist4C || existing.checklist4C || [],
      checklist4D: body.checklist4D || existing.checklist4D || [],
      checklist4E: body.checklist4E || existing.checklist4E || {},
      checklist4F: body.checklist4F || existing.checklist4F || {},
      signature: {
        name: body.signature?.name || existing.signature?.name || "",
        rank: body.signature?.rank || existing.signature?.rank || "",
        signature: signatureUrl || "",
        date: body.signature?.date
          ? new Date(body.signature.date)
          : existing.signature?.date,
      },
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedChecklist = await STSChecklist4AF.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Schedule DOCX regeneration job
    await createAndScheduleJob(null, "generate-ops-ofd-004", {
      checklistId: updatedChecklist._id.toString(),
      operationRef: updatedChecklist.operationRef,
    });

    void notifyOperationsEdit("OPS-OFD-004", updatedChecklist._id);
    return NextResponse.json(
      {
        message: "OPS-OFD-004 checklist updated successfully & doc regeneration started",
        data: updatedChecklist,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-004 update error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
