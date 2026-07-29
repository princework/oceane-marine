import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSStandingOrder from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-011";
import { incrementRevisionForUpdate } from "../../revision.js";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import "@/jobs/definitions/ops-ofd-011.job.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = params;

    const order = await STSStandingOrder.findById(id).lean();

    if (!order) {
      return NextResponse.json(
        { error: "Standing order not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

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

export async function PUT(req, { params }) {
  await connectDB();

  try {
    const { id } = params;

    const existing = await STSStandingOrder.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Standing order not found" },
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

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    const updateData = {
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

    const updatedOrder = await STSStandingOrder.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    await createAndScheduleJob(null, "generate-ops-ofd-011", {
      checklistId: updatedOrder._id.toString(),
      operationRef: updatedOrder.operationRef,
    });

    void notifyOperationsEdit("OPS-OFD-011", id);
    return NextResponse.json(
      {
        success: true,
        message: "Standing order updated successfully & doc regeneration started",
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
