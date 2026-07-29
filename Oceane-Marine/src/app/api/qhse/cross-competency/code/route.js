// code/route.js
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getQhseFormCode } from "@/lib/constants/qhse-form-codes";
import PoacCrossCompetency from "@/lib/mongodb/models/qhse-poac/PoacCrossCompetency";

export async function GET() {
  await connectDB();

  try {
    const formCode = getQhseFormCode("POAC_CROSS_COMPETENCY") || "";
    const formCount = await PoacCrossCompetency.countDocuments();
    const nextVersion = (formCount + 1).toFixed(1);

    return NextResponse.json(
      {
        success: true,
        formCode,
        version: nextVersion,
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
