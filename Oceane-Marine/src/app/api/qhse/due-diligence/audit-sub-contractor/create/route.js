import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import SubContractorAudit from "@/lib/mongodb/models/qhse-due-diligence/SubContractorAudit";
import { saveBase64AsFile, isBase64DataUrl } from "@/lib/utils/qhse-file-storage";

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

function getNextVersion(latestVersion) {
  if (!latestVersion) return "1.0";
  return (parseFloat(latestVersion) + 0.1).toFixed(1);
}

export async function POST(req) {
  await connectDB();
  try {
    const body = await req.json();
    const {
      version,
      subcontractorName,
      subcontractorAddress,
      serviceType,
      contactPerson,
      emailOfContactPerson,
      phoneOfContactPerson,
      operatingAreas,
      tradeLicenseCopyAvailable,
      hasHSEPolicy,
      auditsSubcontractors,
      hasInsurance,
      insuranceDetails,
      isoCertifications,
      auditCompletedBy,
      contractorApprovedBy,
    } = body;

    if (
      !subcontractorName?.trim() ||
      !subcontractorAddress?.trim() ||
      !serviceType?.trim() ||
      !contactPerson?.trim() ||
      !emailOfContactPerson?.trim() ||
      !phoneOfContactPerson?.trim()
    ) {
      return NextResponse.json(
        { error: "All required fields must be filled" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (
      typeof tradeLicenseCopyAvailable !== "boolean" ||
      typeof hasHSEPolicy !== "boolean" ||
      typeof auditsSubcontractors !== "boolean" ||
      typeof hasInsurance !== "boolean"
    ) {
      return NextResponse.json(
        { error: "All compliance questions must be answered (Yes/No)" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (hasInsurance && !insuranceDetails?.trim()) {
      return NextResponse.json(
        { error: "Insurance details are required when insurance is selected" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!Array.isArray(isoCertifications) || isoCertifications.length === 0) {
      return NextResponse.json(
        { error: "At least one ISO certification must be selected" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (
      !auditCompletedBy?.name?.trim() ||
      !auditCompletedBy?.designation?.trim() ||
      !auditCompletedBy?.signedAt
    ) {
      return NextResponse.json(
        { error: "Audit completed by fields are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (
      !contractorApprovedBy?.name?.trim() ||
      !contractorApprovedBy?.designation?.trim() ||
      !contractorApprovedBy?.signedAt
    ) {
      return NextResponse.json(
        { error: "Contractor approved by fields are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const auditDate = auditCompletedBy.signedAt
      ? new Date(auditCompletedBy.signedAt)
      : new Date();
    const pathOpts = {
      formCode: "QAF-OFD-055",
      formSlug: "audit-sub-contractor",
      date: auditDate,
      title: subcontractorName.trim(),
      fileType: "signatures",
    };

    const processedAuditCompletedBy = { ...auditCompletedBy };
    if (isBase64DataUrl(auditCompletedBy.signaturePhoto)) {
      const saved = await saveBase64AsFile({
        ...pathOpts,
        fileName: "audit-completed-by-signature",
        base64DataUrl: auditCompletedBy.signaturePhoto,
      });
      if (saved) processedAuditCompletedBy.signaturePhoto = saved;
    }

    const processedContractorApprovedBy = { ...contractorApprovedBy };
    if (isBase64DataUrl(contractorApprovedBy.signaturePhoto)) {
      const saved = await saveBase64AsFile({
        ...pathOpts,
        fileName: "contractor-approved-by-signature",
        base64DataUrl: contractorApprovedBy.signaturePhoto,
      });
      if (saved) processedContractorApprovedBy.signaturePhoto = saved;
    }

    const newVersion = getNextVersion(version);

    const newSubContractorAudit = await new SubContractorAudit({
      revisionNo: newVersion,
      revisionDate: new Date(),
      subcontractorName,
      subcontractorAddress,
      serviceType,
      contactPerson,
      emailOfContactPerson,
      phoneOfContactPerson,
      operatingAreas,
      tradeLicenseCopyAvailable,
      hasHSEPolicy,
      auditsSubcontractors,
      hasInsurance,
      insuranceDetails,
      isoCertifications,
      auditCompletedBy: processedAuditCompletedBy,
      contractorApprovedBy: processedContractorApprovedBy,
      status: "Pending",
      createdBy: req.user?.id || null,
    }).save();

    return NextResponse.json(
      {
        message: "Sub contractor audit created successfully",
        data: newSubContractorAudit,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
