import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import VendorApproval from "@/lib/mongodb/models/qhse-form-checklist/VendorSupplierApproval";
import { saveBase64AsFile, isBase64DataUrl } from "@/lib/utils/qhse-file-storage";

const isValidRating = (value) =>
  typeof value === "number" && value >= 1 && value <= 4;

const calculatePercentage = (values) => {
  const total = values.reduce((sum, v) => sum + v, 0);
  const max = values.length * 4;
  return Math.round((total / max) * 100);
};

export async function POST(req) {
  await connectDB();

  try {
    const body = await req.json();
    if (
      !body.vendorName ||
      !body.vendorAddress ||
      !body.date ||
      !body.year ||
      !body.requestedBy ||
      !body.forAccountsSign
    ) {
      return NextResponse.json(
        { error: "Missing required basic fields" },
        { status: 400 }
      );
    }

    const parts = body.supplyOfParts;
    if (
      !parts ||
      !isValidRating(parts.technicalComparison) ||
      !isValidRating(parts.commercialComparison) ||
      !isValidRating(parts.legalEntityForServiceOrSupply) ||
      !isValidRating(parts.agreesToOceaneTerms) ||
      !isValidRating(parts.infrastructureAndFacilities) ||
      !isValidRating(parts.previousExperienceExpertise)
    ) {
      return NextResponse.json(
        { error: "Invalid or missing Supply of Parts ratings" },
        { status: 400 }
      );
    }

    const partsPercentage = calculatePercentage([
      parts.technicalComparison,
      parts.commercialComparison,
      parts.legalEntityForServiceOrSupply,
      parts.agreesToOceaneTerms,
      parts.infrastructureAndFacilities,
      parts.previousExperienceExpertise,
    ]);

    const services = body.supplyOfServices;
    if (
      !services ||
      !isValidRating(services.skilledManpowerAvailability) ||
      !isValidRating(services.contractorCertifications) ||
      !isValidRating(services.hseSystemDueDiligence) ||
      !isValidRating(services.insuranceAndWorkPermit) ||
      !isValidRating(services.previousExperienceYears)
    ) {
      return NextResponse.json(
        { error: "Invalid or missing Supply of Services ratings" },
        { status: 400 }
      );
    }

    const servicesPercentage = calculatePercentage([
      services.skilledManpowerAvailability,
      services.contractorCertifications,
      services.hseSystemDueDiligence,
      services.insuranceAndWorkPermit,
      services.previousExperienceYears,
    ]);

    const overallPercentage = Math.round(
      (partsPercentage + servicesPercentage) / 2
    );

    const approvedVendorEligible = overallPercentage >= 80;

    const record = await VendorApproval.create({
      vendorName: body.vendorName,
      vendorAddress: body.vendorAddress,
      date: body.date,
      year: body.year,

      supplyOfParts: {
        ...parts,
        percentageScore: partsPercentage,
      },

      supplyOfServices: {
        ...services,
        percentageScore: servicesPercentage,
      },

      overallPercentageScore: overallPercentage,
      approvedVendorEligible,

      requestedBy: body.requestedBy,
      forAccountsSign: body.forAccountsSign,

      status: body.status,
    });

    const recordDate = body.date ? new Date(body.date) : new Date();
    const pathOpts = {
      formCode: "QAF-OFD-037",
      formSlug: "vendor-supply-form",
      date: recordDate,
      title: body.vendorName,
      fileType: "signatures",
    };

    let requestedByPath = null;
    let forAccountsPath = null;

    if (isBase64DataUrl(body.requestedBySignatureImage)) {
      requestedByPath = await saveBase64AsFile({
        ...pathOpts,
        fileName: "requestedBy-signature",
        base64DataUrl: body.requestedBySignatureImage,
      });
    }
    if (isBase64DataUrl(body.forAccountsSignSignatureImage)) {
      forAccountsPath = await saveBase64AsFile({
        ...pathOpts,
        fileName: "forAccountsSign-signature",
        base64DataUrl: body.forAccountsSignSignatureImage,
      });
    }

    if (requestedByPath || forAccountsPath) {
      if (requestedByPath) record.requestedBySignatureImage = requestedByPath;
      if (forAccountsPath) record.forAccountsSignSignatureImage = forAccountsPath;
      await record.save();
    }

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error("Create Vendor Approval Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
