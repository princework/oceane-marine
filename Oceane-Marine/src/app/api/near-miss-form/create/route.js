import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import NearMiss from "@/lib/mongodb/models/qhse-near-miss/NearMiss";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import { buildNearMissSubmissionConfirmationEmail } from "@/lib/services/email/templates/QHSE/nearMissSubmissionConfirmation";
import {
  buildNearMissReviewUrl,
  buildNearMissTeamNotificationEmail,
} from "@/lib/services/email/templates/QHSE/nearMissTeamNotification";

function parseNearMissTeamRecipients() {
  const raw = process.env.NEAR_MISS_EMAIL_TO || "";
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatIncidentDateUtcEnGb(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "—";
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req) {
  await connectDB();

  try {
    const body = await req.json();
    const newNearMiss = await new NearMiss(body).save();

    const to = newNearMiss.email?.trim();
    const resendReady =
      process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim();
    const skipConfirmation =
      process.env.NEAR_MISS_SUBMITTER_EMAIL_DISABLED === "1" ||
      process.env.NEAR_MISS_SUBMITTER_EMAIL_DISABLED === "true";

    if (to && resendReady && !skipConfirmation) {
      const vessel = newNearMiss.VesselName?.trim() || "";
      const area = newNearMiss.AreaOfNearMiss?.trim() || "";
      const locationLine = [vessel, area].filter(Boolean).join(" — ") || "—";

      try {
        const { subject, html, text } = buildNearMissSubmissionConfirmationEmail({
          recipientName: newNearMiss.NameOfObserver,
          jobNo: newNearMiss.JobRefNo,
          locationLine,
        });
        await sendResendEmail({ to, subject, html, text });
      } catch (err) {
        console.error("Near miss submitter confirmation email failed:", err.message || err);
      }
    }

    const teamTo = parseNearMissTeamRecipients();
    const skipTeam =
      process.env.NEAR_MISS_TEAM_EMAIL_DISABLED === "1" ||
      process.env.NEAR_MISS_TEAM_EMAIL_DISABLED === "true";

    if (teamTo.length > 0 && resendReady && !skipTeam) {
      const vessel = newNearMiss.VesselName?.trim() || "";
      const area = newNearMiss.AreaOfNearMiss?.trim() || "";
      const locationLine = [vessel, area].filter(Boolean).join(" — ") || "—";
      const reviewUrl = buildNearMissReviewUrl(newNearMiss._id);

      try {
        const { subject, html, text } = buildNearMissTeamNotificationEmail({
          submitterName: newNearMiss.NameOfObserver,
          incidentDateFormatted: formatIncidentDateUtcEnGb(newNearMiss.timeOfIncident),
          locationLine,
          reviewUrl,
        });
        await sendResendEmail({ to: teamTo, subject, html, text });
      } catch (err) {
        console.error("Near miss team notification email failed:", err.message || err);
      }
    }

    return NextResponse.json(
      {
        message: "Near miss form created successfully",
        data: newNearMiss,
        status: "Under Review",
        remarksByReviewer: "",
      },
      {
        status: 201,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
