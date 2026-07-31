import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import SubContractorAudit from "@/lib/mongodb/models/qhse-due-diligence/SubContractorAudit";
import MasterAuditor from "@/lib/mongodb/models/MasterAuditor";
import { findWithMongoIdCursor } from "@/lib/qhse/mongoIdCursorPagination";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Attaches { auditorName, auditorEmail } to each record from its auditorId. */
async function withAuditorNames(records) {
  const ids = [...new Set(records.map((r) => r.auditorId).filter(Boolean).map(String))];
  if (ids.length === 0) return records;
  const auditors = await MasterAuditor.find({ _id: { $in: ids } })
    .select("name email")
    .lean();
  const byId = new Map(auditors.map((a) => [String(a._id), a]));
  return records.map((r) => {
    const auditor = r.auditorId ? byId.get(String(r.auditorId)) : null;
    return {
      ...r,
      auditorName: auditor?.name || null,
      auditorEmail: auditor?.email || null,
    };
  });
}

export async function GET(req) {
  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const useCursor = searchParams.get("paged") === "cursor";
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived =
      includeArchivedParam === "1" || includeArchivedParam === "true";

    if (useCursor) {
      const status = searchParams.get("status");
      const search = searchParams.get("search");
      const cursor = searchParams.get("cursor");
      const limit = searchParams.get("limit");

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
            { subcontractorName: rx },
            { serviceType: rx },
          ],
        });
      }

      const filter = parts.length === 0 ? {} : { $and: parts };

      const { items, hasNext } = await findWithMongoIdCursor(
        SubContractorAudit,
        filter,
        { cursor, limit }
      );
      const enrichedItems = await withAuditorNames(items);

      return NextResponse.json({
        success: true,
        data: enrichedItems,
        hasNext,
        subContractorAudits: enrichedItems,
      });
    }

    const nonCursorQuery = includeArchived
      ? {}
      : { isArchived: { $ne: true } };
    const subContractorAudits = await SubContractorAudit.find(
      nonCursorQuery
    ).lean({
      getters: true,
      virtuals: false,
    });
    return NextResponse.json({
      subContractorAudits: await withAuditorNames(subContractorAudits),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
