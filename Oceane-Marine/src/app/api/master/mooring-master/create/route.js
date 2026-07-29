import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import MooringMaster from "@/lib/mongodb/models/MooringMaster";

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
    const { name, email } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!email || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Case-insensitive duplicate check
    const existingMooringMaster = await MooringMaster.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
    });

    if (existingMooringMaster) {
      return NextResponse.json(
        { error: "Mooring master already exists" },
        { status: 400 }
      );
    }

    const newMooringMaster = await MooringMaster.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      availabilityStatus: "AVAILABLE",
      currentOperation: null,
    });

    return NextResponse.json(
      {
        message: "Mooring master created successfully",
        data: newMooringMaster,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
