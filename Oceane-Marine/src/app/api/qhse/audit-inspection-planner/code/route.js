// code/route.js
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getQhseFormCode } from "@/lib/constants/qhse-form-codes";

export async function GET() {
  await connectDB();

  try {
    const formCode = getQhseFormCode("AUDIT_INSPECTION_PLANNER") || "";

    return NextResponse.json(
      {
        success: true,
        formCode,
        version: "1.0",
        revisionDate: new Date(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
