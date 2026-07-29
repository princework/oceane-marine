import { NextResponse } from "next/server";
import { runPmsWarehouseEstimatedEndOverdueJob } from "@/lib/services/email/pmsWarehouseEstimatedEndOverdue";

/**
 * PMS Warehouse Management — email when `estimatedEndDate` is exceeded by more than 2 UTC calendar days
 * (default: first run when today is ≥ 3 calendar days after end; override with PMS_WAREHOUSE_OVERDUE_MIN_DAYS_PAST_END).
 *
 * **Schedule:** At least once per UTC day (e.g. cron). Only `NOT_COMPLETED` rows with an estimated end date.
 *
 * **Recipients:** PMS_WAREHOUSE_OVERDUE_TO_EMAIL (comma-separated), fallback PMS_TEAM_EMAIL.
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
    const result = await runPmsWarehouseEstimatedEndOverdueJob();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Job failed" },
      { status: 500 }
    );
  }
}
