import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsQuotationForm from "@/lib/mongodb/models/operations-form-checklist/StsQuotationForm";
import { notifyOperationsEdit } from "@/lib/notifications/operationsNotified";

const DATE_FIELDS = [
  "proposalDate",
  "issueDate",
  "operationDate",
  "acceptanceDate",
  "acceptanceDate030B",
];

function sanitize(body) {
  const out = { ...body };
  DATE_FIELDS.forEach((key) => {
    if (out[key] != null && out[key] !== "") {
      const d = new Date(out[key]);
      out[key] = Number.isNaN(d.getTime()) ? null : d;
    } else {
      out[key] = null;
    }
  });
  delete out._id;
  delete out.__v;
  delete out.createdAt;
  return out;
}

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const body = await req.json();

    const sig = String(body.acceptanceSignatureText ?? "").trim();
    if (["OPS-OFD-030", "OPS-OFD-030B", "POAC"].includes(body.formType) && !sig) {
      return NextResponse.json(
        { success: false, error: "Signature is required." },
        { status: 400 }
      );
    }
    body.acceptanceSignatureImage = "";

    const doc = await StsQuotationForm.findByIdAndUpdate(
      id,
      { $set: sanitize(body) },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Quotation form not found" },
        { status: 404 }
      );
    }
    notifyOperationsEdit("STS Quotation", id).catch(() => {});
    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
