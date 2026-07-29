import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import PmsLocation from "@/lib/mongodb/models/pms/PmsLocation";
import { assertPmsAdmin } from "@/lib/auth/pmsGuard";

export async function POST(req) {
  const guard = await assertPmsAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ message: "Location name is required" }, { status: 400 });
    }

    await connectDB();
    const doc = await PmsLocation.create({ name });
    return NextResponse.json({ location: doc.toObject() }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { message: "A location with this name already exists" },
        { status: 409 }
      );
    }
    console.error("PMS location create error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to create location" },
      { status: 500 }
    );
  }
}
