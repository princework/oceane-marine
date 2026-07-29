import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence";
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

    if (!useCursor) {
      const nonCursorQuery = includeArchived
        ? {}
        : { isArchived: { $ne: true } };
      const supplierDueDiligences = await SupplierDueDiligence.find(
        nonCursorQuery
      )
        .sort({ _id: -1 })
        .lean();
      return NextResponse.json({ supplierDueDiligences });
    }

    const limit = searchParams.get("limit");
    const cursor = searchParams.get("cursor");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const parts = [];
    if (!includeArchived) {
      parts.push({ isArchived: { $ne: true } });
    }
    if (status && status !== "All") {
      parts.push({ status });
    }
    if (search && search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), "i");
      parts.push({
        $or: [
          { serialNumber: rx },
          { formCode: rx },
          { companyName: rx },
          { contact: rx },
          { "supplierDetails.inchargeNameAndCompany": rx },
          { "supplierDetails.contactDetails": rx },
        ],
      });
    }

    const filter = parts.length === 0 ? {} : { $and: parts };

    const { items, hasNext } = await findWithMongoIdCursor(
      SupplierDueDiligence,
      filter,
      { cursor, limit }
    );

    return NextResponse.json({
      success: true,
      data: items,
      hasNext,
      supplierDueDiligences: items,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
