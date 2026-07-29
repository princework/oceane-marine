import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSHourlyQuantityLog from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-015";
import { incrementRevisionForUpdate } from "../../../revision";
import { createAndScheduleJob } from "../../../../../../../jobs/agenda/jobHelper.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

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

    const existing = await STSHourlyQuantityLog.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Hourly quantity log not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo} → ${revisionNo} for ${id}`);

    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existingDocInfo.formNo || "OPS-OFD-015",
        revisionNo: revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : existingDocInfo.issueDate || new Date(),
        approvedBy: body.documentInfo?.approvedBy || existingDocInfo.approvedBy || "JS",
      },
      transferInfo: body.transferInfo || existing.transferInfo || {},
      hourlyRecords: (body.hourlyRecords || existing.hourlyRecords || []).map((record) => ({
        serialNumber: record.serialNumber,
        date: record.date ? new Date(record.date) : undefined,
        time: record.time || "",
        dischargedQuantity: record.dischargedQuantity || 0,
        receivedQuantity: record.receivedQuantity || 0,
        differenceQuantity: record.differenceQuantity || 0,
        checkedBy: record.checkedBy || "",
      })),
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedLog = await STSHourlyQuantityLog.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger background job for document regeneration
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-015", {
        checklistId: updatedLog._id.toString(),
        operationRef: updatedLog.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    void notifyOperationsEdit("OPS-OFD-015", updatedLog._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-015 hourly quantity log updated successfully & doc regeneration started",
        data: updatedLog,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-015 update error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
