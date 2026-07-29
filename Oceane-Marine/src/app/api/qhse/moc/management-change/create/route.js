import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange";

export async function POST(req) {
  await connectDB();

  try {
    const body = await req.json();

    const action = body.action === "submit" ? "submit" : "draft";
    // Draft = user saving, Open = submitted for review
    const status = action === "submit" ? "Open" : "Draft";

    if (action === "submit") {
      if (
        !body.proposedChange ||
        !body.reasonForChange ||
        !body.proposedBy ||
        !body.mocInitiatedBy
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "All required fields must be filled before submission",
          },
          { status: 400 }
        );
      }

      if (body.riskAssessmentRequired && !body.riskLevel) {
        return NextResponse.json(
          {
            success: false,
            error: "Risk level is required when risk assessment is required",
          },
          { status: 400 }
        );
      }
    }

    const yearNum =
      body.year != null && !Number.isNaN(Number(body.year))
        ? Number(body.year)
        : new Date().getFullYear();

    const mocData = {
      proposedChange: body.proposedChange?.trim(),
      reasonForChange: body.reasonForChange?.trim(),
      proposedBy: body.proposedBy?.trim(),
      mocInitiatedBy: body.mocInitiatedBy?.trim(),
      status,
      year: yearNum,

      ...(body.targetImplementationDate && {
        targetImplementationDate: new Date(body.targetImplementationDate),
      }),
      ...(body.potentialConsequences && {
        potentialConsequences: body.potentialConsequences,
      }),
      ...(body.equipmentFacilityDocumentationAffected && {
        equipmentFacilityDocumentationAffected:
          body.equipmentFacilityDocumentationAffected.trim(),
      }),
      ...(body.riskAssessmentRequired !== undefined && {
        riskAssessmentRequired: body.riskAssessmentRequired,
      }),
      ...(body.riskLevel && { riskLevel: body.riskLevel }),
      ...(body.reviewerComments && {
        reviewerComments: body.reviewerComments.trim(),
      }),
      ...(body.trainingRequired !== undefined && {
        trainingRequired: body.trainingRequired,
      }),
      ...(body.trainingDetails && {
        trainingDetails: body.trainingDetails.trim(),
      }),
      ...(body.documentChangeRequired !== undefined && {
        documentChangeRequired: body.documentChangeRequired,
      }),
      ...(body.dcrNumber && { dcrNumber: body.dcrNumber.trim() }),
    };

    const moc = await MOCManagementChange.create(mocData);

    return NextResponse.json(
      {
        success: true,
        message:
          status === "Draft"
            ? "MOC saved as draft"
            : "MOC submitted successfully",
        data: moc,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("MOC creation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create MOC Management Change",
      },
      { status: 500 }
    );
  }
}
