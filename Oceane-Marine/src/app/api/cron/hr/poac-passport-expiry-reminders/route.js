import { NextResponse } from "next/server";
import { runPoacPassportExpiryReminderJob } from "@/lib/services/email/poacPassportExpiryReminders.js";

/**
 * Daily cron: POAC Valid Passport + Master's COC + Valid Medicals —
 * - 5 UTC days before expiry (expiring soon)
 * - 1 UTC day after expiry (has expired)
 * Secure with header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured" },
        { status: 500 }
      );
    }
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPoacPassportExpiryReminderJob();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Job failed" },
      { status: 500 }
    );
  }
}
