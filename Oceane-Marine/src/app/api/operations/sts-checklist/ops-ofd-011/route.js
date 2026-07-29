import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSStandingOrder from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-011";
import { incrementRevisionForUpdate } from "../revision.js";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-011.job.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";
import { buildOperationsStsSignatureDirs } from "@/lib/utils/signature-storage";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function buildUpdateData(body, revisionNo, existing) {
  return {
    documentInfo: {
      formNo: body.documentInfo?.formNo || body.formNo || existing.documentInfo?.formNo || "OPS-OFD-011",
      revisionNo,
      issueDate: body.documentInfo?.issueDate || body.issueDate
        ? new Date(body.documentInfo?.issueDate || body.issueDate)
        : (existing.documentInfo?.issueDate || new Date()),
      approvedBy: body.documentInfo?.approvedBy || body.approvedBy || existing.documentInfo?.approvedBy || "JS",
    },
    superintendentSpecificInstructions: body.superintendentSpecificInstructions ?? existing.superintendentSpecificInstructions ?? "",
    signatureBlock: {
      masterName: body.signatureBlock?.masterName ?? existing.signatureBlock?.masterName ?? "",
      vesselName: body.signatureBlock?.vesselName ?? existing.signatureBlock?.vesselName ?? "",
      signedDate: body.signatureBlock?.signedDate
        ? new Date(body.signatureBlock.signedDate)
        : (existing.signatureBlock?.signedDate || undefined),
      signedTime: body.signatureBlock?.signedTime ?? existing.signatureBlock?.signedTime ?? "",
      shipStampImage: body.signatureBlock?.shipStampImage ?? existing.signatureBlock?.shipStampImage ?? "",
    },
    status: body.status || existing.status || "DRAFT",
    createdBy: body.createdBy || existing.createdBy || undefined,
  };
}

async function triggerDocumentGeneration(checklistId, operationRef) {
  try {
    await createAndScheduleJob(null, "generate-ops-ofd-011", {
      checklistId: checklistId.toString(),
      operationRef,
    });
  } catch (err) {
    console.error("Job queue error:", err);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    let operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    operationRef = operationRef.trim();

    console.log(`🔍 Searching for OPS-OFD-011 standing order with operationRef: "${operationRef}"`);

    let order = await STSStandingOrder.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!order) {
      order = await STSStandingOrder.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!order) {
      return NextResponse.json(
        { 
          error: `No OPS-OFD-011 standing order found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-011 standing order: ${order._id} with operationRef: "${order.operationRef}"`);

    return NextResponse.json(
      { success: true, data: order },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function PUT(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    let operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    operationRef = operationRef.trim();

    let existing = await STSStandingOrder.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!existing) {
      existing = await STSStandingOrder.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!existing) {
      return NextResponse.json(
        { 
          error: `No standing order found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(dataStr);

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

    const updateData = buildUpdateData(body, revisionNo, existing);
    if (stampUrl) {
      updateData.signatureBlock.shipStampImage = stampUrl;
    }

    const updatedOrder = await STSStandingOrder.findByIdAndUpdate(
      existing._id,
      updateData,
      { new: true, runValidators: true }
    );

    await triggerDocumentGeneration(updatedOrder._id, updatedOrder.operationRef);

    void notifyOperationsEdit("OPS-OFD-011", updatedOrder._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-011 standing order updated successfully. Document regeneration queued.",
        data: updatedOrder,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
