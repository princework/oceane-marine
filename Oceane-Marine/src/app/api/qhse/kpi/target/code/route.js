import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getQhseFormCode } from "@/lib/constants/qhse-form-codes";

/** Returns the fixed form code for Target KPI (serial is assigned on save). */
export async function GET() {
  await connectDB();

  try {
    const formCode = getQhseFormCode("TARGET_KPI") || "";
    return NextResponse.json({ success: true, formCode });
  } catch (error) {
    console.error("Target KPI code error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
