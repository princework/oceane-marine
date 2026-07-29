import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsQuotationForm from "@/lib/mongodb/models/operations-form-checklist/StsQuotationForm";

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const formType = searchParams.get("formType");

    let query = {};
    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
      query.$or = [
        { proposalDate: { $gte: startDate, $lte: endDate } },
        { operationDate: { $gte: startDate, $lte: endDate } },
        { createdAt: { $gte: startDate, $lte: endDate } },
      ];
    }
    if (formType && ["OPS-OFD-030", "OPS-OFD-030B", "POAC"].includes(formType)) {
      query.formType = formType;
    }

    const records = await StsQuotationForm.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
