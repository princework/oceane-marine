import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import MooringMaster from "@/lib/mongodb/models/MooringMaster";

export async function PATCH(req, { params }) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.operationsRole !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin role required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid mooring master id" }, { status: 400 });
    }

    await connectDB();
    const { name } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const trimmed = name.trim();

    const existing = await MooringMaster.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Mooring master not found" }, { status: 404 });
    }

    const duplicate = await MooringMaster.findOne({
      _id: { $ne: id },
      name: { $regex: `^${trimmed}$`, $options: "i" },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Mooring master already exists" },
        { status: 400 }
      );
    }

    existing.name = trimmed;
    await existing.save();

    return NextResponse.json(
      {
        message: "Mooring master updated successfully",
        data: existing,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
