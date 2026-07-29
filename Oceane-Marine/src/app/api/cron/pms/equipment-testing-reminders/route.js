import { NextResponse } from "next/server";
import { runPmsEquipmentTestingReminderJob } from "@/lib/services/email/pmsEquipmentTestingReminders";

/**
 * PMS primary equipment — testing reminders at **30** and **15 UTC calendar days** before `nextTestDate`.
 *
 * **Schedule:** Call this endpoint **at least once per UTC day** (e.g. Vercel Cron @ daily).
 * If the job only runs weekly, the exact day when `daysUntil === 30` or `15` may be missed.
 *
 * **Data:** Loads ACTIVE equipment with `nextTestDate`; email includes name, type, serial code,
 * equipment code, last/next test dates (from DB). Dedupe fields on Equipment prevent duplicate
 * sends for the same milestone and same `nextTestDate`.
 *
 * Secure with header: Authorization: Bearer <CRON_SECRET>
 *
 * Env:
 * - PMS_TESTING_REMINDER_TO_EMAIL — comma-separated (fallback: PMS_TEAM_EMAIL)
 * - RESEND_API_KEY, RESEND_FROM_EMAIL
 * - MONGODB_URI
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
    const result = await runPmsEquipmentTestingReminderJob();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Job failed" },
      { status: 500 }
    );
  }
}
