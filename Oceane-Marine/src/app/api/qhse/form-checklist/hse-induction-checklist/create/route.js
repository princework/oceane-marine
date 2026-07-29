import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import HseInductionChecklist from "@/lib/mongodb/models/qhse-form-checklist/HseInductionChecklist";
import { saveBase64AsFile, isBase64DataUrl } from "@/lib/utils/qhse-file-storage";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  await connectDB();
  try {
    const body = await req.json();

    if (
      !body.employeeOrContractorName ||
      !body.dateOfInduction ||
      !body.location
    ) {
      return NextResponse.json(
        { error: "All required fields must be filled" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (
      !body.hseChecklist ||
      typeof body.hseChecklist !== "object" ||
      Array.isArray(body.hseChecklist)
    ) {
      return NextResponse.json(
        { error: "HSE checklist must be a valid object" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (
      !body.jobSpecificChecklist ||
      typeof body.jobSpecificChecklist !== "object" ||
      Array.isArray(body.jobSpecificChecklist)
    ) {
      return NextResponse.json(
        { error: "Job specific checklist must be a valid object" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (
      !body.signatures?.employeeSignature ||
      !body.signatures?.inductionGivenBySignature
    ) {
      return NextResponse.json(
        { error: "All required signatures must be provided" },
        { status: 400, headers: corsHeaders }
      );
    }

    const inductionDate = new Date(body.dateOfInduction);
    const employeeName = body.employeeOrContractorName.trim();
    const location = body.location.trim();

    const pathOpts = {
      formCode: "QAF-OFD-008",
      formSlug: "hse-induction-checklist",
      location,
      date: inductionDate,
      title: employeeName,
      fileType: "signatures",
    };

    let employeeSigValue = body.signatures.employeeSignature;
    if (isBase64DataUrl(employeeSigValue)) {
      const savedPath = await saveBase64AsFile({
        ...pathOpts,
        fileName: "employee-signature",
        base64DataUrl: employeeSigValue,
      });
      if (savedPath) employeeSigValue = savedPath;
    }

    let inductionSigValue = body.signatures.inductionGivenBySignature;
    if (isBase64DataUrl(inductionSigValue)) {
      const savedPath = await saveBase64AsFile({
        ...pathOpts,
        fileName: "induction-given-by-signature",
        base64DataUrl: inductionSigValue,
      });
      if (savedPath) inductionSigValue = savedPath;
    }

    const formData = {
      employeeOrContractorName: employeeName,
      dateOfInduction: inductionDate,
      location,
      hseChecklist: body.hseChecklist,
      jobSpecificChecklist: body.jobSpecificChecklist,
      signatures: {
        employeeSignature: employeeSigValue,
        employeeSignatureDate: body.signatures.employeeSignatureDate
          ? new Date(body.signatures.employeeSignatureDate)
          : new Date(),
        inductionGivenBySignature: inductionSigValue,
      },
      status: "Pending",
      submittedBy: body.submittedBy || null,
      formNo: body.formNo || body.formCode || null,
      revisionNo: body.revisionNo || body.version || "1.0",
      revisionDate: body.revisionDate
        ? new Date(body.revisionDate)
        : new Date(),
      approvedBy: body.approvedBy || null,
    };

    const newHseInductionChecklist = await new HseInductionChecklist(
      formData
    ).save();

    return NextResponse.json(
      { success: true, data: newHseInductionChecklist },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("HSE Induction Checklist Create Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checklist" },
      { status: 500, headers: corsHeaders }
    );
  }
}
