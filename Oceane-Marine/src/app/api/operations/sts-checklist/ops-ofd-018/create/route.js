import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSTimesheet from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-018";
import { getNextRevisionForCreate } from "../../revision.js";
import { createAndScheduleJob } from "../../../../../../jobs/agenda/jobHelper.js";

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

    if (!body.operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const revisionNo = await getNextRevisionForCreate(STSTimesheet);

    // Prepare the document data
    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        formNo: body.documentInfo?.formNo || "OPS-OFD-018",
        revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
        page: body.documentInfo?.page ?? "1 of 1",
      },
      basicInfo: body.basicInfo || {},
      operationTimings: (body.operationTimings || []).map((timing) => ({
        activityName: timing.activityName || "",
        fromDate: timing.fromDate ? new Date(timing.fromDate) : undefined,
        fromTime: timing.fromTime || "",
        toDate: timing.toDate ? new Date(timing.toDate) : undefined,
        toTime: timing.toTime || "",
        remarks: timing.remarks || "",
      })),
      additionalActivities: (body.additionalActivities || []).map((timing) => ({
        activityName: timing.activityName || "",
        fromDate: timing.fromDate ? new Date(timing.fromDate) : undefined,
        fromTime: timing.fromTime || "",
        toDate: timing.toDate ? new Date(timing.toDate) : undefined,
        toTime: timing.toTime || "",
        remarks: timing.remarks || "",
      })),
      weatherDelay: body.weatherDelay || {},
      cargoInfo: body.cargoInfo || {},
      finalRemarks: body.finalRemarks || "",
      status: body.status || "SUBMITTED",
      createdBy: body.createdBy || undefined,
    };

    /* ================= DUPLICATE SAFETY CHECK ================= */
    const existing = await STSTimesheet.findOne({
      operationRef: body.operationRef,
    }).sort({ createdAt: -1 });

    if (existing) {
      if (existing.sequenceNumber) {
        console.log(`⚠️ OPS-OFD-018 already exists for ${body.operationRef}, returning existing`);
        return NextResponse.json(
          {
            message: "Timesheet already exists",
            data: existing,
            isDuplicate: true,
          },
          { status: 200, headers: corsHeaders }
        );
      }
      await STSTimesheet.findByIdAndDelete(existing._id);
      console.log(`🗑️ Deleted incomplete OPS-OFD-018 without sequenceNumber for ${body.operationRef}`);
    }

    /* ================= STEP 1: SAVE DOCUMENT ================= */
    const newTimesheet = await STSTimesheet.create(documentData);
    console.log(`✅ OPS-OFD-018 saved: ${newTimesheet._id} with sequenceNumber: ${newTimesheet.sequenceNumber}`);

    /* ================= STEP 2: QUEUE BACKGROUND JOB ================= */
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-018", {
        checklistId: newTimesheet._id.toString(),
        operationRef: newTimesheet.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-018 timesheet saved successfully. Document generation queued.",
        data: newTimesheet,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-018 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
