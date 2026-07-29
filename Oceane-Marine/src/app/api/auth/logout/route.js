import { NextResponse } from "next/server";
import { buildAccessTokenCookieHeader } from "@/lib/auth/accessTokenCookie";

export async function POST() {
  try {
    const response = NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 }
    );

    response.headers.set(
      "Set-Cookie",
      `access_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
    );

    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
