import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Manual from "@/lib/mongodb/models/operations-form-checklist/Manual";

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const formCode = searchParams.get("formCode");

    let query = {};
    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
      query.date = { $gte: startDate, $lte: endDate };
    }
    if (formCode) {
      query.formCode = formCode;
    }

    const records = await Manual.find(query)
      .sort({ uploadedAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: records,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
