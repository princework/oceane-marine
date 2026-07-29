import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import User from "@/lib/mongodb/models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { buildAccessTokenCookieHeader } from "@/lib/auth/accessTokenCookie";

export async function POST(req) {
  try {
    await connectDB();

    const { email, password } = await req.json();
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, "i") } });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "2h", // keep in sync with access_token cookie Max-Age (middleware ACCESS_TOKEN_MAX_AGE_SEC)
    });

    const userObj = user.toObject();
    delete userObj.password;

    const response = NextResponse.json(
      { message: "Login successful", user: userObj },
      { status: 200 }
    );

    // Set cookie using Response API (Next.js 14+)
    const maxAgeSec = 2 * 60 * 60; // 2h — must match JWT expiresIn above
    response.headers.set(
      "Set-Cookie",
      `access_token=${token}; HttpOnly; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`
    );

    return response;
  } catch (error) {
    console.log("LOGIN ERROR:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
