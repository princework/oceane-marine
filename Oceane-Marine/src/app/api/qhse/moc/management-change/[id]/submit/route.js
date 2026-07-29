import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const mocdoc = await MOCManagementChange.findById(id);
    if (!mocdoc) {
      return NextResponse.json(
        { success: false, error: "MOC Management of Change not found" },
        { status: 404 }
      );
    }
    // body may be empty when submitting directly from list; use existing doc as source of truth
    const body = await req.json().catch(() => ({}));

    const proposedChange = body.proposedChange ?? mocdoc.proposedChange;
    const reasonForChange = body.reasonForChange ?? mocdoc.reasonForChange;
    const proposedBy = body.proposedBy ?? mocdoc.proposedBy;
    const mocInitiatedBy = body.mocInitiatedBy ?? mocdoc.mocInitiatedBy;

    if (!proposedChange || !reasonForChange || !proposedBy || !mocInitiatedBy) {
      return NextResponse.json(
        { success: false, error: "Required fields are missing" },
        { status: 400 }
      );
    }

    const riskAssessmentRequired =
      body.riskAssessmentRequired ?? mocdoc.riskAssessmentRequired;
    const riskLevel = body.riskLevel ?? mocdoc.riskLevel;

    if (!riskAssessmentRequired && riskLevel) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Risk level cannot be provided when risk assessment is not required",
        },
        { status: 400 }
      );
    }

    const updateData = {
      proposedChange: proposedChange.trim(),
      reasonForChange: reasonForChange.trim(),
      proposedBy: proposedBy.trim(),
      mocInitiatedBy: mocInitiatedBy.trim(),
      // Move record from Draft to Open (under review)
      status: "Open",

      targetImplementationDate:
        body.targetImplementationDate !== undefined
          ? new Date(body.targetImplementationDate)
          : mocdoc.targetImplementationDate,

      potentialConsequences:
        body.potentialConsequences !== undefined
          ? {
              environment: body.potentialConsequences.environment || false,
              safety: body.potentialConsequences.safety || false,
              contractual: body.potentialConsequences.contractual || false,
              cost: body.potentialConsequences.cost || false,
              operational: body.potentialConsequences.operational || false,
              reputation: body.potentialConsequences.reputation || false,
              remarks: body.potentialConsequences.remarks || "",
            }
          : mocdoc.potentialConsequences,

      equipmentFacilityDocumentationAffected:
        body.equipmentFacilityDocumentationAffected !== undefined
          ? body.equipmentFacilityDocumentationAffected?.trim()
          : mocdoc.equipmentFacilityDocumentationAffected,

      riskAssessmentRequired,
      ...(riskLevel && { riskLevel }),

      reviewerComments:
        body.reviewerComments !== undefined
          ? body.reviewerComments?.trim()
          : mocdoc.reviewerComments,

      trainingRequired:
        body.trainingRequired !== undefined
          ? Boolean(body.trainingRequired)
          : mocdoc.trainingRequired,
      trainingDetails:
        body.trainingDetails !== undefined
          ? body.trainingDetails?.trim()
          : mocdoc.trainingDetails,

      documentChangeRequired:
        body.documentChangeRequired !== undefined
          ? Boolean(body.documentChangeRequired)
          : mocdoc.documentChangeRequired,

      dcrNumber:
        body.dcrNumber !== undefined ? body.dcrNumber?.trim() : mocdoc.dcrNumber,
    };

    const moc = await MOCManagementChange.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!moc) {
      return NextResponse.json(
        { success: false, error: "MOC Management of Change not found" },
        { status: 404 }
      );
    }

    void notifyEdit("QHSE", "moc · management-change · submit", id);
    return NextResponse.json(
      {
        success: true,
        message: "MOC Management of Change submitted successfully",
        data: moc,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("MOC submit error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit MOC Management of Change" },
      { status: 500 }
    );
  }
}
