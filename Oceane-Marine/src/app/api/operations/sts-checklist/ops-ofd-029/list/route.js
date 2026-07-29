import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MooringMasterExpenseSheet from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-029";

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
        query["personalDetails.invoiceDate"] = {
          $gte: startDate,
          $lt: endDate,
        };
      }
    }

    if (status) {
      query.status = status;
    }

    let expenseSheets = await MooringMasterExpenseSheet.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Backfill documentInfo.revisionNo for docs created before revision was added
    const byCreatedAsc = [...expenseSheets].reverse();
    expenseSheets = expenseSheets.map((sheet) => {
      const hasRevision = sheet.documentInfo?.revisionNo != null && String(sheet.documentInfo.revisionNo).trim() !== "";
      if (hasRevision) return sheet;
      const index = byCreatedAsc.findIndex((s) => String(s._id) === String(sheet._id));
      const revisionNo = index >= 0 ? `${index + 1}.0` : "1.0";
      return {
        ...sheet,
        documentInfo: {
          ...(sheet.documentInfo || {}),
          formNo: sheet.documentInfo?.formNo || "OPS-OFD-029",
          revisionNo,
          issueDate: sheet.documentInfo?.issueDate,
          approvedBy: sheet.documentInfo?.approvedBy,
        },
      };
    });

    // Get available years
    const allExpenseSheets = await MooringMasterExpenseSheet.find({
      "personalDetails.invoiceDate": { $exists: true, $ne: null },
    })
      .select("personalDetails.invoiceDate")
      .lean();

    const yearsSet = new Set();
    allExpenseSheets.forEach((sheet) => {
      if (sheet.personalDetails?.invoiceDate) {
        const sheetYear = new Date(sheet.personalDetails.invoiceDate).getFullYear();
        yearsSet.add(sheetYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return NextResponse.json(
      {
        success: true,
        data: expenseSheets,
        years: years.length > 0 ? years : [new Date().getFullYear()],
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-029 list error:", error);
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
