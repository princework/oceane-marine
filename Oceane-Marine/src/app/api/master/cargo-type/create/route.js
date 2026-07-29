import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import CargoType from "@/lib/mongodb/models/CargoType";

export async function POST(req) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.operationsRole !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin role required" },
        { status: 403 }
      );
    }
    await connectDB();
    const { type } = await req.json();
    const existingCargoType = await CargoType.findOne({ type });
    if (existingCargoType) {
      return NextResponse.json(
        { error: "Cargo type already exists" },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json({ error: "Type is required" }, { status: 400 });
    }

    const newCargoType = new CargoType({ type });
    await newCargoType.save();
    return NextResponse.json(
      { message: "Cargo type created successfully", data: newCargoType },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
