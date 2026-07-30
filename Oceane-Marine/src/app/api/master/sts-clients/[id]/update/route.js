import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import MasterStsClient from "@/lib/mongodb/models/MasterStsClient";

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
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }

    await connectDB();
    const { name, email } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const trimmed = name.trim();

    const existing = await MasterStsClient.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const duplicate = await MasterStsClient.findOne({
      _id: { $ne: id },
      name: { $regex: `^${trimmed}$`, $options: "i" },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Client name already exists" },
        { status: 400 }
      );
    }

    existing.name = trimmed;
    existing.email = trimmedEmail ? trimmedEmail.toLowerCase() : undefined;
    await existing.save();

    return NextResponse.json(
      {
        message: "Client updated successfully",
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
