import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist6AB from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005B";
import { incrementRevisionForUpdate } from "../revision.js";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-005b.job.js";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function handleSignatureUpload(formData, body, existingSignature = "") {
  // OPS-OFD-005B doesn't have signature field, but keeping structure consistent
  return "";
}

function buildUpdateData(body, revisionNo, existing) {
  return {
    documentInfo: {
      formNo: body.documentInfo?.formNo || body.formNo || existing.documentInfo?.formNo || "OPS-OFD-005B",
      revisionNo,
      revisionDate: body.documentInfo?.revisionDate || body.documentInfo?.issueDate || body.revisionDate || body.issueDate
        ? new Date(body.documentInfo?.revisionDate || body.documentInfo?.issueDate || body.revisionDate || body.issueDate)
        : (existing.documentInfo?.revisionDate || new Date()),
      approvedBy: body.documentInfo?.approvedBy || body.approvedBy || existing.documentInfo?.approvedBy || "JS",
    },
    transferInfo: {
      constantHeadingShip: body.transferInfo?.constantHeadingShip ?? existing.transferInfo?.constantHeadingShip ?? "",
      manoeuvringShip: body.transferInfo?.manoeuvringShip ?? existing.transferInfo?.manoeuvringShip ?? "",
      designatedPOACName: body.transferInfo?.designatedPOACName ?? existing.transferInfo?.designatedPOACName ?? "",
      stsSuperintendentName: body.transferInfo?.stsSuperintendentName ?? existing.transferInfo?.stsSuperintendentName ?? "",
      transferDate: body.transferInfo?.transferDate ? new Date(body.transferInfo.transferDate) : (existing.transferInfo?.transferDate || undefined),
      transferLocation: body.transferInfo?.transferLocation ?? existing.transferInfo?.transferLocation ?? "",
    },
    checklist6A: {
      checks: (body.checklist6A?.checks || existing.checklist6A?.checks || []).map((item) => ({
        clNumber: item.clNumber,
        description: item.description || "",
        status: {
          yes: item.status?.yes || false,
          notApplicable: item.status?.notApplicable || false,
        },
        remarks: item.remarks || "",
      })),
      pipelineConditions: {
        purged: body.checklist6A?.pipelineConditions?.purged ?? existing.checklist6A?.pipelineConditions?.purged ?? false,
        inerted: body.checklist6A?.pipelineConditions?.inerted ?? existing.checklist6A?.pipelineConditions?.inerted ?? false,
        depressurized: body.checklist6A?.pipelineConditions?.depressurized ?? existing.checklist6A?.pipelineConditions?.depressurized ?? false,
      },
    },
    checklist6B: (body.checklist6B || existing.checklist6B || []).map((item) => ({
      clNumber: item.clNumber,
      description: item.description || "",
      status: {
        yes: item.status?.yes || false,
        notApplicable: item.status?.notApplicable || false,
      },
      remarks: item.remarks || "",
    })),
    responsiblePersons: {
      chsOfficerName: body.responsiblePersons?.chsOfficerName ?? existing.responsiblePersons?.chsOfficerName ?? "",
      msOfficerName: body.responsiblePersons?.msOfficerName ?? existing.responsiblePersons?.msOfficerName ?? "",
      terminalName: body.responsiblePersons?.terminalName ?? existing.responsiblePersons?.terminalName ?? "",
      stsSuperintendentName: body.responsiblePersons?.stsSuperintendentName ?? existing.responsiblePersons?.stsSuperintendentName ?? "",
    },
    status: body.status || existing.status || "DRAFT",
    createdBy: body.createdBy || existing.createdBy || undefined,
  };
}

async function triggerDocumentGeneration(checklistId, operationRef) {
  try {
    await createAndScheduleJob(null, "generate-ops-ofd-005b", {
      checklistId: checklistId.toString(),
      operationRef,
    });
  } catch (err) {
    console.error("Job queue error:", err);
  }
}

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
    let operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    operationRef = operationRef.trim();

    console.log(`🔍 Searching for OPS-OFD-005B checklist with operationRef: "${operationRef}"`);

    let checklist = await STSChecklist6AB.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!checklist) {
      checklist = await STSChecklist6AB.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!checklist) {
      return NextResponse.json(
        { 
          error: `No OPS-OFD-005B checklist found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`✅ Found OPS-OFD-005B checklist: ${checklist._id} with operationRef: "${checklist.operationRef}"`);

    return NextResponse.json(
      { success: true, data: checklist },
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
    let operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    operationRef = operationRef.trim();

    let existing = await STSChecklist6AB.findOne({ operationRef })
      .sort({ createdAt: -1 })
      .lean();

    if (!existing) {
      existing = await STSChecklist6AB.findOne({
        operationRef: { $regex: new RegExp(`^${operationRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
      })
      .sort({ createdAt: -1 })
      .lean();
    }

    if (!existing) {
      return NextResponse.json(
        { 
          error: `No checklist found for operation reference: ${operationRef}`,
          searchedValue: operationRef
        },
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

    const updateData = buildUpdateData(body, revisionNo, existing);

    const updatedChecklist = await STSChecklist6AB.findByIdAndUpdate(
      existing._id,
      updateData,
      { new: true, runValidators: true }
    );

    await triggerDocumentGeneration(updatedChecklist._id, updatedChecklist.operationRef);

    void notifyOperationsEdit("OPS-OFD-005B", updatedChecklist._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-005B checklist updated successfully. Document regeneration queued.",
        data: updatedChecklist,
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
