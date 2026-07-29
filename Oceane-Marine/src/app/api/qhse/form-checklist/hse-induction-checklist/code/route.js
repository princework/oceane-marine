import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getQhseFormCode } from "@/lib/constants/qhse-form-codes";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET() {
  await connectDB();
  try {
    const formCode = getQhseFormCode("HSE_INDUCTION_CHECKLIST") || "";
    return NextResponse.json(
      {
        success: true,
        formCode,
        version: "1.0",
        revisionDate: new Date(),
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("HSE Induction Checklist Code Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
