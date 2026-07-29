import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import ControlledDocumentRegister from "@/lib/mongodb/models/qhse-controlled-document/ControlledDocumentRegister";

const SEED_ROWS = [
  { formCode: "QAF-OFD-001", title: "HSE Objectives & Targets", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "Digital" },
  { formCode: "QAF-OFD-002", title: "QAHSE Plan", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "Manual" },
  { formCode: "QAF-OFD-003", title: "STS Transfer Audit Report", version: "1.2", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "Removed" },
  { formCode: "QAF-OFD-004", title: "STS Base Audit Report", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-005", title: "Standards of Cares - STS Supdt", version: "1.2", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-006", title: "Risk Assessment", version: "1.2", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-007", title: "Environmental Aspect Impact Register", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "", format: "" },
  { formCode: "QAF-OFD-008", title: "HSE Induction Checklist", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-009", title: "POAC cross competency evaluvation", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-010", title: "Indemnity Hire and Terms Condition", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-011", title: "Legal Register", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-012", title: "Emergency Action", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-013", title: "STS Equipment base stock level", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-014", title: "Trainee Evaluation Form", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-015", title: "Accident - Incident Reporting Form", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-016", title: "First Aid Checklist", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-017", title: "Mock Drill", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-018", title: "Safety Broadcast", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-019", title: "Emergency Point of Contact", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-020", title: "Equipment List & test status", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-021", title: "Controlled Document List", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-022", title: "Customer Complaint Register", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-023", title: "Incident Accident Reporting Log", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-024", title: "Smoking Restriction", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-025", title: "Equipment Defect list", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-026", title: "Job Description", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-027", title: "STS Support Craft Inspection Questionnaire", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-028", title: "Management Visit Report", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-029", title: "Non Disclosure Agreement", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-030", title: "NCR - Observation Report", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-031", title: "Blank Form", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-032", title: "Internal Audit Report", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-033", title: "Document Change Request", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-034", title: "External Document Origin List", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-035", title: "Dealer Evaluation - Performance Record", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-036", title: "Service Non Conformance Report", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-037", title: "Vendor OR Supplier Approval Form", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-038", title: "Training Plan", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-039", title: "Training Record", version: "1.2", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-040", title: "Drill Plan", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-041", title: "Quarterly Management Meeting", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-042", title: "Purchasing Terms and Condition", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-043", title: "Supplier Due Diligence Questionnaire", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-044", title: "POAC Information", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-045", title: "Management Review", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-046", title: "POAC Certification Matrix", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-047", title: "Health Bulletin", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-048", title: "Audit & Inspection Plan", version: "2.1", effectiveDate: "29-Feb-24", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-049", title: "STS Transfer Location Questionnaire", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-050", title: "5 Yearly Environmental Objectives and Plans", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-051", title: "New Base Setup Checklist", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-052", title: "Drug & Alcohol Test Record", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-053", title: "Approved Vender List", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-054", title: "Confidentiality Agreement -Individual", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-055", title: "Audit Form - Sub Contractor", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-056", title: "Minimum Stock Level", version: "1.1", effectiveDate: "01-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-057", title: "Confidentiality Agreement -Company", version: "1.1", effectiveDate: "02-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
  { formCode: "QAF-OFD-058", title: "Management of Change Form", version: "1.1", effectiveDate: "03-Mar-23", lastRevisedDate: "16-Jul-25", author: "JS", department: "QHSE", revisionNumber: "2", format: "" },
];

export async function POST(req) {
  await connectDB();

  try {
    const body = await req.json().catch(() => ({}));
    const year = body.year != null ? Number(body.year) : new Date().getFullYear();

    const existing = await ControlledDocumentRegister.countDocuments({ year });
    if (existing > 0) {
      return NextResponse.json(
        { success: false, error: `Register for year ${year} already has ${existing} documents. Delete existing first to re-seed.` },
        { status: 400 }
      );
    }

    const docs = SEED_ROWS.map((row, index) => ({
      year,
      rowOrder: index + 1,
      ...row,
    }));
    await ControlledDocumentRegister.insertMany(docs);

    return NextResponse.json({
      success: true,
      message: `Seeded ${docs.length} documents for year ${year}`,
      count: docs.length,
    });
  } catch (error) {
    console.error("Controlled document register seed error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
