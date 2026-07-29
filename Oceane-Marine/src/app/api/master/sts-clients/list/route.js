import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterStsClient from "@/lib/mongodb/models/MasterStsClient";

export async function GET() {
  await connectDB();
  try {
    const clients = await MasterStsClient.find().sort({ name: 1 }).lean();
    return NextResponse.json({ clients });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
