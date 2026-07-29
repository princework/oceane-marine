import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import MasterStsClient from "@/lib/mongodb/models/MasterStsClient";

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
    const { name } = await req.json();
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const existing = await MasterStsClient.findOne({ name: trimmed });
    if (existing) {
      return NextResponse.json(
        { error: "Client name already exists" },
        { status: 400 }
      );
    }

    const doc = new MasterStsClient({ name: trimmed });
    await doc.save();
    return NextResponse.json(
      { message: "Client created successfully", data: doc },
      { status: 201 }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: "Client name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
