import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsQuotationForm from "@/lib/mongodb/models/operations-form-checklist/StsQuotationForm";

export async function GET(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const doc = await StsQuotationForm.findById(id).lean();
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Quotation form not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
