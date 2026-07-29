import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

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
    const body = await req.json();
    if (
      !body.proposedChange ||
      !body.reasonForChange ||
      !body.proposedBy ||
      !body.mocInitiatedBy
    ) {
      return NextResponse.json(
        { success: false, error: "Required fields are missing" },
        { status: 400 }
      );
    }

    if (!body.riskAssessmentRequired && body.riskLevel) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Risk level cannot be provided when risk assessment is not required",
        },
        { status: 400 }
      );
    }

    // Protect system fields from being modified
    const updateData = {
      proposedChange: body.proposedChange.trim(),
      reasonForChange: body.reasonForChange.trim(),
      proposedBy: body.proposedBy.trim(),
      mocInitiatedBy: body.mocInitiatedBy.trim(),

      ...(body.year != null && !Number.isNaN(Number(body.year)) && { year: Number(body.year) }),

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
      ...(Array.isArray(body.riskAssessmentFiles) && {
        riskAssessmentFiles: body.riskAssessmentFiles,
      }),
    };

    // Explicitly remove system fields if they were sent
    delete updateData.status;
    delete updateData.formCode;
    delete updateData.serialNumber;
    delete updateData.mocNumber;
    delete updateData.initiationDate;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.revNo;

    // Bump record revision (1.0 -> 1.1 -> 1.2 -> ...) on every edit.
    updateData.revNo = getNextRevisionNumber(mocdoc.revNo);

    const moc = await MOCManagementChange.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!moc) {
      return NextResponse.json(
        { success: false, error: "MOC Management of Change not found" },
        { status: 404 }
      );
    }

    void notifyEdit("QHSE", "moc · management-change · update", id);
    return NextResponse.json(
      {
        success: true,
        message: "MOC Management of Change updated successfully",
        data: moc,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("MOC update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update MOC Management of Change" },
      { status: 500 }
    );
  }
}

