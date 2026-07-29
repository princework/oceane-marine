import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import RecordOfWorkHours from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-023";
import { incrementRevisionForUpdate } from "../../revision.js";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import "@/jobs/definitions/ops-ofd-023.job.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function GET(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;

    const form = await RecordOfWorkHours.findById(id).lean();

    if (!form) {
      return NextResponse.json(
        { error: "Form not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: form },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function PUT(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;

    const existing = await RecordOfWorkHours.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Form not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = JSON.parse(dataStr);

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

    void notifyOperationsEdit("OPS-OFD-023", id);
    return NextResponse.json(
      {
        success: true,
        message: "Form updated successfully & doc regeneration started",
        data: updatedForm,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
