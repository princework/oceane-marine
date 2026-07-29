import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterFeedbackForm from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-020";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const status = searchParams.get("status");

    const query = {};

    if (year) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${yearNum + 1}-01-01T00:00:00.000Z`);
        query["jobDetails.dateOfOperation"] = {
          $gte: startDate,
          $lt: endDate,
        };
      }
    }

    if (status) {
      query.status = status;
    }

    let forms = await MasterFeedbackForm.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Backfill documentInfo.revisionNo for docs created before revision was added
    const byCreatedAsc = [...forms].reverse();
    forms = forms.map((doc) => {
      const hasRevision = doc.documentInfo?.revisionNo != null && String(doc.documentInfo.revisionNo).trim() !== "";
      if (hasRevision) return doc;
      const index = byCreatedAsc.findIndex((d) => String(d._id) === String(doc._id));
      const revisionNo = index >= 0 ? `${index + 1}.0` : "1.0";
      return {
        ...doc,
        documentInfo: {
          ...(doc.documentInfo || {}),
          formNo: doc.documentInfo?.formNo || "OPS-OFD-020",
          revisionNo,
          issueDate: doc.documentInfo?.issueDate,
          approvedBy: doc.documentInfo?.approvedBy,
        },
      };
    });

    // Get available years
    const allForms = await MasterFeedbackForm.find({
      "jobDetails.dateOfOperation": { $exists: true, $ne: null },
    })
      .select("jobDetails.dateOfOperation")
      .lean();

    const yearsSet = new Set();
    allForms.forEach((form) => {
      if (form.jobDetails?.dateOfOperation) {
        const formYear = new Date(form.jobDetails.dateOfOperation).getFullYear();
        yearsSet.add(formYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return NextResponse.json(
      {
        success: true,
        data: forms,
        years: years.length > 0 ? years : [new Date().getFullYear()],
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-020 list error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
