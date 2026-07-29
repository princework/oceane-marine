import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Cid from "@/lib/mongodb/models/hr/Cid";
import { assertHrPermission } from "@/lib/auth/hrGuard";

export async function POST(req) {
  const guard = await assertHrPermission("canCreate");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const body = await req.json();
    const { title, name, location, validity } = body;

    // Validate fields
    if (!title || !title.trim()) {
      return NextResponse.json({ message: "Title is required" }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }
    if (!location || !location.trim()) {
      return NextResponse.json({ message: "Location is required" }, { status: 400 });
    }
    if (!validity) {
      return NextResponse.json({ message: "Validity is required" }, { status: 400 });
    }

    const cid = await Cid.create({
      title: title.trim(),
      name: name.trim(),
      location: location.trim(),
      validity: new Date(validity),
    });

    return NextResponse.json({ data: cid }, { status: 201 });
  } catch (err) {
    console.error("CID creation error:", err);
    return NextResponse.json(
      { message: err.message || "Creation failed", error: err.message },
      { status: 500 }
    );
  }
}
