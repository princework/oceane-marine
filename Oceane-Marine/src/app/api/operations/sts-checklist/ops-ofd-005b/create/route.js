import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSChecklist6AB from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005B";
import { getNextRevisionForCreate } from "../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import fs from "fs/promises";
import path from "path";
import "@/jobs/definitions/ops-ofd-005b.job.js";

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

    const revisionNo = await getNextRevisionForCreate(STSChecklist6AB);

    // Prepare the document data - read from nested structure
    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        formNo: body.documentInfo?.formNo || body.formNo || "OPS-OFD-005B",
        revisionNo,
        revisionDate: body.documentInfo?.revisionDate || body.documentInfo?.issueDate || body.revisionDate || body.issueDate 
          ? new Date(body.documentInfo?.revisionDate || body.documentInfo?.issueDate || body.revisionDate || body.issueDate) 
          : new Date(),
        approvedBy: body.documentInfo?.approvedBy || body.approvedBy || "JS",
      },
      transferInfo: {
        constantHeadingShip: body.transferInfo?.constantHeadingShip || "",
        manoeuvringShip: body.transferInfo?.manoeuvringShip || "",
        designatedPOACName: body.transferInfo?.designatedPOACName || "",
        stsSuperintendentName: body.transferInfo?.stsSuperintendentName || "",
        transferDate: body.transferInfo?.transferDate ? new Date(body.transferInfo.transferDate) : undefined,
        transferLocation: body.transferInfo?.transferLocation || "",
      },
      checklist6A: {
        checks: (body.checklist6A?.checks || []).map((item) => ({
          clNumber: item.clNumber,
          description: item.description || "",
          status: {
            yes: item.status?.yes || false,
            notApplicable: item.status?.notApplicable || false,
          },
          remarks: item.remarks || "",
        })),
        pipelineConditions: {
          purged: body.checklist6A?.pipelineConditions?.purged || false,
          inerted: body.checklist6A?.pipelineConditions?.inerted || false,
          depressurized: body.checklist6A?.pipelineConditions?.depressurized || false,
        },
      },
      checklist6B: (body.checklist6B || []).map((item) => ({
        clNumber: item.clNumber,
        description: item.description || "",
        status: {
          yes: item.status?.yes || false,
          notApplicable: item.status?.notApplicable || false,
        },
        remarks: item.remarks || "",
      })),
      responsiblePersons: {
        chsOfficerName: body.responsiblePersons?.chsOfficerName || "",
        msOfficerName: body.responsiblePersons?.msOfficerName || "",
        terminalName: body.responsiblePersons?.terminalName || "",
        stsSuperintendentName: body.responsiblePersons?.stsSuperintendentName || "",
      },
      status: body.status || "DRAFT",
      createdBy: body.createdBy || undefined,
    };

    const newChecklist = await STSChecklist6AB.create(documentData);

    // Queue background job for document generation
    try {
      await createAndScheduleJob(null, "generate-ops-ofd-005b", {
        checklistId: newChecklist._id.toString(),
        operationRef: newChecklist.operationRef,
      });
    } catch (err) {
      console.error("Job queue error:", err);
    }

    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-005B checklist created successfully. Document generation queued.",
        data: newChecklist,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-005B create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
