import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import VendorSupplierApproval from "@/lib/mongodb/models/qhse-form-checklist/VendorSupplierApproval";
import { saveBase64AsFile, isBase64DataUrl } from "@/lib/utils/qhse-file-storage";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit } from "@/lib/notifications/moduleNotify";

const isValidRating = (value) =>
  typeof value === "number" && value >= 1 && value <= 4;

const calculatePercentage = (values) => {
  const total = values.reduce((sum, v) => sum + v, 0);
  const max = values.length * 4;
  return Math.round((total / max) * 100);
};

export async function PUT(req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    const body = await req.json();
    const record = await VendorSupplierApproval.findById(id);

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Vendor approval record not found" },
        { status: 404 }
      );
    }

    if (record.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          error: "Only DRAFT records can be updated",
        },
        { status: 403 }
      );
    }

    if (body.vendorName) {
      record.vendorName = body.vendorName.trim();
    }
    if (body.vendorAddress) {
      record.vendorAddress = body.vendorAddress.trim();
    }
    if (body.date) {
      record.date = body.date;
    }
    if (body.year) {
      record.year = body.year;
    }
    if (body.requestedBy) {
      record.requestedBy = body.requestedBy.trim();
    }
    if (body.forAccountsSign) {
      record.forAccountsSign = body.forAccountsSign.trim();
    }

    const recordDate = record.date ? new Date(record.date) : new Date();
    const pathOpts = {
      formCode: "QAF-OFD-037",
      formSlug: "vendor-supply-form",
      date: recordDate,
      title: record.vendorName || "Vendor",
      fileType: "signatures",
    };

    if (isBase64DataUrl(body.requestedBySignatureImage)) {
      const p = await saveBase64AsFile({
        ...pathOpts,
        fileName: "requestedBy-signature",
        base64DataUrl: body.requestedBySignatureImage,
      });
      if (p) record.requestedBySignatureImage = p;
    }
    if (isBase64DataUrl(body.forAccountsSignSignatureImage)) {
      const p = await saveBase64AsFile({
        ...pathOpts,
        fileName: "forAccountsSign-signature",
        base64DataUrl: body.forAccountsSignSignatureImage,
      });
      if (p) record.forAccountsSignSignatureImage = p;
    }

    const parts = body.supplyOfParts || record.supplyOfParts || {};
    const services = body.supplyOfServices || record.supplyOfServices || {};

    const partsRatings = [
      parts.technicalComparison,
      parts.commercialComparison,
      parts.legalEntityForServiceOrSupply,
      parts.agreesToOceaneTerms,
      parts.infrastructureAndFacilities,
      parts.previousExperienceExpertise,
    ];

    if (partsRatings.some((v) => !isValidRating(v))) {
      return NextResponse.json(
        { success: false, error: "Invalid Supply of Parts ratings" },
        { status: 400 }
      );
    }

    const servicesRatings = [
      services.skilledManpowerAvailability,
      services.contractorCertifications,
      services.hseSystemDueDiligence,
      services.insuranceAndWorkPermit,
      services.previousExperienceYears,
    ];

    if (servicesRatings.some((v) => !isValidRating(v))) {
      return NextResponse.json(
        { success: false, error: "Invalid Supply of Services ratings" },
        { status: 400 }
      );
    }

    const partsPercentage = calculatePercentage(partsRatings);
    const servicesPercentage = calculatePercentage(servicesRatings);
    const overallPercentage = Math.round(
      (partsPercentage + servicesPercentage) / 2
    );

    record.supplyOfParts = {
      ...record.supplyOfParts,
      ...parts,
      percentageScore: partsPercentage,
    };

    record.supplyOfServices = {
      ...record.supplyOfServices,
      ...services,
      percentageScore: servicesPercentage,
    };

    record.overallPercentageScore = overallPercentage;
    record.approvedVendorEligible = overallPercentage >= 80;

    if (body.status) {
      record.status = body.status;
    }

    // Bump record revision (1.0 -> 1.1 -> 1.2 -> ...) on every edit.
    record.revNo = getNextRevisionNumber(record.revNo);

    await record.save();

    void notifyEdit("QHSE", "form-checklist · vendor-supply-form · update", id);
    return NextResponse.json(
      {
        success: true,
        data: record,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Vendor Supplier Approval Update Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
