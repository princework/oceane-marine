import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import VendorSupplierApproval from "@/lib/mongodb/models/qhse-form-checklist/VendorSupplierApproval";
import { findWithMongoIdCursor } from "@/lib/qhse/mongoIdCursorPagination";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const useCursor = searchParams.get("paged") === "cursor";
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    // Build the year list once — covers both the explicit `year` field and
    // the `date` field — so the year filter dropdown reflects every record
    // that exists, not just the rolling window the client computes locally.
    const allRecords = await VendorSupplierApproval.find({})
      .select("year date")
      .lean();
    const yearsSet = new Set();
    allRecords.forEach((rec) => {
      if (rec.year && !Number.isNaN(Number(rec.year))) {
        yearsSet.add(Number(rec.year));
      }
      if (rec.date) {
        const dateYear = new Date(rec.date).getFullYear();
        if (!Number.isNaN(dateYear)) yearsSet.add(dateYear);
      }
    });
    const years = Array.from(yearsSet).sort((a, b) => b - a);

    if (useCursor) {
      const yearParam = searchParams.get("year");
      const statusParam = searchParams.get("status");
      const excludeDraft = searchParams.get("excludeDraft") === "1";
      const search = searchParams.get("search");
      const cursor = searchParams.get("cursor");
      const limit = searchParams.get("limit");

      const parts = [];
      if (!includeArchived) {
        parts.push({ isArchived: { $ne: true } });
      }
      if (yearParam) {
        const y = Number.parseInt(yearParam, 10);
        if (!Number.isNaN(y)) {
          const start = new Date(`${y}-01-01T00:00:00.000Z`);
          const end = new Date(`${y}-12-31T23:59:59.999Z`);
          parts.push({
            $or: [{ year: y }, { date: { $gte: start, $lte: end } }],
          });
        }
      }
      if (excludeDraft) {
        parts.push({ status: { $ne: "DRAFT" } });
      }
      if (statusParam && statusParam !== "ALL") {
        parts.push({ status: statusParam });
      }
      if (search && search.trim()) {
        const rx = new RegExp(escapeRegex(search.trim()), "i");
        parts.push({
          $or: [
            { serialNumber: rx },
            { formCode: rx },
            { vendorName: rx },
          ],
        });
      }

      const filter = parts.length === 0 ? {} : { $and: parts };

      const { items, hasNext } = await findWithMongoIdCursor(
        VendorSupplierApproval,
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
        { status: 200 }
      );
    }

    const yearParam = searchParams.get("year");

    const nonCursorQuery = includeArchived
      ? {}
      : { isArchived: { $ne: true } };

    let forms = await VendorSupplierApproval.find(nonCursorQuery)
      .sort({ createdAt: -1 })
      .lean();

    if (yearParam) {
      const year = Number.parseInt(yearParam, 10);
      forms = forms.filter((form) => {
        if (form.year) {
          return form.year === year;
        }
        if (form.date) {
          const dateYear = new Date(form.date).getFullYear();
          return dateYear === year;
        }
        return false;
      });
    }

    forms.sort((a, b) => {
      const yearA = a.year || (a.date ? new Date(a.date).getFullYear() : 0);
      const yearB = b.year || (b.date ? new Date(b.date).getFullYear() : 0);
      if (yearB !== yearA) {
        return yearB - yearA;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return NextResponse.json(
      {
        success: true,
        data: forms,
        years: years.length > 0 ? years : [new Date().getFullYear()],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Vendor Supplier Approval List Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
