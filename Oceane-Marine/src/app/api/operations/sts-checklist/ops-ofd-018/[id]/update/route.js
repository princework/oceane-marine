import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSTimesheet from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-018";
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

    const existing = await STSTimesheet.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Timesheet not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo} → ${revisionNo} for ${id}`);

    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existingDocInfo.formNo || "OPS-OFD-018",
        revisionNo: revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : existingDocInfo.issueDate || new Date(),
        approvedBy: body.documentInfo?.approvedBy || existingDocInfo.approvedBy || "JS",
        page: body.documentInfo?.page ?? existingDocInfo.page ?? "1 of 1",
      },
      basicInfo: body.basicInfo || existing.basicInfo || {},
      operationTimings: (body.operationTimings || existing.operationTimings || []).map((timing) => ({
        activityName: timing.activityName || "",
        fromDate: timing.fromDate ? new Date(timing.fromDate) : undefined,
        fromTime: timing.fromTime || "",
        toDate: timing.toDate ? new Date(timing.toDate) : undefined,
        toTime: timing.toTime || "",
        remarks: timing.remarks || "",
      })),
      additionalActivities: (body.additionalActivities || existing.additionalActivities || []).map((timing) => ({
        activityName: timing.activityName || "",
        fromDate: timing.fromDate ? new Date(timing.fromDate) : undefined,
        fromTime: timing.fromTime || "",
        toDate: timing.toDate ? new Date(timing.toDate) : undefined,
        toTime: timing.toTime || "",
        remarks: timing.remarks || "",
      })),
      weatherDelay: body.weatherDelay || existing.weatherDelay || {},
      cargoInfo: body.cargoInfo || existing.cargoInfo || {},
      finalRemarks: body.finalRemarks || existing.finalRemarks || "",
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedTimesheet = await STSTimesheet.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger background job for document regeneration
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-018", {
        checklistId: updatedTimesheet._id.toString(),
        operationRef: updatedTimesheet.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    void notifyOperationsEdit("OPS-OFD-018", updatedTimesheet._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-018 timesheet updated successfully & doc regeneration started",
        data: updatedTimesheet,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-018 update error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
