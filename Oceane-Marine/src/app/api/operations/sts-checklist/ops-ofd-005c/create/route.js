import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist5C from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005C";
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

    /* ================= REVISION ================= */

    const revisionNo = await getNextRevisionForCreate(STSChecklist5C);

    /* ================= DOCUMENT DATA ================= */

    const documentData = {
      operationRef: body.operationRef,

      documentInfo: {
        formNo: body.documentInfo?.formNo || "OPS-OFD-005C",
        revisionNo,
        issueDate: body.documentInfo?.issueDate
          ? new Date(body.documentInfo.issueDate)
          : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
      },

      terminalTransferInfo: body.terminalTransferInfo || {},

      checklistItems: (body.checklistItems || []).map((item, idx) => ({
        clNumber: item.clNumber || idx + 1,
        description: item.description || "",
        status: {
          terminalBerthedShip: item.status?.terminalBerthedShip || false,
          outerShip: item.status?.outerShip || false,
          terminal: item.status?.terminal || false,
        },
        remarks: item.remarks || "",
      })),

      responsiblePersons: body.responsiblePersons || {},

      status: body.status || "SUBMITTED",
      createdBy: body.createdBy || undefined,
    };

    /* ================= DUPLICATE SAFETY CHECK ================= */

    const existing = await STSChecklist5C.findOne({
      operationRef: body.operationRef,
    }).sort({ createdAt: -1 });

    if (existing) {
      if (existing.sequenceNumber) {
        console.log(`⚠️ OPS-OFD-005C already exists for ${body.operationRef}, returning existing`);
        return NextResponse.json(
          {
            message: "Checklist already exists",
            data: existing,
            isDuplicate: true,
          },
          { status: 200, headers: corsHeaders }
        );
      }
      await STSChecklist5C.findByIdAndDelete(existing._id);
      console.log(`🗑️ Deleted incomplete OPS-OFD-005C without sequenceNumber for ${body.operationRef}`);
    }

    /* ================= STEP 1: SAVE DOCUMENT ================= */

    const newChecklist = await STSChecklist5C.create(documentData);
    console.log(`✅ OPS-OFD-005C saved: ${newChecklist._id} with sequenceNumber: ${newChecklist.sequenceNumber}`);

    /* ================= STEP 2: QUEUE BACKGROUND JOB ================= */

    try {
      await createAndScheduleJob(null, "generate-ops-ofd-005c", {
        checklistId: newChecklist._id.toString(),
        operationRef: newChecklist.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    /* ================= RETURN SUCCESS ================= */

    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-005C checklist saved successfully. Document generation queued.",
        data: newChecklist,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("OPS-OFD-005C create error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
