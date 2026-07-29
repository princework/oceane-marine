import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MooringMasterExpenseSheet from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-029";
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

    /* ================= DUPLICATE CHECK ================= */
    const existing = await MooringMasterExpenseSheet.findOne({
      operationRef: body.operationRef,
    }).sort({ createdAt: -1 });

    if (existing && existing.sequenceNumber) {
      return NextResponse.json(
        {
          message: "OPS-OFD-029 expense sheet already exists for this operation",
          data: existing,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // Delete incomplete entry (no sequenceNumber)
    if (existing) {
      await MooringMasterExpenseSheet.findByIdAndDelete(existing._id);
      console.log(`🗑️ Deleted incomplete OPS-OFD-029 without sequenceNumber for ${body.operationRef}`);
    }

    const revisionNo = await getNextRevisionForCreate(MooringMasterExpenseSheet);

    /* ================= PREPARE DOCUMENT DATA ================= */
    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        formNo: body.documentInfo?.formNo || "OPS-OFD-029",
        revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
      },
      personalDetails: body.personalDetails || {},
      bankDetails: body.bankDetails || {},
      travelDetails: {
        departureFromHomeTown: body.travelDetails?.departureFromHomeTown || {},
        arrivalAtHomeTown: body.travelDetails?.arrivalAtHomeTown || {},
      },
      statementOfExpenses: (body.statementOfExpenses || []).map((expense) => ({
        description: expense.description || "",
        numberOfDaysOrMisc: expense.numberOfDaysOrMisc || "",
        dailyRate: expense.dailyRate || 0,
        amount: expense.amount || 0,
        officeTotal: expense.officeTotal || 0,
      })),
      totals: body.totals || {},
      status: body.status || "DRAFT",
      createdBy: body.createdBy || undefined,
    };

    /* ================= STEP 1: SAVE DOCUMENT ================= */
    const newExpenseSheet = await MooringMasterExpenseSheet.create(documentData);
    console.log(`✅ OPS-OFD-029 saved: ${newExpenseSheet._id} with sequenceNumber: ${newExpenseSheet.sequenceNumber}`);

    /* ================= STEP 2: QUEUE BACKGROUND JOB ================= */
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-029", {
        checklistId: newExpenseSheet._id.toString(),
        operationRef: newExpenseSheet.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    return NextResponse.json(
      {
        message: "OPS-OFD-029 expense sheet created successfully. Document generation queued.",
        data: newExpenseSheet,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-029 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
