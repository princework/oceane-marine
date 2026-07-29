import { NextResponse } from "next/server";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { connectDB } from "@/lib/config/connection";

export async function POST(req) {
  try {
    await connectDB();
    const { parentOperationId } = await req.json();

    const versions = await StsOperation.find({ parentOperationId }).sort({
      version: 1,
    });
    return NextResponse.json({ versions });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
