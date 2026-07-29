import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import STSStandingOrder from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-011";

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
        query["signatureBlock.signedDate"] = {
          $gte: startDate,
          $lt: endDate,
        };
      }
    }

    if (status) {
      query.status = status;
    }

    const orders = await STSStandingOrder.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Get available years
    const allOrders = await STSStandingOrder.find({
      "signatureBlock.signedDate": { $exists: true, $ne: null },
    })
      .select("signatureBlock.signedDate")
      .lean();

    const yearsSet = new Set();
    allOrders.forEach((order) => {
      if (order.signatureBlock?.signedDate) {
        const orderYear = new Date(order.signatureBlock.signedDate).getFullYear();
        yearsSet.add(orderYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return NextResponse.json(
      {
        success: true,
        data: orders,
        years: years.length > 0 ? years : [new Date().getFullYear()],
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("OPS-OFD-011 list error:", error);
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
