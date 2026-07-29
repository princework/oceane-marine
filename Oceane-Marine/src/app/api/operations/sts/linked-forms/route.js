import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";

// Import all OPS-OFD models
import STSChecklistOne from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-001";
import STSChecklistTwo from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-002";
import STSChecklist3A3B from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-003";
import STSChecklist4AF from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-004";
import STSChecklist5 from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005";
import STSChecklist6AB from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005B";
import STSChecklist5C from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005C";
import STSDeclaration from "@/lib/mongodb/models/operation-sts-checklist/DeclarationOfSea";
import STSStandingOrder from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-011";
import STSEquipmentChecklist from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-014";
import STSHourlyQuantityLog from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-015";
import STSTimesheet from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-018";
import MasterFeedbackForm from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-020";
import RecordOfWorkHours from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-023";
import ShipStandardQuestionnaire from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-001-A";
import STSChecklistFiveF from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005D";
import STSChecklist8 from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-028";
import MooringMastersJobReport from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-009";
import MooringMasterExpenseSheet from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-029";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";

/**
 * Each linked form definition:
 *  formCode     – official form number
 *  label        – display name shown in UI
 *  model        – Mongoose model
 *  category     – grouping (checklist | equipment | feedback | other)
 *  extraFilter  – optional extra MongoDB filter (e.g. operationPhase)
 */
const LINKED_FORMS = [
  // ── Checklists ──
  { formCode: "OPS-OFD-001",  label: "Checklist 1",            model: STSChecklistOne,      category: "checklist" },
  { formCode: "OPS-OFD-001-A",label: "Ship Standard Questionnaire", model: ShipStandardQuestionnaire, category: "checklist" },
  { formCode: "OPS-OFD-002",  label: "Checklist 2",            model: STSChecklistTwo,      category: "checklist" },
  { formCode: "OPS-OFD-003",  label: "Checklist 3A & B",       model: STSChecklist3A3B,     category: "checklist" },
  { formCode: "OPS-OFD-004",  label: "Checklist 4A-F",         model: STSChecklist4AF,      category: "checklist" },
  { formCode: "OPS-OFD-005",  label: "Checklist 5A-C",         model: STSChecklist5,        category: "checklist" },
  { formCode: "OPS-OFD-005B", label: "Checklist 6A & B",       model: STSChecklist6AB,      category: "checklist" },
  { formCode: "OPS-OFD-005C", label: "Checklist 7",            model: STSChecklist5C,       category: "checklist" },
  { formCode: "OPS-OFD-005E", label: "Declaration at Sea",     model: STSDeclaration,       category: "checklist" },
  { formCode: "OPS-OFD-005D", label: "Declaration for STS operations (At port & Terminal)", model: STSChecklistFiveF, category: "checklist" },
  { formCode: "OPS-OFD-028",  label: "Personnel Transfer Basket Checklist", model: STSChecklist8, category: "checklist" },

  // ── Equipment (split into Before / After Operation) ──
  {
    formCode: "OPS-OFD-014-B",
    label: "Equip Checklist (Before Operation)",
    model: STSEquipmentChecklist,
    category: "equipment",
    extraFilter: { "jobInfo.operationPhase": "BEFORE_OPERATION" },
  },
  {
    formCode: "OPS-OFD-014-A",
    label: "Equip Checklist (After Operation)",
    model: STSEquipmentChecklist,
    category: "equipment",
    extraFilter: { "jobInfo.operationPhase": "AFTER_OPERATION" },
  },

  // ── Feedback & Logs ──
  // NOTE: OPS-OFD-020 is handled separately below (split into CHS / MS by vessel name matching)
  { formCode: "OPS-OFD-009",  label: "Mooring Master Job Report",model: MooringMastersJobReport, category: "feedback" },
  { formCode: "OPS-OFD-011",  label: "Standing Order",         model: STSStandingOrder,     category: "feedback" },
  { formCode: "OPS-OFD-015",  label: "Hourly Checks",          model: STSHourlyQuantityLog, category: "feedback" },
  { formCode: "OPS-OFD-018",  label: "STS Timesheet",          model: STSTimesheet,         category: "feedback" },
  { formCode: "OPS-OFD-023",  label: "Rest Hours CKL",         model: RecordOfWorkHours,    category: "feedback" },
  { formCode: "OPS-OFD-029",  label: "Mooring Master Expense Sheet", model: MooringMasterExpenseSheet, category: "feedback" },
];

/**
 * Helper: normalise a vessel name for case-insensitive comparison
 */
function normalise(str) {
  return (str || "").trim().toLowerCase();
}

/**
 * Build OPS-OFD-020 (Master's Feedback) entries split into CHS and MS.
 *
 * The form's `jobDetails.vesselName` is compared against the operation's
 * `chs` and `ms` vessel names.  Each feedback doc is assigned to the
 * matching vessel side; unmatched docs go into a generic bucket.
 */
async function buildFeedbackEntries(operationRef, chsName, msName) {
  try {
    const allDocs = await MasterFeedbackForm
      .find({ operationRef })
      .select("_id sequenceNumber status createdAt jobDetails.vesselName")
      .sort({ createdAt: -1 })
      .lean();

    const normChs = normalise(chsName);
    const normMs  = normalise(msName);

    const chsDocs = [];
    const msDocs  = [];

    for (const doc of allDocs) {
      const vesselName = normalise(doc.jobDetails?.vesselName);
      if (normChs && vesselName === normChs) {
        chsDocs.push(doc);
      } else if (normMs && vesselName === normMs) {
        msDocs.push(doc);
      }
      // If it doesn't match either, skip (won't appear in either bucket)
    }

    const mapDoc = (d) => ({
      _id: d._id,
      sequenceNumber: d.sequenceNumber || "",
      status: d.status || "DRAFT",
      createdAt: d.createdAt,
    });

    return [
      {
        formCode: "OPS-OFD-020-CHS",
        label: `Master's Feedback (CHS${chsName ? ` – ${chsName}` : ""})`,
        category: "feedback",
        filled: chsDocs.length > 0,
        count: chsDocs.length,
        docs: chsDocs.map(mapDoc),
      },
      {
        formCode: "OPS-OFD-020-MS",
        label: `Master's Feedback (MS${msName ? ` – ${msName}` : ""})`,
        category: "feedback",
        filled: msDocs.length > 0,
        count: msDocs.length,
        docs: msDocs.map(mapDoc),
      },
    ];
  } catch (err) {
    console.error("Error building OPS-OFD-020 feedback entries:", err);
    return [
      { formCode: "OPS-OFD-020-CHS", label: "Master's Feedback (CHS)", category: "feedback", filled: false, count: 0, docs: [] },
      { formCode: "OPS-OFD-020-MS",  label: "Master's Feedback (MS)",  category: "feedback", filled: false, count: 0, docs: [] },
    ];
  }
}

/**
 * GET /api/operations/sts/linked-forms?operationRef=xxx
 *
 * Returns the fill-status of every OPS-OFD form linked to a given
 * operation reference number. For each form it returns:
 *   formCode, label, category, filled (boolean), count, docs (array of { _id, sequenceNumber, status, createdAt })
 *
 * Also returns `documents`: STS operation.documents (for linked-form download links on create/edit).
 */
export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { success: false, error: "operationRef is required" },
        { status: 400 }
      );
    }

    // Fetch the STS Operation to get CHS / MS vessel names for OPS-OFD-020 matching
    const operation = await StsOperation
      .findOne({ Operation_Ref_No: operationRef, isLatest: true })
      .select("chs ms documents")
      .lean();

    const chsName = operation?.chs || "";
    const msName  = operation?.ms  || "";
    const operationDocuments = Array.isArray(operation?.documents) ? operation.documents : [];

    // Run all standard queries + OPS-OFD-020 split query in parallel
    const [standardResults, feedbackEntries] = await Promise.all([
      // ── Standard forms ──
      Promise.all(
        LINKED_FORMS.map(async ({ formCode, label, model, category, extraFilter }) => {
          try {
            const query = { operationRef, ...(extraFilter || {}) };
            const docs = await model
              .find(query)
              .select("_id sequenceNumber status createdAt")
              .sort({ createdAt: -1 })
              .lean();

            return {
              formCode,
              label,
              category,
              filled: docs.length > 0,
              count: docs.length,
              docs: docs.map((d) => ({
                _id: d._id,
                sequenceNumber: d.sequenceNumber || "",
                status: d.status || "DRAFT",
                createdAt: d.createdAt,
              })),
            };
          } catch {
            return { formCode, label, category, filled: false, count: 0, docs: [] };
          }
        })
      ),
      // ── OPS-OFD-020 split by CHS / MS vessel name ──
      buildFeedbackEntries(operationRef, chsName, msName),
    ]);

    // Merge: insert OPS-OFD-020 entries into the results
    const results = [...standardResults, ...feedbackEntries];

    return NextResponse.json({
      success: true,
      data: results,
      documents: operationDocuments,
    });
  } catch (error) {
    console.error("Linked forms fetch error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
