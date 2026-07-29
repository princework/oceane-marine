import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import RecordOfWorkHours from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-023";
import { incrementRevisionForUpdate } from "../revision.js";
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

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    console.log("[OPS-OFD-023 GET] Querying for operationRef:", operationRef);
    // Sort by createdAt desc to get the latest document in case of duplicates
    const form = await RecordOfWorkHours.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!form) {
      console.log("[OPS-OFD-023 GET] No form found for:", operationRef);
      return NextResponse.json(
        { error: "Form not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Normalize notes — handle both legacy object format and array format
    let normalizedNotes = [];
    if (Array.isArray(form.notes)) {
      normalizedNotes = form.notes;
    } else if (form.notes && typeof form.notes === "object") {
      // Legacy: { note1: "...", note2: "...", ... }
      normalizedNotes = Object.values(form.notes).filter(
        (v) => typeof v === "string" && v.trim() !== ""
      );
    }
    form.notes = normalizedNotes;

    console.log("[OPS-OFD-023 GET] Found form:", {
      _id: form._id,
      operationRef: form.operationRef,
      headerDetails: form.headerDetails,
      notesIsArray: Array.isArray(form.notes),
      notesLength: form.notes?.length,
      notes: form.notes,
      workEntriesCount: form.workEntries?.length,
    });

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

export async function PUT(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const existing = await RecordOfWorkHours.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

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

    console.log("[OPS-OFD-023 PUT] Received body:", {
      operationRef: body.operationRef,
      headerDetails: body.headerDetails,
      notesType: typeof body.notes,
      notesIsArray: Array.isArray(body.notes),
      notesLength: body.notes?.length,
      notes: body.notes,
      workEntriesCount: body.workEntries?.length,
    });

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    const updateData = {
      documentInfo: {
        ...(body.documentInfo || existing.documentInfo || {}),
        revisionNo,
        issueDate: body.documentInfo?.issueDate
          ? new Date(body.documentInfo.issueDate)
          : (existing.documentInfo?.issueDate || new Date()),
      },
      headerDetails: body.headerDetails || existing.headerDetails || {},
      workEntries: body.workEntries || existing.workEntries || [],
      notes: Array.isArray(body.notes) ? body.notes : (existing.notes || []),
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    console.log("[OPS-OFD-023 PUT] Update data notes:", updateData.notes);
    console.log("[OPS-OFD-023 PUT] Update data headerDetails:", updateData.headerDetails);

    // Parse header date if provided
    if (updateData.headerDetails.date) {
      updateData.headerDetails.date = new Date(updateData.headerDetails.date);
    }

    const updatedForm = await RecordOfWorkHours.findOneAndUpdate(
      { _id: existing._id },
      updateData,
      { new: true, runValidators: true }
    );

    await createAndScheduleJob(null, "generate-ops-ofd-023", {
      checklistId: updatedForm._id.toString(),
      operationRef: updatedForm.operationRef,
    });

    void notifyOperationsEdit("OPS-OFD-023", updatedForm._id);
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
