import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import RecordOfWorkHours from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-023";
import { getNextRevisionForCreate } from "../../revision";
import { createAndScheduleJob } from "@/jobs/agenda/jobHelper.js";
import "@/jobs/definitions/ops-ofd-023.job.js";

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

    console.log("[OPS-OFD-023 CREATE] Received body:", {
      operationRef: body.operationRef,
      headerDetails: body.headerDetails,
      notesType: typeof body.notes,
      notesIsArray: Array.isArray(body.notes),
      notesLength: body.notes?.length,
      notes: body.notes,
      workEntriesCount: body.workEntries?.length,
    });

    if (!body.operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check for existing document — prevent duplicates
    const existingForm = await RecordOfWorkHours.findOne({
      operationRef: body.operationRef,
    });
    if (existingForm) {
      console.log("[OPS-OFD-023 CREATE] Document already exists for:", body.operationRef, "- will update instead.");
      // Update the existing document instead of creating a duplicate
      const revisionNo = existingForm.documentInfo?.revisionNo
        ? String(parseFloat(existingForm.documentInfo.revisionNo) + 1) + ".0"
        : "1.0";

      existingForm.documentInfo = {
        ...(body.documentInfo || {}),
        formNo: body.documentInfo?.formNo || "OPS-OFD-023",
        revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
      };
      existingForm.headerDetails = {
        stsOperation: body.headerDetails?.stsOperation || "",
        date: body.headerDetails?.date ? new Date(body.headerDetails.date) : undefined,
        mooringMaster: body.headerDetails?.mooringMaster || "",
        remark: body.headerDetails?.remark || "",
      };
      existingForm.workEntries = body.workEntries || existingForm.workEntries || [];
      existingForm.notes = Array.isArray(body.notes) ? body.notes : [];
      existingForm.status = body.status || existingForm.status || "DRAFT";

      await existingForm.save();

      await createAndScheduleJob(null, "generate-ops-ofd-023", {
        checklistId: existingForm._id.toString(),
        operationRef: existingForm.operationRef,
      });

      return NextResponse.json(
        {
          success: true,
          message: "OPS-OFD-023 updated (existing record) & doc generation started",
          data: existingForm,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const revisionNo = await getNextRevisionForCreate(RecordOfWorkHours);

    const documentData = {
      operationRef: body.operationRef,
      documentInfo: {
        ...(body.documentInfo || {}),
        formNo: body.documentInfo?.formNo || "OPS-OFD-023",
        revisionNo,
        issueDate: body.documentInfo?.issueDate ? new Date(body.documentInfo.issueDate) : new Date(),
        approvedBy: body.documentInfo?.approvedBy || "JS",
      },
      headerDetails: {
        stsOperation: body.headerDetails?.stsOperation || "",
        date: body.headerDetails?.date ? new Date(body.headerDetails.date) : undefined,
        mooringMaster: body.headerDetails?.mooringMaster || "",
        remark: body.headerDetails?.remark || "",
      },
      workEntries: body.workEntries || [],
      notes: Array.isArray(body.notes) ? body.notes : [],
      status: body.status || "DRAFT",
      createdBy: body.createdBy || undefined,
    };

    console.log("[OPS-OFD-023 CREATE] Saving documentData notes:", documentData.notes);
    console.log("[OPS-OFD-023 CREATE] Saving documentData headerDetails:", documentData.headerDetails);

    const newForm = await RecordOfWorkHours.create(documentData);

    console.log("[OPS-OFD-023 CREATE] Saved form:", {
      _id: newForm._id,
      notes: newForm.notes,
      headerDetails: newForm.headerDetails,
    });

    // Trigger DOCX generation
    await createAndScheduleJob(null, "generate-ops-ofd-023", {
      checklistId: newForm._id.toString(),
      operationRef: newForm.operationRef,
    });

    return NextResponse.json(
      {
        success: true,
        message: "OPS-OFD-023 Record of Work Hours created successfully & doc generation started",
        data: newForm,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-023 create error:", error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
