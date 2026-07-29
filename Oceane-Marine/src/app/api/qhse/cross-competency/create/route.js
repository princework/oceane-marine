import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import PoacCrossCompetency from "@/lib/mongodb/models/qhse-poac/PoacCrossCompetency";
import { POAC_EVALUATION_ITEMS } from "@/lib/constants/qhse-poac/poacEvaluationItems";
import mongoose from "mongoose";
import { saveBase64AsFile, isBase64DataUrl } from "@/lib/utils/qhse-file-storage";

export async function POST(req) {
  await connectDB();

  try {
    const body = await req.json();

    const {
      nameOfPOAC,
      evaluationDate,
      jobRefNo,
      leadPOAC,
      evaluationItems = [],
    } = body;

    if (!nameOfPOAC?.trim())
      return NextResponse.json(
        { error: "Name of POAC is required" },
        { status: 400 }
      );

    if (!evaluationDate)
      return NextResponse.json(
        { error: "Evaluation date is required" },
        { status: 400 }
      );

    if (!jobRefNo?.trim())
      return NextResponse.json(
        { error: "Job Ref No is required" },
        { status: 400 }
      );

    if (!leadPOAC?.trim())
      return NextResponse.json(
        { error: "Lead POAC is required" },
        { status: 400 }
      );

    const normalizeEval = (value) => {
      if (value === undefined || value === null || value === "") return null;
      const strVal = String(value);
      if (["1", "2", "3", "4", "5"].includes(strVal)) return strVal;
      throw new Error("Invalid evaluation value. Allowed values: 1–5");
    };

    const itemMap = new Map(
      evaluationItems.map((item) => [
        item.srNo,
        {
          evaluation: normalizeEval(item.evaluation),
          remarks: item.remarks?.trim() || "",
        },
      ])
    );

    const finalEvaluationItems = POAC_EVALUATION_ITEMS.map((master) => ({
      srNo: master.srNo,
      area: master.area,
      evaluation: itemMap.get(master.srNo)?.evaluation ?? null,
      remarks: itemMap.get(master.srNo)?.remarks ?? "",
    }));

    const evalDate = new Date(evaluationDate);
    const pathOpts = {
      formCode: "QAF-OFD-009",
      formSlug: "cross-competency",
      location: body.location?.trim() || null,
      date: evalDate,
      title: nameOfPOAC.trim(),
      fileType: "signatures",
    };

    let leadPOACSignature = body.leadPOACSignature?.trim() || null;
    if (isBase64DataUrl(leadPOACSignature)) {
      const saved = await saveBase64AsFile({
        ...pathOpts,
        fileName: "lead-poac-signature",
        base64DataUrl: leadPOACSignature,
      });
      if (saved) leadPOACSignature = saved;
    }

    let opsTeamSignature = body.opsTeamSignature?.trim() || null;
    if (isBase64DataUrl(opsTeamSignature)) {
      const saved = await saveBase64AsFile({
        ...pathOpts,
        fileName: "ops-team-signature",
        base64DataUrl: opsTeamSignature,
      });
      if (saved) opsTeamSignature = saved;
    }

    let opsTeamSupdtSignature = body.opsTeamSupdtSignature?.trim() || null;
    if (isBase64DataUrl(opsTeamSupdtSignature)) {
      const saved = await saveBase64AsFile({
        ...pathOpts,
        fileName: "ops-team-supdt-signature",
        base64DataUrl: opsTeamSupdtSignature,
      });
      if (saved) opsTeamSupdtSignature = saved;
    }

    const tempParentId = new mongoose.Types.ObjectId();

    const form = await PoacCrossCompetency.create({
      parentOperationId: tempParentId,
      isLatest: true,

      nameOfPOAC: nameOfPOAC.trim(),
      evaluationDate: evalDate,
      jobRefNo: jobRefNo.trim(),
      leadPOAC: leadPOAC.trim(),

      dischargingVessel: body.dischargingVessel?.trim(),
      receivingVessel: body.receivingVessel?.trim(),
      location: body.location?.trim(),
      typeOfOperation: body.typeOfOperation?.trim(),
      weatherCondition: body.weatherCondition?.trim(),

      deadweightDischarging:
        body.deadweightDischarging !== "" &&
        body.deadweightDischarging !== undefined
          ? Number(body.deadweightDischarging)
          : null,

      deadweightReceiving:
        body.deadweightReceiving !== "" &&
        body.deadweightReceiving !== undefined
          ? Number(body.deadweightReceiving)
          : null,

      revNo: "1.0",
      revDate: null,
      approvedBy: null,

      evaluationItems: finalEvaluationItems,

      leadPOACComment: body.leadPOACComment?.trim(),
      leadPOACName: body.leadPOACName?.trim(),
      leadPOACDate: body.leadPOACDate ? new Date(body.leadPOACDate) : null,
      leadPOACSignature,

      opsSupportTeamComment: body.opsSupportTeamComment?.trim(),

      opsTeamName: body.opsTeamName?.trim(),
      opsTeamDate: body.opsTeamDate ? new Date(body.opsTeamDate) : null,
      opsTeamSignature,

      opsTeamSupdtName: body.opsTeamSupdtName?.trim(),
      opsTeamSupdtDate: body.opsTeamSupdtDate
        ? new Date(body.opsTeamSupdtDate)
        : null,
      opsTeamSupdtSignature,

      status: body.status || "Draft",
      createdBy: body.createdBy || null,
    });

    form.parentOperationId = form._id;
    await form.save();

    return NextResponse.json(
      {
        success: true,
        message: "POAC Cross Competency form created successfully",
        data: form,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POAC CREATE ERROR:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
