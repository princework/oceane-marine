import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterVendor from "@/lib/mongodb/models/MasterVendor";
import MasterAuditor from "@/lib/mongodb/models/MasterAuditor";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence";
import SubContractorAudit from "@/lib/mongodb/models/qhse-due-diligence/SubContractorAudit";
import VendorSupplierApproval from "@/lib/mongodb/models/qhse-form-checklist/VendorSupplierApproval";
import { requireQhseSession } from "@/lib/auth/qhseGuard";

/**
 * Single source of truth for the vendor onboarding pipeline: for every
 * vendor, the latest record (if any) in each of the three stages. Powers
 * both the Vendor Onboarding dashboard and the "eligible vendor" pickers
 * used when sending Stage 1/2 links and creating a Stage 3 rating.
 */
export async function GET() {
  const session = await requireQhseSession();
  if (!session.ok) return session.response;

  await connectDB();

  try {
    const [vendors, stage1Records, stage2Records, stage3Records] = await Promise.all([
      MasterVendor.find().sort({ name: 1 }).lean(),
      SupplierDueDiligence.find({ vendorId: { $ne: null } })
        .select("vendorId status rejectionReason")
        .sort({ createdAt: -1 })
        .lean(),
      SubContractorAudit.find({ vendorId: { $ne: null } })
        .select("vendorId status rejectionReason")
        .sort({ createdAt: -1 })
        .lean(),
      VendorSupplierApproval.find({ vendorId: { $ne: null } })
        .select("vendorId status rejectionReason overallPercentageScore approvedVendorEligible")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // Latest record per vendor (arrays are already sorted newest-first).
    const latestByVendor = (records) => {
      const map = new Map();
      for (const r of records) {
        const key = String(r.vendorId);
        if (!map.has(key)) map.set(key, r);
      }
      return map;
    };

    const stage1Map = latestByVendor(stage1Records);
    const stage2Map = latestByVendor(stage2Records);
    const stage3Map = latestByVendor(stage3Records);

    const auditorIds = [
      ...new Set(vendors.map((v) => v.auditSentAuditorId).filter(Boolean).map(String)),
    ];
    const auditors = auditorIds.length
      ? await MasterAuditor.find({ _id: { $in: auditorIds } }).select("name").lean()
      : [];
    const auditorNameById = new Map(auditors.map((a) => [String(a._id), a.name]));

    const data = vendors.map((vendor) => {
      const key = String(vendor._id);
      const stage1 = stage1Map.get(key) || null;
      const stage2 = stage2Map.get(key) || null;
      const stage3 = stage3Map.get(key) || null;
      return {
        vendorId: key,
        name: vendor.name,
        email: vendor.email,
        auditSentAt: vendor.auditSentAt || null,
        auditSentTo: vendor.auditSentTo || null,
        auditSentAuditorName: vendor.auditSentAuditorId
          ? auditorNameById.get(String(vendor.auditSentAuditorId)) || null
          : null,
        stage1: stage1 && {
          recordId: String(stage1._id),
          status: stage1.status,
          rejectionReason: stage1.rejectionReason || "",
        },
        stage2: stage2 && {
          recordId: String(stage2._id),
          status: stage2.status,
          rejectionReason: stage2.rejectionReason || "",
        },
        stage3: stage3 && {
          recordId: String(stage3._id),
          status: stage3.status,
          rejectionReason: stage3.rejectionReason || "",
          overallPercentageScore: stage3.overallPercentageScore,
          approvedVendorEligible: stage3.approvedVendorEligible,
        },
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Vendor pipeline status error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
