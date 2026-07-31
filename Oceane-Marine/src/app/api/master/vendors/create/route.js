import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterVendor from "@/lib/mongodb/models/MasterVendor";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";

export async function POST(req) {
  const guard = await assertQhsePermission("canCreate");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { name, email } = await req.json();
    const trimmed = typeof name === "string" ? name.trim() : "";
    const trimmedEmail = typeof email === "string" ? email.trim() : "";

    if (!trimmed) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const existing = await MasterVendor.findOne({ name: trimmed });
    if (existing) {
      return NextResponse.json({ error: "Vendor name already exists" }, { status: 400 });
    }

    const doc = new MasterVendor({ name: trimmed, email: trimmedEmail.toLowerCase() });
    await doc.save();
    return NextResponse.json(
      { message: "Vendor created successfully", data: doc },
      { status: 201 }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "Vendor name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
