import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Counter from "@/lib/mongodb/models/generateFormCode";

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
    const counter = await Counter.findOneAndUpdate(
      { key: "MANUAL" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const formCode = `OPS-MAN-${String(counter.seq).padStart(3, "0")}`;
    const revNo = "1.0";
    const revisionDate = new Date();

    return NextResponse.json(
      {
        success: true,
        formCode: formCode,
        revNo: revNo,
        revisionDate: revisionDate,
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("Manual Code Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
