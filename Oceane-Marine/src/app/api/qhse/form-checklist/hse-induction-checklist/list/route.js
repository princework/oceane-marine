import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import HseInductionChecklist from "@/lib/mongodb/models/qhse-form-checklist/HseInductionChecklist";
import { findWithMongoIdCursor } from "@/lib/qhse/mongoIdCursorPagination";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const useCursor = searchParams.get("paged") === "cursor";
    const cursor = searchParams.get("cursor");
    const limit = searchParams.get("limit");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    const allForms = await HseInductionChecklist.find({
      dateOfInduction: { $exists: true, $ne: null },
    })
      .select("dateOfInduction")
      .lean();

    const yearsSet = new Set();
    allForms.forEach((form) => {
      if (form.dateOfInduction) {
        const formYear = new Date(form.dateOfInduction).getFullYear();
        yearsSet.add(formYear);
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    if (useCursor) {
      const parts = [];
      if (!includeArchived) {
        parts.push({ isArchived: { $ne: true } });
      }
      if (year) {
        const yearNum = Number.parseInt(year, 10);
        const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${yearNum + 1}-01-01T00:00:00.000Z`);
        parts.push({
          dateOfInduction: { $gte: startDate, $lt: endDate },
        });
      }
      if (status && status !== "all") {
        if (status === "pending") parts.push({ status: "Pending" });
        else if (status === "approved") parts.push({ status: "Approved" });
        else if (status === "rejected") parts.push({ status: "Rejected" });
      }
      if (search && search.trim()) {
        const rx = new RegExp(escapeRegex(search.trim()), "i");
        parts.push({
          $or: [
            { serialNumber: rx },
            { formNo: rx },
            { employeeOrContractorName: rx },
          ],
        });
      }

      const filter = parts.length === 0 ? {} : { $and: parts };

      const { items, hasNext } = await findWithMongoIdCursor(
        HseInductionChecklist,
        filter,
        { cursor, limit }
      );

      return NextResponse.json(
        {
          success: true,
          data: items,
          hasNext,
          years: years.length > 0 ? years : [new Date().getFullYear()],
        },
        { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const query = {};
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    if (year) {
      const yearNum = Number.parseInt(year, 10);
      const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${yearNum + 1}-01-01T00:00:00.000Z`);
      query.dateOfInduction = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const forms = await HseInductionChecklist.find(query)
      .sort({ dateOfInduction: -1, createdAt: -1 })
      .lean();

    return NextResponse.json(
      {
        success: true,
        data: forms,
        years: years.length > 0 ? years : [new Date().getFullYear()],
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("HSE Induction Checklist List Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
