import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import User from "@/lib/mongodb/models/User";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.operationsRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();
    const users = await User.find({}, "-password").sort({ createdAt: -1 }).lean();

    return NextResponse.json({ success: true, users }, { status: 200 });
  } catch (error) {
    console.error("ADMIN LIST USERS ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
