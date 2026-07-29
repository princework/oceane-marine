import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Cid from "@/lib/mongodb/models/hr/Cid";
import { assertHrPermission } from "@/lib/auth/hrGuard";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function PUT(req, { params }) {
  const guard = await assertHrPermission("canEdit");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;
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

    const existing = await Cid.findById(id);
    if (!existing) {
      return NextResponse.json({ message: "CID record not found" }, { status: 404 });
    }

    const updated = await Cid.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        name: name.trim(),
        location: location.trim(),
        validity: new Date(validity),
      },
      { new: true }
    );

    void notifyEdit("HR", "cid · update", id);
    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (err) {
    console.error("CID update error:", err);
    return NextResponse.json(
      { message: err.message || "Update failed", error: err.message },
      { status: 500 }
    );
  }
}
