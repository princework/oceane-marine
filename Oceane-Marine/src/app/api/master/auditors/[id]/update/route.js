import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/config/connection";
import MasterAuditor from "@/lib/mongodb/models/MasterAuditor";
import { assertQhseAdmin } from "@/lib/auth/qhseGuard";

export async function PATCH(req, { params }) {
  const guard = await assertQhseAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid auditor id" }, { status: 400 });
  }

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

    const existing = await MasterAuditor.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Auditor not found" }, { status: 404 });
    }

    const duplicate = await MasterAuditor.findOne({
      _id: { $ne: id },
      name: { $regex: `^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Auditor name already exists" }, { status: 400 });
    }

    existing.name = trimmed;
    existing.email = trimmedEmail.toLowerCase();
    await existing.save();

    return NextResponse.json({ message: "Auditor updated successfully", data: existing });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
