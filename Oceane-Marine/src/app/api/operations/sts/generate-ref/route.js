import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Counter from "@/lib/mongodb/models/generateFormCode";
import { formatStsOperationRef } from "@/lib/operations/formatStsOperationRef";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year");

    // Use provided year or current year
    const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear();

    if (Number.isNaN(year)) {
      return NextResponse.json(
        { success: false, error: "Invalid year parameter" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate operation ref number
    const counter = await Counter.findOneAndUpdate(
      { key: "STS_OPERATION", year },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const operationRef = formatStsOperationRef(year, counter.seq);

    return NextResponse.json(
      {
        success: true,
        operationRef,
        year,
        sequence: counter.seq,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Operation Ref Generation Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate operation ref" },
      { status: 500, headers: corsHeaders }
    );
  }
}
