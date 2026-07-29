import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsQuotationForm from "@/lib/mongodb/models/operations-form-checklist/StsQuotationForm";

export async function POST(req) {
  await connectDB();
  try {
    const body = await req.json();

    const sig = String(body.acceptanceSignatureText ?? "").trim();
    if (["OPS-OFD-030", "OPS-OFD-030B", "POAC"].includes(body.formType) && !sig) {
      return NextResponse.json(
        { success: false, error: "Signature is required." },
        { status: 400 }
      );
    }
    body.acceptanceSignatureImage = "";

    const {
      formType,
      formNo,
      issueDate,
      clientName,
      attn,
      proposalDate,
      projectName,
      jobRef,
      dischargingShip,
      receivingShip,
      operationDate,
      location,
      cargo,
      quantity,
      quantityUnit,
      lumpSum,
      thereafter,
      freeTime,
      availability,
      paymentTerms,
      primaryFenders,
      secondaryFenders,
      fenderMoorings,
      hoses,
      supportCraft,
      personnelTransferBasket,
      baseInfoLocation,
      acceptanceClientName,
      personInCharge,
      acceptanceDate,
      acceptanceSignatureText,
      acceptanceSignatureImage,
      designatedAdvisor,
      dailyRate,
      managementFee,
      flightsTravel,
      localLogistics,
      communicationCharges,
      acceptanceName,
      acceptanceAddress,
      acceptanceEmail,
      acceptanceTelephone,
      authorizedSignatoryFor,
      acceptanceDate030B,
      serviceOverviewFrom,
      serviceOverviewTo,
    } = body;

    if (!formType || !["OPS-OFD-030", "OPS-OFD-030B", "POAC"].includes(formType)) {
      return NextResponse.json(
        { error: "formType is required and must be OPS-OFD-030, OPS-OFD-030B, or POAC" },
        { status: 400 }
      );
    }

    const doc = await StsQuotationForm.create({
      formType,
      formNo: formNo ?? "",
      issueDate: issueDate ? new Date(issueDate) : null,
      clientName: clientName ?? "",
      attn: attn ?? "",
      proposalDate: proposalDate ? new Date(proposalDate) : null,
      projectName: projectName ?? "",
      jobRef: jobRef ?? "",
      dischargingShip: dischargingShip ?? "",
      receivingShip: receivingShip ?? "",
      operationDate: operationDate ? new Date(operationDate) : null,
      location: location ?? "",
      cargo: cargo ?? "",
      quantity: quantity ?? "",
      quantityUnit: quantityUnit ?? "BBLS",
      lumpSum: lumpSum ?? "",
      thereafter: thereafter ?? "",
      freeTime: freeTime ?? "",
      availability: availability ?? "",
      paymentTerms: paymentTerms ?? "",
      primaryFenders: primaryFenders ?? "",
      secondaryFenders: secondaryFenders ?? "",
      fenderMoorings: fenderMoorings ?? "",
      hoses: hoses ?? "",
      supportCraft: supportCraft ?? "",
      personnelTransferBasket: personnelTransferBasket ?? "",
      baseInfoLocation: baseInfoLocation ?? "",
      acceptanceClientName: acceptanceClientName ?? "",
      personInCharge: personInCharge ?? "",
      acceptanceDate: acceptanceDate ? new Date(acceptanceDate) : null,
      acceptanceSignatureText: acceptanceSignatureText ?? "",
      acceptanceSignatureImage: acceptanceSignatureImage ?? "",
      designatedAdvisor: designatedAdvisor ?? "",
      dailyRate: dailyRate ?? "",
      managementFee: managementFee ?? "",
      flightsTravel: flightsTravel ?? "",
      localLogistics: localLogistics ?? "",
      communicationCharges: communicationCharges ?? "",
      acceptanceName: acceptanceName ?? "",
      acceptanceAddress: acceptanceAddress ?? "",
      acceptanceEmail: acceptanceEmail ?? "",
      acceptanceTelephone: acceptanceTelephone ?? "",
      authorizedSignatoryFor: authorizedSignatoryFor ?? "",
      acceptanceDate030B: acceptanceDate030B ? new Date(acceptanceDate030B) : null,
      serviceOverviewFrom: serviceOverviewFrom ?? "",
      serviceOverviewTo: serviceOverviewTo ?? "",
    });

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
