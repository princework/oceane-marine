import { NextResponse } from "next/server";
import { runCidExpiryReminderJob } from "@/lib/services/email/cidExpiryReminders.js";

/**
 * Daily cron: send CID expiry reminders (5 days before validity, UTC calendar day).
 * Secure with header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
    }
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCidExpiryReminderJob();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Job failed" },
      { status: 500 }
    );
  }
}
