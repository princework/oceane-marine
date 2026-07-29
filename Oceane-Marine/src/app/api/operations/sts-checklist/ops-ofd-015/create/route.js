import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSHourlyQuantityLog from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-015";
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

    const revisionNo = await getNextRevisionForCreate(STSHourlyQuantityLog);

    // Prepare the document data
    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        formNo: body.documentInfo?.formNo || "OPS-OFD-015",
        revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
      },
      transferInfo: body.transferInfo || {},
      hourlyRecords: (body.hourlyRecords || []).map((record) => ({
        serialNumber: record.serialNumber,
        date: record.date ? new Date(record.date) : undefined,
        time: record.time || "",
        dischargedQuantity: record.dischargedQuantity || 0,
        receivedQuantity: record.receivedQuantity || 0,
        differenceQuantity: record.differenceQuantity || 0,
        checkedBy: record.checkedBy || "",
      })),
      status: body.status || "SUBMITTED",
      createdBy: body.createdBy || undefined,
    };

    /* ================= DUPLICATE SAFETY CHECK ================= */
    const existing = await STSHourlyQuantityLog.findOne({
      operationRef: body.operationRef,
    }).sort({ createdAt: -1 });

    if (existing) {
      if (existing.sequenceNumber) {
        console.log(`⚠️ OPS-OFD-015 already exists for ${body.operationRef}, returning existing`);
        return NextResponse.json(
          {
            message: "Hourly quantity log already exists",
            data: existing,
            isDuplicate: true,
          },
          { status: 200, headers: corsHeaders }
        );
      }
      await STSHourlyQuantityLog.findByIdAndDelete(existing._id);
      console.log(`🗑️ Deleted incomplete OPS-OFD-015 without sequenceNumber for ${body.operationRef}`);
    }

    /* ================= STEP 1: SAVE DOCUMENT ================= */
    const newLog = await STSHourlyQuantityLog.create(documentData);
    console.log(`✅ OPS-OFD-015 saved: ${newLog._id} with sequenceNumber: ${newLog.sequenceNumber}`);

    /* ================= STEP 2: QUEUE BACKGROUND JOB ================= */
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-015", {
        checklistId: newLog._id.toString(),
        operationRef: newLog.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-015 hourly quantity log saved successfully. Document generation queued.",
        data: newLog,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-015 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
