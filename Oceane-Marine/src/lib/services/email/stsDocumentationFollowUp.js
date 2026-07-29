import { connectDB } from "../../config/connection.js";
import StsOperation from "../../mongodb/models/sts-documentation/StsOperation.js";
import { diffUtcCalendarDays, startOfUtcDay } from "../../utils/utcDate.js";
import { sendResendEmail } from "./sendResendEmail.js";
import {
  buildStsCompletedMissingDocumentsEmail,
  buildStsInProgressDocumentationEmail,
} from "./templates/operations/stsDocumentationFollowUp.js";

import STSChecklistOne from "../../mongodb/models/operation-sts-checklist/OPS-OFD-001.js";
import STSChecklistTwo from "../../mongodb/models/operation-sts-checklist/OPS-OFD-002.js";
import STSChecklist3A3B from "../../mongodb/models/operation-sts-checklist/OPS-OFD-003.js";
import STSChecklist4AF from "../../mongodb/models/operation-sts-checklist/OPS-OFD-004.js";
import STSChecklist5 from "../../mongodb/models/operation-sts-checklist/OPS-OFD-005.js";
import STSChecklist6AB from "../../mongodb/models/operation-sts-checklist/OPS-OFD-005B.js";
import STSChecklist5C from "../../mongodb/models/operation-sts-checklist/OPS-OFD-005C.js";
import STSDeclaration from "../../mongodb/models/operation-sts-checklist/DeclarationOfSea.js";
import STSChecklistFiveF from "../../mongodb/models/operation-sts-checklist/OPS-OFD-005D.js";
import STSChecklist8 from "../../mongodb/models/operation-sts-checklist/OPS-OFD-028.js";
import STSEquipmentChecklist from "../../mongodb/models/operation-sts-checklist/OPS-OFD-014.js";
import STSStandingOrder from "../../mongodb/models/operation-sts-checklist/OPS-OFD-011.js";
import STSHourlyQuantityLog from "../../mongodb/models/operation-sts-checklist/OPS-OFD-015.js";
import STSTimesheet from "../../mongodb/models/operation-sts-checklist/OPS-OFD-018.js";
import MasterFeedbackForm from "../../mongodb/models/operation-sts-checklist/OPS-OFD-020.js";
import RecordOfWorkHours from "../../mongodb/models/operation-sts-checklist/OPS-OFD-023.js";
import ShipStandardQuestionnaire from "../../mongodb/models/operation-sts-checklist/OPS-OFD-001-A.js";
import MooringMastersJobReport from "../../mongodb/models/operation-sts-checklist/OPS-OFD-009.js";
import MooringMasterExpenseSheet from "../../mongodb/models/operation-sts-checklist/OPS-OFD-029.js";

/**
 * Vessel files (CHS + MS): SSQ, Q88, GA Plan, MSDS — Mooring Arrangement excluded per business rules.
 */
const VESSEL_DOC_CHECKS = [
  { key: "chsSSQ", label: "CHS — SSQ (Ship Standard Questionnaire)" },
  { key: "msSSQ", label: "MS — SSQ (Ship Standard Questionnaire)" },
  { key: "chsQ88", label: "CHS — Q88 Vessel Data" },
  { key: "msQ88", label: "MS — Q88 Vessel Data" },
  { key: "chsGAPlan", label: "CHS — GA Plan (General Arrangement)" },
  { key: "msGAPlan", label: "MS — GA Plan (General Arrangement)" },
  { key: "chsMSDS", label: "CHS — MSDS (Material Safety Data Sheet)" },
  { key: "msMSDS", label: "MS — MSDS (Material Safety Data Sheet)" },
];

const PRE_STS_CHECKS = [
  { key: "jpo", label: "Joint Plan Operation" },
  { key: "riskAssessment", label: "Risk Assessment" },
  { key: "mooringPlan", label: "Mooring Plan" },
];

/**
 * Linked OPS-OFD forms required when Completed — same coverage as `/api/operations/sts/linked-forms`
 * (standard rows only; OPS-OFD-020 is handled separately with CHS/MS vessel matching).
 */
const REQUIRED_LINKED_FORMS = [
  { formCode: "OPS-OFD-001", label: "Checklist 1", model: STSChecklistOne },
  { formCode: "OPS-OFD-001-A", label: "Ship Standard Questionnaire", model: ShipStandardQuestionnaire },
  { formCode: "OPS-OFD-002", label: "Checklist 2", model: STSChecklistTwo },
  { formCode: "OPS-OFD-003", label: "Checklist 3A & B", model: STSChecklist3A3B },
  { formCode: "OPS-OFD-004", label: "Checklist 4A-F", model: STSChecklist4AF },
  { formCode: "OPS-OFD-005", label: "Checklist 5A-C", model: STSChecklist5 },
  { formCode: "OPS-OFD-005B", label: "Checklist 6A & B", model: STSChecklist6AB },
  { formCode: "OPS-OFD-005C", label: "Checklist 7", model: STSChecklist5C },
  { formCode: "OPS-OFD-005E", label: "Declaration at Sea", model: STSDeclaration },
  {
    formCode: "OPS-OFD-005D",
    label: "Declaration for STS operations (At port & Terminal)",
    model: STSChecklistFiveF,
  },
  { formCode: "OPS-OFD-028", label: "Personnel Transfer Basket Checklist", model: STSChecklist8 },
  {
    formCode: "OPS-OFD-014-B",
    label: "Equip Checklist (Before Operation)",
    model: STSEquipmentChecklist,
    extraFilter: { "jobInfo.operationPhase": "BEFORE_OPERATION" },
  },
  {
    formCode: "OPS-OFD-014-A",
    label: "Equip Checklist (After Operation)",
    model: STSEquipmentChecklist,
    extraFilter: { "jobInfo.operationPhase": "AFTER_OPERATION" },
  },
  { formCode: "OPS-OFD-009", label: "Mooring Master Job Report", model: MooringMastersJobReport },
  { formCode: "OPS-OFD-011", label: "Standing Order", model: STSStandingOrder },
  { formCode: "OPS-OFD-015", label: "Hourly Checks", model: STSHourlyQuantityLog },
  { formCode: "OPS-OFD-018", label: "STS Timesheet", model: STSTimesheet },
  { formCode: "OPS-OFD-023", label: "Rest Hours CKL", model: RecordOfWorkHours },
  { formCode: "OPS-OFD-029", label: "Mooring Master Expense Sheet", model: MooringMasterExpenseSheet },
];

function normVessel(str) {
  return (str || "").trim().toLowerCase();
}

/** Matches stored `operationRef` on checklist collections (trim, optional trailing comma). */
function operationRefQueryVariants(operationRef) {
  const t = (operationRef || "").trim();
  if (!t) return [];
  const withoutComma = t.replace(/,\s*$/, "").trim();
  const set = new Set([t, withoutComma].filter(Boolean));
  return [...set];
}

/**
 * Master's Feedback (020): same rules as linked-forms API — CHS/MS rows by vessel name on the operation.
 */
async function collectMasterFeedback020Missing(op, refVariants) {
  const missing = [];
  const chsName = (op.chs || "").trim();
  const msName = (op.ms || "").trim();

  const allDocs = await MasterFeedbackForm.find({ operationRef: { $in: refVariants } })
    .select("jobDetails.vesselName")
    .lean();

  const nc = normVessel(chsName);
  const nm = normVessel(msName);

  const chsFilled = nc && allDocs.some((d) => normVessel(d.jobDetails?.vesselName) === nc);
  const msFilled = nm && allDocs.some((d) => normVessel(d.jobDetails?.vesselName) === nm);

  if (chsName && !chsFilled) {
    const suffix = chsName ? ` – ${chsName}` : "";
    missing.push(`OPS-OFD-020-CHS — Master's Feedback (CHS${suffix})`);
  }
  if (msName && !msFilled) {
    const suffix = msName ? ` – ${msName}` : "";
    missing.push(`OPS-OFD-020-MS — Master's Feedback (MS${suffix})`);
  }
  if (!chsName && !msName && allDocs.length === 0) {
    missing.push("OPS-OFD-020 — Master's Feedback (add CHS/MS vessel names on the operation, then submit feedback)");
  }
  return missing;
}

function parseRecipientList() {
  const raw = process.env.OPERATIONS_STS_DOCUMENTATION_FOLLOW_UP_TO_EMAIL || "";
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasStoredFile(value) {
  if (value == null) return false;
  if (typeof value !== "string") return false;
  return value.trim().length > 0;
}

function formatOperationDate(d) {
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "—";
  }
}

/** @returns {Promise<string[]>} */
async function collectMissingRequiredDocuments(op) {
  const missing = [];
  const ref = op.Operation_Ref_No?.trim();
  if (!ref) return missing;

  const refVariants = operationRefQueryVariants(ref);

  for (const { key, label } of VESSEL_DOC_CHECKS) {
    if (!hasStoredFile(op[key])) missing.push(label);
  }
  for (const { key, label } of PRE_STS_CHECKS) {
    if (!hasStoredFile(op[key])) missing.push(label);
  }

  for (const def of REQUIRED_LINKED_FORMS) {
    try {
      const query = { operationRef: { $in: refVariants } };
      if (def.extraFilter) Object.assign(query, def.extraFilter);
      const count = await def.model.countDocuments(query);
      if (count === 0) {
        missing.push(`${def.formCode} — ${def.label}`);
      }
    } catch {
      missing.push(`${def.formCode} — ${def.label} (check failed)`);
    }
  }

  try {
    const fbMissing = await collectMasterFeedback020Missing(op, refVariants);
    missing.push(...fbMissing);
  } catch {
    missing.push("OPS-OFD-020 — Master's Feedback (check failed)");
  }

  return missing;
}

async function sendInProgressEmail(op, recipients, dateFormatted, daysInProgress) {
  const ref = op.Operation_Ref_No?.trim();
  if (!ref) return;
  const built = buildStsInProgressDocumentationEmail({
    operationRef: ref,
    operationDateFormatted: dateFormatted,
    daysInProgress,
  });
  await sendResendEmail({
    to: recipients,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });
}

async function handleInProgressMilestones(op, now, recipients, result, dateFormatted, daysInProgress) {
  if (daysInProgress >= 30) {
    result.inProgress30d.candidates += 1;
    if (op.stsDocFollowUpInProgress30dSentAt) {
      result.inProgress30d.skipped += 1;
      return;
    }
    await sendInProgressEmail(op, recipients, dateFormatted, daysInProgress);
    const set30 = { stsDocFollowUpInProgress30dSentAt: now };
    if (!op.stsDocFollowUpInProgress7dSentAt) {
      set30.stsDocFollowUpInProgress7dSentAt = now;
    }
    await StsOperation.updateOne({ _id: op._id }, { $set: set30 });
    result.inProgress30d.sent += 1;
    return;
  }

  if (daysInProgress >= 7) {
    result.inProgress7d.candidates += 1;
    if (op.stsDocFollowUpInProgress7dSentAt) {
      result.inProgress7d.skipped += 1;
      return;
    }
    await sendInProgressEmail(op, recipients, dateFormatted, daysInProgress);
    await StsOperation.updateOne(
      { _id: op._id },
      { $set: { stsDocFollowUpInProgress7dSentAt: now } }
    );
    result.inProgress7d.sent += 1;
  }
}

async function processInProgressReminders(now, recipients, result) {
  const inProgressOps = await StsOperation.find({
    isLatest: true,
    operationStatus: "INPROGRESS",
  }).lean();

  for (const op of inProgressOps) {
    const start = op.operationStartTime;
    if (!start) continue;

    const daysInProgress = diffUtcCalendarDays(startOfUtcDay(start), startOfUtcDay(now));
    if (daysInProgress < 7) continue;

    const ref = op.Operation_Ref_No?.trim();
    if (!ref) continue;

    const dateFormatted = formatOperationDate(start);

    try {
      await handleInProgressMilestones(op, now, recipients, result, dateFormatted, daysInProgress);
    } catch (e) {
      result.errors.push(`INPROGRESS ${ref}: ${e.message || e}`);
    }
  }
}

async function processCompletedMissingReminders(now, recipients, result) {
  const completedOps = await StsOperation.find({
    isLatest: true,
    operationStatus: "COMPLETED",
  }).lean();

  for (const op of completedOps) {
    const completedAt = op.operationEndTime || op.updatedAt;
    if (!completedAt) continue;

    const daysSinceCompleted = diffUtcCalendarDays(startOfUtcDay(completedAt), startOfUtcDay(now));
    if (daysSinceCompleted < 7) continue;

    const ref = op.Operation_Ref_No?.trim();
    if (!ref) continue;

    if (op.stsDocFollowUpCompletedMissingSentAt) {
      result.completedMissing.skipped += 1;
      continue;
    }

    try {
      const missing = await collectMissingRequiredDocuments(op);
      result.completedMissing.candidates += 1;

      if (missing.length === 0) {
        result.completedMissing.skipped += 1;
        continue;
      }

      const displayDate = formatOperationDate(op.operationEndTime || op.operationStartTime || completedAt);

      const built = buildStsCompletedMissingDocumentsEmail({
        operationRef: ref,
        operationDateFormatted: displayDate,
        missingLabels: missing,
      });

      await sendResendEmail({
        to: recipients,
        subject: built.subject,
        html: built.html,
        text: built.text,
      });

      await StsOperation.updateOne(
        { _id: op._id },
        { $set: { stsDocFollowUpCompletedMissingSentAt: now } }
      );
      result.completedMissing.sent += 1;
    } catch (e) {
      result.errors.push(`COMPLETED ${ref}: ${e.message || e}`);
    }
  }
}

/**
 * Daily job: INPROGRESS follow-ups (7d / 30d UTC calendar-day thresholds) and Completed + missing docs (≥7d after completion).
 */
export async function runStsDocumentationFollowUpJob() {
  await connectDB();

  const recipients = parseRecipientList();
  const result = {
    inProgress7d: { candidates: 0, sent: 0, skipped: 0 },
    inProgress30d: { candidates: 0, sent: 0, skipped: 0 },
    completedMissing: { candidates: 0, sent: 0, skipped: 0 },
    errors: [],
  };

  if (recipients.length === 0) {
    result.errors.push(
      "No recipients: set OPERATIONS_STS_DOCUMENTATION_FOLLOW_UP_TO_EMAIL (comma-separated)"
    );
    return result;
  }

  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
    result.errors.push("Resend not configured: RESEND_API_KEY and RESEND_FROM_EMAIL required");
    return result;
  }

  const now = new Date();
  await processInProgressReminders(now, recipients, result);
  await processCompletedMissingReminders(now, recipients, result);
  return result;
}
