import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterStsAgent from "@/lib/mongodb/models/MasterStsAgent";

export async function GET() {
  await connectDB();
  try {
    const agents = await MasterStsAgent.find().sort({ name: 1 }).lean();
    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
