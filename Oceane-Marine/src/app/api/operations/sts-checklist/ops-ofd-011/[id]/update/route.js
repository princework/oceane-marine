import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSStandingOrder from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-011";
import { incrementRevisionForUpdate } from "../../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-011.job.js";
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

    const existing = await STSStandingOrder.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Standing order not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Handle ship stamp file upload if provided
    const stampFile = formData.get("stamp");
    let stampUrl = body.signatureBlock?.shipStampImage || existing.signatureBlock?.shipStampImage;

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

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    const updateData = {
      documentInfo: {
        ...(body.documentInfo || existing.documentInfo || {}),
        revisionNo,
      },
      superintendentSpecificInstructions:
        body.superintendentSpecificInstructions ||
        existing.superintendentSpecificInstructions ||
        "",
      signatureBlock: {
        masterName: body.signatureBlock?.masterName || existing.signatureBlock?.masterName || "",
        vesselName: body.signatureBlock?.vesselName || existing.signatureBlock?.vesselName || "",
        signedDate: body.signatureBlock?.signedDate
          ? new Date(body.signatureBlock.signedDate)
          : existing.signatureBlock?.signedDate,
        signedTime: body.signatureBlock?.signedTime || existing.signatureBlock?.signedTime || "",
        shipStampImage: stampUrl || "",
      },
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedOrder = await STSStandingOrder.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger DOCX generation
    if (updatedOrder.operationRef) {
      try {
        await createAndScheduleJob(null, "generate-ops-ofd-011", {
          checklistId: updatedOrder._id.toString(),
          operationRef: updatedOrder.operationRef,
        });
      } catch (err) {
        console.error("Job queue error:", err);
      }
    }

    void notifyOperationsEdit("OPS-OFD-011", updatedOrder._id);
    return NextResponse.json(
      {
        message: "OPS-OFD-011 standing order updated successfully. Document regeneration queued.",
        data: updatedOrder,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-011 update error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
