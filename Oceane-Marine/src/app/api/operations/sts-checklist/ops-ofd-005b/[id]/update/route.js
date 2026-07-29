import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist6AB from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005B";
import { incrementRevisionForUpdate } from "../../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import "@/jobs/definitions/ops-ofd-005b.job.js";
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
    const { id } = params;
    const formData = await req.formData();
    const dataStr = formData.get("data");

    if (!dataStr) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const body = JSON.parse(dataStr);

    const existing = await STSChecklist6AB.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const revisionNo = incrementRevisionForUpdate(existing.documentInfo?.revisionNo);

    const updateData = {
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

    const updatedChecklist = await STSChecklist6AB.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Queue background job for document regeneration
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-005b", {
        checklistId: updatedChecklist._id.toString(),
        operationRef: updatedChecklist.operationRef,
      });
    } catch (jobErr) {
      console.error("Job queue error:", jobErr);
    }

    void notifyOperationsEdit("OPS-OFD-005B", updatedChecklist._id);
    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-005B checklist updated successfully. Document regeneration queued.",
        data: updatedChecklist,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-005B update error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
