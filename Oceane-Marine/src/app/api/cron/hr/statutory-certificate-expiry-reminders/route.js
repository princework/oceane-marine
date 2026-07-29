import { NextResponse } from "next/server";
import { runHrStatutoryCertificateExpiryReminderJob } from "@/lib/services/email/hrStatutoryCertificateExpiryReminders";

/**
 * HR Statutory Certificates — email at **30** and **15** UTC calendar days before `validity` (expiry).
 *
 * **Schedule:** At least once per UTC day (e.g. cron). ACTIVE records only.
 *
 * **Recipients:** HR_STATUTORY_CERTIFICATE_REMINDER_TO_EMAIL (comma-separated), fallback HR_TEAM_EMAIL.
 *
 * Secure in production: Authorization: Bearer <CRON_SECRET>
 *
 * Env: RESEND_API_KEY, RESEND_FROM_EMAIL, MONGODB_URI, CRON_SECRET (production)
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
    const result = await runHrStatutoryCertificateExpiryReminderJob();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Job failed" },
      { status: 500 }
    );
  }
}
