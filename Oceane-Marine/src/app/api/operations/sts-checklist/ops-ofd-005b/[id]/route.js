import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist6AB from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005B";
import { incrementRevisionForUpdate } from "../../revision.js";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import "@/jobs/definitions/ops-ofd-005b.job.js";
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
    const { id } = params;

    const checklist = await STSChecklist6AB.findById(id).lean();

    if (!checklist) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

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

export async function PUT(req, { params }) {
  await connectDB();

  try {
    const { id } = params;

    const existing = await STSChecklist6AB.findById(id).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Checklist not found" },
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
        formNo: body.formNo || existing.documentInfo?.formNo || "OPS-OFD-005B",
        revisionNo,
        revisionDate: body.revisionDate ? new Date(body.revisionDate) : (existing.documentInfo?.revisionDate || new Date()),
        approvedBy: body.approvedBy || existing.documentInfo?.approvedBy || "JS",
      },
      transferInfo: {
        constantHeadingShip: body.constantHeadingShip || existing.transferInfo?.constantHeadingShip || "",
        manoeuvringShip: body.manoeuvringShip || existing.transferInfo?.manoeuvringShip || "",
        designatedPOACName: body.designatedPOACName || existing.transferInfo?.designatedPOACName || "",
        stsSuperintendentName: body.stsSuperintendentName || existing.transferInfo?.stsSuperintendentName || "",
        transferDate: body.transferDate ? new Date(body.transferDate) : (existing.transferInfo?.transferDate || undefined),
        transferLocation: body.transferLocation || existing.transferInfo?.transferLocation || "",
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
        chsOfficerName: body.chsOfficerName || existing.responsiblePersons?.chsOfficerName || "",
        msOfficerName: body.msOfficerName || existing.responsiblePersons?.msOfficerName || "",
        terminalName: body.terminalName || existing.responsiblePersons?.terminalName || "",
        stsSuperintendentName: body.stsSuperintendentName || existing.responsiblePersons?.stsSuperintendentName || "",
      },
      status: body.status || existing.status || "DRAFT",
      createdBy: body.createdBy || existing.createdBy || undefined,
    };

    const updatedChecklist = await STSChecklist6AB.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    await createAndScheduleJob(null, "generate-ops-ofd-005b", {
      checklistId: updatedChecklist._id.toString(),
      operationRef: updatedChecklist.operationRef,
    });

    void notifyOperationsEdit("OPS-OFD-005B", id);
    return NextResponse.json(
      {
        success: true,
        message: "Checklist updated successfully & doc regeneration started",
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
