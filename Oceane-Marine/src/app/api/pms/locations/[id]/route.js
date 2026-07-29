import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/config/connection";
import PmsLocation from "@/lib/mongodb/models/pms/PmsLocation";
import { assertPmsAdmin } from "@/lib/auth/pmsGuard";

export async function PUT(req, { params }) {
  const guard = await assertPmsAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "Invalid location id" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ message: "Location name is required" }, { status: 400 });
    }

    await connectDB();
    const updated = await PmsLocation.findByIdAndUpdate(
      id,
      { name },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ message: "Location not found" }, { status: 404 });
    }

    return NextResponse.json({ location: updated });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { message: "A location with this name already exists" },
        { status: 409 }
      );
    }
    console.error("PMS location update error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to update location" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req, { params }) {
  const guard = await assertPmsAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "Invalid location id" }, { status: 400 });
  }

  try {
    await connectDB();
    const deleted = await PmsLocation.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ message: "Location not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PMS location delete error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to delete location" },
      { status: 500 }
    );
  }
}
