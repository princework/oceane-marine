import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MooringMasterExpenseSheet from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-029";
import { incrementRevisionForUpdate } from "../../revision";
import { createAndScheduleJob } from "../../../../../../jobs/agenda/jobHelper.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

// ==================== CONSTANTS ====================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ==================== CORS ====================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

// ==================== GET by ID ====================

export async function GET(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const expenseSheet = await MooringMasterExpenseSheet.findById(id).lean();

    if (!expenseSheet) {
      return NextResponse.json(
        { error: "Expense sheet not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: expenseSheet },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("OPS-OFD-029 GET by ID error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// ==================== PUT by ID ====================

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(dataStr);

    const existing = await MooringMasterExpenseSheet.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Expense sheet not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    const existingDocInfo = existing.documentInfo || {};
    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existingDocInfo.formNo || "OPS-OFD-029",
        revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : existingDocInfo.issueDate || new Date(),
        approvedBy: body.documentInfo?.approvedBy || existingDocInfo.approvedBy || "JS",
      },
      personalDetails: body.personalDetails || existing.personalDetails || {},
      bankDetails: body.bankDetails || existing.bankDetails || {},
      travelDetails: {
        departureFromHomeTown: body.travelDetails?.departureFromHomeTown || existing.travelDetails?.departureFromHomeTown || {},
        arrivalAtHomeTown: body.travelDetails?.arrivalAtHomeTown || existing.travelDetails?.arrivalAtHomeTown || {},
      },
      statementOfExpenses: (body.statementOfExpenses || existing.statementOfExpenses || []).map((expense) => ({
        description: expense.description || "",
        numberOfDaysOrMisc: expense.numberOfDaysOrMisc || "",
        dailyRate: expense.dailyRate || 0,
        amount: expense.amount || 0,
        officeTotal: expense.officeTotal || 0,
      })),
      totals: body.totals || existing.totals || {},
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedExpenseSheet = await MooringMasterExpenseSheet.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Queue background job
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-029", {
        checklistId: updatedExpenseSheet._id.toString(),
        operationRef: updatedExpenseSheet.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    void notifyOperationsEdit("OPS-OFD-029", id);
    return NextResponse.json(
      {
        message: "OPS-OFD-029 expense sheet updated successfully. Document regeneration queued.",
        data: updatedExpenseSheet,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("OPS-OFD-029 PUT by ID error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
