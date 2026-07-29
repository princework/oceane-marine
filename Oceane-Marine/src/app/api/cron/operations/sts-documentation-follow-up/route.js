import { NextResponse } from "next/server";
import { runStsDocumentationFollowUpJob } from "@/lib/services/email/stsDocumentationFollowUp";

/**
 * Daily cron: STS documentation follow-up emails (in-progress 7d/30d; completed + missing required docs ≥7d).
 * Secure with header: Authorization: Bearer <CRON_SECRET>
 *
 * Env:
 * - OPERATIONS_STS_DOCUMENTATION_FOLLOW_UP_TO_EMAIL — comma-separated recipients
 * - RESEND_API_KEY, RESEND_FROM_EMAIL
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
    const result = await runStsDocumentationFollowUpJob();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Job failed" },
      { status: 500 }
    );
  }
}
