import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import CargoType from "@/lib/mongodb/models/CargoType";

export async function GET() {
  await connectDB();
  try {
    const cargoTypes = await CargoType.find();
    return NextResponse.json({ cargoTypes });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
