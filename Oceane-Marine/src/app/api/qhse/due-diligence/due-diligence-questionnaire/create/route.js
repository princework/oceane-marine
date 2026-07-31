import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence";
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

export async function POST(req) {
  await connectDB();

  try {
    const contentType = req.headers.get("content-type") || "";
    let body;

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const formData = await req.formData();
      const dataStr = formData.get("data");
      if (!dataStr) {
        return NextResponse.json(
          { error: "Request must be JSON or multipart with 'data' field." },
          { status: 400, headers: corsHeaders }
        );
      }
      body = typeof dataStr === "string" ? JSON.parse(dataStr) : dataStr;
    }

    const signDate = body.generalDeclaration?.signedAt
      ? new Date(body.generalDeclaration.signedAt)
      : new Date();
    const supplierName = body.supplierDetails?.inchargeNameAndCompany || "Supplier";

    const pathOpts = {
      formCode: "QAF-OFD-043",
      formSlug: "due-diligence-questionnaire",
      date: signDate,
      title: supplierName,
    };

    let generalSigValue =
      body.generalDeclaration?.signatureImage ||
      body.generalDeclaration?.signature ||
      undefined;
    if (isBase64DataUrl(generalSigValue)) {
      const saved = await saveBase64AsFile({
        ...pathOpts,
        fileType: "signatures",
        fileName: "general-declaration-signature",
        base64DataUrl: generalSigValue,
      });
      if (saved) generalSigValue = saved;
    }

    let purchasingSigValue =
      body.purchasingDeclaration?.signatureImage ||
      body.purchasingDeclaration?.signature ||
      undefined;
    if (isBase64DataUrl(purchasingSigValue)) {
      const saved = await saveBase64AsFile({
        ...pathOpts,
        fileType: "signatures",
        fileName: "purchasing-declaration-signature",
        base64DataUrl: purchasingSigValue,
      });
      if (saved) purchasingSigValue = saved;
    }

    const additionalDocuments = [];
    if (Array.isArray(body.additionalDocuments)) {
      for (const doc of body.additionalDocuments) {
        if (!doc) continue;
        const docName = doc.name || doc.fileName;
        if (doc.base64 && isBase64DataUrl(doc.base64)) {
          const saved = await saveBase64AsFile({
            ...pathOpts,
            fileType: "documents",
            fileName: docName || "additional-document",
            base64DataUrl: doc.base64,
          });
          if (saved) {
            additionalDocuments.push({
              name: docName,
              fileName: doc.fileName || docName,
              filePath: saved,
            });
            continue;
          }
        }
        if (docName || doc.url || doc.filePath) {
          additionalDocuments.push({
            name: docName,
            fileName: doc.fileName || docName,
            url: doc.url,
            filePath: doc.filePath,
          });
        }
      }
    }

    const generalDeclaration = body.generalDeclaration
      ? {
          name: body.generalDeclaration.name,
          positionHeld: body.generalDeclaration.positionHeld,
          signedAt: body.generalDeclaration.signedAt
            ? new Date(body.generalDeclaration.signedAt)
            : undefined,
          signature: generalSigValue,
        }
      : undefined;

    const purchasingDeclaration = body.purchasingDeclaration
      ? {
          name: body.purchasingDeclaration.name,
          positionHeld: body.purchasingDeclaration.positionHeld,
          signedAt: body.purchasingDeclaration.signedAt
            ? new Date(body.purchasingDeclaration.signedAt)
            : undefined,
          signature: purchasingSigValue,
        }
      : undefined;

    const vendorId = typeof body.vendorId === "string" ? body.vendorId.trim() : "";
    if (!vendorId) {
      return NextResponse.json(
        { error: "vendorId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const payload = {
      vendorId,
      formCode: body.formCode,
      version: body.version,
      supplierDetails: body.supplierDetails,
      legalDeclarations: body.legalDeclarations,
      insuranceDetails: body.insuranceDetails,
      complianceDetails: body.complianceDetails,
      ethicsAndGovernance: body.ethicsAndGovernance,
      financialAndData: body.financialAndData,
      generalDeclaration,
      purchasingDeclaration,
      ...(additionalDocuments.length > 0 && { additionalDocuments }),
      status: "Pending",
      rejectionReason: "",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
    };

    // Upsert by vendorId — a client re-opening the same emailed link after a
    // rejection overwrites the prior submission and resets status to Pending.
    const existing = await SupplierDueDiligence.findOne({ vendorId });
    let record;
    let isUpdate = false;
    if (existing) {
      Object.assign(existing, payload);
      existing.bumpRevision?.();
      record = await existing.save();
      isUpdate = true;
    } else {
      record = await SupplierDueDiligence.create(payload);
    }

    return NextResponse.json(
      { success: true, data: record },
      { status: isUpdate ? 200 : 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[due-diligence-questionnaire create]", error);
    return NextResponse.json(
      { error: error.message || "Create failed." },
      { status: 500, headers: corsHeaders }
    );
  }
}
