import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist5C from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005C";
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

    const existing = await STSChecklist5C.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const existingDocInfo = existing.documentInfo || {};
    const revisionNo = incrementRevisionForUpdate(existingDocInfo.revisionNo);
    console.log(`📝 Revision updated: ${existingDocInfo.revisionNo || "N/A"} → ${revisionNo}`);

    const updateData = {
      documentInfo: {
        formNo: body.documentInfo?.formNo || existingDocInfo.formNo || "OPS-OFD-005C",
        revisionNo,
        issueDate: body.documentInfo?.issueDate
          ? new Date(body.documentInfo.issueDate)
          : existingDocInfo.issueDate || new Date(),
        approvedBy: body.documentInfo?.approvedBy || existingDocInfo.approvedBy || "JS",
      },
      terminalTransferInfo: body.terminalTransferInfo || existing.terminalTransferInfo || {},
      checklistItems: (body.checklistItems || existing.checklistItems || []).map((item, idx) => ({
        clNumber: item.clNumber || idx + 1,
        description: item.description || "",
        status: {
          terminalBerthedShip: item.status?.terminalBerthedShip || false,
          outerShip: item.status?.outerShip || false,
          terminal: item.status?.terminal || false,
        },
        remarks: item.remarks || "",
      })),
      responsiblePersons: body.responsiblePersons || existing.responsiblePersons || {},
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedChecklist = await STSChecklist5C.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    /* ================= QUEUE BACKGROUND JOB ================= */

    try {
      await createAndScheduleJob(null, "generate-ops-ofd-005c", {
        checklistId: updatedChecklist._id.toString(),
        operationRef: updatedChecklist.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    void notifyOperationsEdit("OPS-OFD-005C", updatedChecklist._id);
    return NextResponse.json(
      {
        message: "OPS-OFD-005C checklist updated successfully. Document regeneration queued.",
        data: updatedChecklist,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-005C update error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
