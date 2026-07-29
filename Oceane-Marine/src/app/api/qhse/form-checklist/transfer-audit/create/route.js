import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSTransferAudit from "@/lib/mongodb/models/qhse-form-checklist/StsTransferAudit";
import { saveSignatureBufferToPublic, saveBase64AsFile } from "@/lib/utils/qhse-file-storage";

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
    let completedBy = {};

    if (contentType.includes("application/json")) {
      body = await req.json();
      const cb = body.completedBy || {};
      const sig = cb.signature;

      if (sig && typeof sig === "string" && sig.startsWith("data:")) {
        const headerDate = body.header?.date ? new Date(body.header.date) : new Date();
        const sigPath = await saveBase64AsFile({
          formCode: "QAF-OFD-003",
          formSlug: "transfer-audit",
          location: body.header?.locationName || null,
          date: headerDate,
          title: body.header?.jobNo || "Transfer-Audit",
          fileType: "signatures",
          fileName: "completed-by-signature",
          base64DataUrl: sig,
        });
        completedBy = {
          name: cb.name,
          date: cb.date ? new Date(cb.date) : undefined,
          signaturePhoto: sigPath || sig,
        };
      } else {
        completedBy = {
          name: cb.name,
          date: cb.date ? new Date(cb.date) : undefined,
          signatureText: sig && typeof sig === "string" ? sig : undefined,
        };
      }
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
      const signatureFile = formData.get("signature");
      if (signatureFile) {
        const bytes = await signatureFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const headerDate = body.header?.date ? new Date(body.header.date) : new Date();

        const sigPath = await saveSignatureBufferToPublic({
          formSlug: "transfer-audit",
          date: headerDate,
          fileName: signatureFile.name,
          buffer,
        });
        completedBy = {
          ...body.completedBy,
          signatureUrl: sigPath,
          date: body.completedBy?.date ? new Date(body.completedBy.date) : undefined,
        };
      } else {
        const cb = body.completedBy || {};
        const sig = cb.signature;
        completedBy = {
          name: cb.name,
          date: cb.date ? new Date(cb.date) : undefined,
          signatureText: sig && typeof sig === "string" && !sig.startsWith("data:") ? sig : undefined,
          signaturePhoto: sig && typeof sig === "string" && sig.startsWith("data:") ? sig : undefined,
        };
      }
    }

    if (
      !body.header?.locationName ||
      !body.header?.date ||
      !body.header?.jobNo ||
      !body.header?.dischargingVessel ||
      !body.header?.receivingVessel
    ) {
      return NextResponse.json(
        { error: "All required header fields must be filled (Location, Date, Job No, Discharging Vessel, Receiving Vessel)." },
        { status: 400, headers: corsHeaders }
      );
    }

    const validAnswers = ["Yes", "No", "NA"];
    const sanitizeSection = (arr) =>
      Array.isArray(arr)
        ? arr.map((item) => ({
            ...item,
            answer:
              item?.answer && validAnswers.includes(item.answer) ? item.answer : undefined,
          }))
        : undefined;

    const formPayload = {
      formCode: body.formCode || undefined,
      version: body.version != null ? String(body.version) : "1.0",
      revisionDate:
        body.revisionDate && body.revisionDate !== ""
          ? new Date(body.revisionDate)
          : undefined,
      header: {
        locationName: body.header.locationName,
        date: new Date(body.header.date),
        jobNo: body.header.jobNo,
        dischargingVessel: body.header.dischargingVessel,
        receivingVessel: body.header.receivingVessel,
      },
      sectionA_PrePlanning: sanitizeSection(body.sectionA_PrePlanning),
      sectionB_MobilizationToDemobilization: sanitizeSection(
        body.sectionB_MobilizationToDemobilization
      ),
      sectionC_SupportCraft: sanitizeSection(body.sectionC_SupportCraft),
      sectionD_STSEquipment: sanitizeSection(body.sectionD_STSEquipment),
      sectionE_PostOperation: sanitizeSection(body.sectionE_PostOperation),
      comments: body.comments ? { remarks: body.comments.remarks } : undefined,
      completedBy,
      status: "Pending",
    };

    const newAudit = await STSTransferAudit.create(formPayload);

    return NextResponse.json(
      {
        message: "STS Transfer Audit created successfully",
        data: newAudit,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[transfer-audit create]", error);
    return NextResponse.json(
      { error: error.message || "Create failed." },
      { status: 500, headers: corsHeaders }
    );
  }
}
