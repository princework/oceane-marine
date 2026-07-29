import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MooringMaster from "@/lib/mongodb/models/MooringMaster";

export async function GET() {
  await connectDB();
  try {
    const mooringMasters = await MooringMaster.find();
    return NextResponse.json({ mooringMasters });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
