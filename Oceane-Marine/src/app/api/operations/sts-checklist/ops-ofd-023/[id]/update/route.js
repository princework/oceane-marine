import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import RecordOfWorkHours from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-023";
import { incrementRevisionForUpdate } from "../../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import "@/jobs/definitions/ops-ofd-023.job.js";
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

    const existing = await RecordOfWorkHours.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Form not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    const updateData = {
      documentInfo: {
        ...(body.documentInfo || existing.documentInfo || {}),
        revisionNo,
      },
      headerDetails: body.headerDetails || existing.headerDetails || {},
      workEntries: body.workEntries || existing.workEntries || [],
      notes: Array.isArray(body.notes) ? body.notes : (existing.notes || []),
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    // Parse header date if provided
    if (updateData.headerDetails.date) {
      updateData.headerDetails.date = new Date(updateData.headerDetails.date);
    }

    const updatedForm = await RecordOfWorkHours.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Trigger DOCX generation
    await createAndScheduleJob(null, "generate-ops-ofd-023", {
      checklistId: updatedForm._id.toString(),
      operationRef: updatedForm.operationRef,
    });

    void notifyOperationsEdit("OPS-OFD-023", updatedForm._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-023 Form updated successfully & doc regeneration started",
        data: updatedForm,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-023 update error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
