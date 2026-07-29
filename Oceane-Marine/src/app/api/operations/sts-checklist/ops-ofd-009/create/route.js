import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MooringMastersJobReport from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-009";
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

    const revisionNo = await getNextRevisionForCreate(MooringMastersJobReport);

    // Prepare the document data
    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        formNo: body.documentInfo?.formNo || "OPS-OFD-009",
        revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
      },
      shipToBeLighted: body.shipToBeLighted || {},
      receivingShip: body.receivingShip || {},
      status: body.status || "SUBMITTED",
      createdBy: body.createdBy || undefined,
    };

    /* ================= DUPLICATE SAFETY CHECK ================= */
    const existing = await MooringMastersJobReport.findOne({
      operationRef: body.operationRef,
    }).sort({ createdAt: -1 });

    if (existing) {
      if (existing.sequenceNumber) {
        console.log(`⚠️ OPS-OFD-009 already exists for ${body.operationRef}, returning existing`);
        return NextResponse.json(
          {
            message: "Job report already exists",
            data: existing,
            isDuplicate: true,
          },
          { status: 200, headers: corsHeaders }
        );
      }
      await MooringMastersJobReport.findByIdAndDelete(existing._id);
      console.log(`🗑️ Deleted incomplete OPS-OFD-009 without sequenceNumber for ${body.operationRef}`);
    }

    /* ================= STEP 1: SAVE DOCUMENT ================= */
    const newReport = await MooringMastersJobReport.create(documentData);
    console.log(`✅ OPS-OFD-009 saved: ${newReport._id} with sequenceNumber: ${newReport.sequenceNumber}`);

    /* ================= STEP 2: QUEUE BACKGROUND JOB ================= */
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-009", {
        checklistId: newReport._id.toString(),
        operationRef: newReport.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-009 job report saved successfully. Document generation queued.",
        data: newReport,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-009 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
