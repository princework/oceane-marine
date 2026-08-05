import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MooringMaster from "@/lib/mongodb/models/MooringMaster";
import { getMooringMasterComplianceMap } from "@/lib/hr/poacCompliance";

export async function GET() {
  await connectDB();
  try {
    const mooringMastersDocs = await MooringMaster.find().lean();
    const complianceMap = await getMooringMasterComplianceMap(
      mooringMastersDocs.map((m) => m._id)
    );

    /* POAC (the OCIMF regulatory name) and Mooring Master (the operational name) are
       the same person — surface their document status here so callers (the Operations
       assignment picker in particular) can warn before a non-compliant person gets
       assigned, without every consumer having to know about the HR module at all. */
    const mooringMasters = mooringMastersDocs.map((m) => {
      const compliance = complianceMap.get(String(m._id)) || {
        compliant: false,
        issues: ["No POAC Certification Matrix record on file"],
      };
      return { ...m, poacCompliant: compliance.compliant, poacIssues: compliance.issues };
    });

    return NextResponse.json({ mooringMasters });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
