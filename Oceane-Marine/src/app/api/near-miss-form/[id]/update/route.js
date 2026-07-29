import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import NearMiss from "@/lib/mongodb/models/qhse-near-miss/NearMiss";
import { getNextRevisionNumber } from "@/lib/utils/qhse-revision";
import { notifyEdit } from "@/lib/notifications/moduleNotify";
import { sendResendEmail } from "@/lib/services/email/sendResendEmail";
import { buildNearMissReviewedSubmitterEmail } from "@/lib/services/email/templates/QHSE/nearMissReviewedSubmitterEmail";

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

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const { id } = await params;
    const body = await req.json();
    const { remarksByReviewer } = body || {};
    
    const nearMiss = await NearMiss.findById(id);
    if (!nearMiss) {
      return NextResponse.json(
        { error: "Near miss not found" },
        { status: 404 }
      );
    }
    
    if (nearMiss.status === "Reviewed") {
      return NextResponse.json(
        { error: "Near miss already reviewed" },
        { status: 400 }
      );
    }
    
    nearMiss.status = "Reviewed";
    if (remarksByReviewer !== undefined) {
      nearMiss.remarksByReviewer = remarksByReviewer || "";
    }
    nearMiss.revNo = getNextRevisionNumber(nearMiss.revNo);

    await nearMiss.save();

    void notifyEdit("QHSE", "update", id);

    const to = nearMiss.email?.trim();
    const resendReady =
      process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim();
    const skipReviewedMail =
      process.env.NEAR_MISS_REVIEWED_SUBMITTER_EMAIL_DISABLED === "1" ||
      process.env.NEAR_MISS_REVIEWED_SUBMITTER_EMAIL_DISABLED === "true";

    if (to && resendReady && !skipReviewedMail) {
      try {
        const { subject, html, text } = buildNearMissReviewedSubmitterEmail({
          recipientName: nearMiss.NameOfObserver,
          jobNo: nearMiss.JobRefNo,
          incidentDateFormatted: formatIncidentDateUtcEnGb(nearMiss.timeOfIncident),
          description: nearMiss.Description,
          immediateCause: nearMiss.ImmediateCause,
          rootCause: nearMiss.RootCause,
          correctiveAction: nearMiss.CorrectiveAction,
          remarksByReviewer: nearMiss.remarksByReviewer || "",
        });
        await sendResendEmail({ to, subject, html, text });
      } catch (err) {
        console.error("Near miss reviewed — submitter email failed:", err.message || err);
      }
    }

    return NextResponse.json(
      { 
        message: "Near miss updated successfully", 
        data: nearMiss 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update Near Miss Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update near miss" }, 
      { status: 500 }
    );
  }
}
