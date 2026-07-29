import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";

import SubContractorAudit from "@/lib/mongodb/models/qhse-due-diligence/SubContractorAudit";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence";
import STSBaseAuditReport from "@/lib/mongodb/models/qhse-form-checklist/StsBaseAuditReport";
import STSTransferAudit from "@/lib/mongodb/models/qhse-form-checklist/StsTransferAudit";
import HSEInductionChecklist from "@/lib/mongodb/models/qhse-form-checklist/HseInductionChecklist";
import VendorApproval from "@/lib/mongodb/models/qhse-form-checklist/VendorSupplierApproval";
import STSEquipmentBaseStock from "@/lib/mongodb/models/qhse-form-checklist/StsEquipmentBaseStockLevel";
import STSTransferLocationQuest from "@/lib/mongodb/models/qhse-form-checklist/StsTransferLocationQuest";
import NewBaseSetupChecklist from "@/lib/mongodb/models/qhse-form-checklist/NewBaseSetupChecklist";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange";
import MOCRiskAssessment from "@/lib/mongodb/models/qhse-moc/mocs-riskAssessment";
import AuditInspectionPlanner from "@/lib/mongodb/models/qhse-audit-inspection/AuditInspectionPlanner";
import PoacCrossCompetency from "@/lib/mongodb/models/qhse-poac/PoacCrossCompetency";
import TargetKpi from "@/lib/mongodb/models/qhse-kpi/TargetKpi";
import KpiUpload from "@/lib/mongodb/models/qhse-kpi/KpiUpload";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";
import RiskAssessment from "@/lib/mongodb/models/qhse-risk-assessment/RiskAssessment";
import TrainingPlan from "@/lib/mongodb/models/qhse-training/TrainingPlan";
import TrainingRecord from "@/lib/mongodb/models/qhse-training/TrainingRecord";
import DrillPlan from "@/lib/mongodb/models/qhse-drill/DrillPlan";
import DrillReport from "@/lib/mongodb/models/qhse-drill/DrillReport";
import NearMiss from "@/lib/mongodb/models/qhse-near-miss/NearMiss";
import BestPractice from "@/lib/mongodb/models/qhse-best-practices/BestPractice";

import STSChecklistOne from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-001";
import ShipStandardQuestionnaire from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-001-A";
import STSChecklist2 from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-002";
import STSChecklist3A3B from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-003";
import STSChecklist4AF from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-004";
import STSChecklist5 from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005";
import STSChecklist6AB from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005B";
import STSChecklist5C from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005C";
import STSDeclaration from "@/lib/mongodb/models/operation-sts-checklist/DeclarationOfSea";
import STSChecklistFiveF from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-005D";
import STSChecklist8 from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-028";
import MooringMastersJobReport from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-009";
import STSStandingOrder from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-011";
import STSEquipmentChecklist from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-014";
import STSHourlyQuantityLog from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-015";
import STSTimesheet from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-018";
import MooringMasterExpenseSheet from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-029";
import MasterFeedbackForm from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-020";
import RecordOfWorkHours from "@/lib/mongodb/models/operation-sts-checklist/OPS-OFD-023";
import StsQuotationForm from "@/lib/mongodb/models/operations-form-checklist/StsQuotationForm";
import Manual from "@/lib/mongodb/models/operations-form-checklist/Manual";
import InspectionChecklist from "@/lib/mongodb/models/operations-form-checklist/InspectionChecklist";
import Jpo from "@/lib/mongodb/models/operations-form-checklist/Jpo";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import Compatibility from "@/lib/mongodb/models/operations/Compatibility";

import Certificate from "@/lib/mongodb/models/pms/Certificate";
import Equipment from "@/lib/mongodb/models/pms/Equipment";
import Accessories from "@/lib/mongodb/models/pms/Accessories";
import WarehouseManagement from "@/lib/mongodb/models/pms/WarehouseManagement";
import EquipmentTest from "@/lib/mongodb/models/pms/EquipmentTest";

import PoacMatrix from "@/lib/mongodb/models/hr/PoacMatrix";
import OilMajor from "@/lib/mongodb/models/hr/OilMajor";
import Cid from "@/lib/mongodb/models/hr/Cid";
import StatutoryCertificate from "@/lib/mongodb/models/hr/StatutoryCertificate";

/**
 * Each entry: formCode, title, model, href, department (QHSE | Operations | PMS | HR), optional revno.
 */
const REGISTER_ENTRIES = [
  // QHSE
  { formCode: "QAF-OFD-003", title: "STS Transfer Audit Report", model: STSTransferAudit, href: "/qhse/forms-checklist/transfer-audit/list", department: "QHSE", revno: "1.2" },
  { formCode: "QAF-OFD-004", title: "STS Base Audit Report", model: STSBaseAuditReport, href: "/qhse/forms-checklist/base-audit/list", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-006", title: "Risk Assessment", model: RiskAssessment, href: "/qhse/risk-assessment/list", department: "QHSE", revno: "1.2" },
  { formCode: "QAF-OFD-008", title: "HSE Induction Checklist", model: HSEInductionChecklist, href: "/qhse/forms-checklist/hse-induction-checklist/list", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-009", title: "POAC Cross Competency Evaluation", model: PoacCrossCompetency, href: "/qhse/poac/cross-competency/list", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-013", title: "STS Equipment Base Stock Level", model: STSEquipmentBaseStock, href: "/qhse/forms-checklist/equipment-base-stock-level/list", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-015", title: "Near Miss / Incident Reporting", model: NearMiss, href: "/qhse/near-miss", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-025", title: "Equipment Defect List", model: EquipmentDefect, href: "/qhse/defects-list/create/list", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-037", title: "Vendor / Supplier Approval Form", model: VendorApproval, href: "/qhse/forms-checklist/vendor-supply/list", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-038", title: "Training Plan", model: TrainingPlan, href: "/qhse/training/create/plan", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-039", title: "Training Record", model: TrainingRecord, href: "/qhse/training/create/plan", department: "QHSE", revno: "1.2" },
  { formCode: "QAF-OFD-040", title: "Drill Plan", model: DrillPlan, href: "/qhse/drills/create/plan", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-040", title: "Drill Report", model: DrillReport, href: "/qhse/drills/list", department: "QHSE", revno: "1.0" },
  { formCode: "QAF-OFD-043", title: "Supplier Due Diligence Questionnaire", model: SupplierDueDiligence, href: "/qhse/due-diligence-subconstructor/due-diligence-questionnaire/questionnaire-list-admin", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-048", title: "Audit & Inspection Plan", model: AuditInspectionPlanner, href: "/qhse/audit-inspection-planner/form", department: "QHSE", revno: "2.1" },
  { formCode: "QAF-OFD-049", title: "STS Transfer Location Questionnaire", model: STSTransferLocationQuest, href: "/qhse/forms-checklist/transfer-location-quest/list", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-051", title: "New Base Setup Checklist", model: NewBaseSetupChecklist, href: "/qhse/forms-checklist/new-base-setup-checklist/list", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-055", title: "Audit Form - Sub Contractor", model: SubContractorAudit, href: "/qhse/due-diligence-subconstructor/audit-sub-contractor/list-admin", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-058", title: "Management of Change Form", model: MOCManagementChange, href: "/qhse/moc/management-change/list", department: "QHSE", revno: "1.1" },
  { formCode: "QAF-OFD-058A", title: "MOC Risk Assessment", model: MOCRiskAssessment, href: "/qhse/moc/management-change/list", department: "QHSE" },
  { formCode: "HSE-001A", title: "Target KPI", model: TargetKpi, href: "/qhse/kpi/target-kpi/list", department: "QHSE" },
  { formCode: "HSE-001B", title: "KPI (HSE Objectives Upload)", model: KpiUpload, href: "/qhse/kpi/list", department: "QHSE" },
  { formCode: "—", title: "Best Practices", model: BestPractice, href: "/qhse/best-practice/list", department: "QHSE" },
  // Operations – STS Checklist & Forms
  { formCode: "OPS-OFD-001", title: "STS Checklist 1 - Pre Fixture Information", model: STSChecklistOne, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-001/list", department: "Operations" },
  { formCode: "OPS-OFD-001A", title: "Ship Standard Questionnaire", model: ShipStandardQuestionnaire, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-001a/list", department: "Operations" },
  { formCode: "OPS-OFD-002", title: "Before Run In & Mooring", model: STSChecklist2, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-002/list", department: "Operations" },
  { formCode: "OPS-OFD-003", title: "Before Cargo Transfer (3A & 3B)", model: STSChecklist3A3B, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-003/list", department: "Operations" },
  { formCode: "OPS-OFD-004", title: "Pre-Transfer Agreements (4A-4F)", model: STSChecklist4AF, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-004/list", department: "Operations" },
  { formCode: "OPS-OFD-005", title: "During Transfer (5A-5C)", model: STSChecklist5, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-005/list", department: "Operations" },
  { formCode: "OPS-OFD-005B", title: "Before Disconnection & Unmooring", model: STSChecklist6AB, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-005b/list", department: "Operations" },
  { formCode: "OPS-OFD-005C", title: "Terminal Transfer Checklist", model: STSChecklist5C, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-005c/list", department: "Operations" },
  { formCode: "OPS-OFD-005E", title: "Declaration Of STS At Sea", model: STSDeclaration, href: "/operations/sts-operations/new/form-checklist/sts-checklist/declaration-of-sea/list", department: "Operations" },
  { formCode: "OPS-OFD-005D", title: "Declaration for STS operations (At port & Terminal)", model: STSChecklistFiveF, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-005d/list", department: "Operations" },
  { formCode: "OPS-OFD-028", title: "Personnel Transfer Basket Checklist", model: STSChecklist8, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-028/list", department: "Operations" },
  { formCode: "OPS-OFD-009", title: "Mooring Master's Job Report", model: MooringMastersJobReport, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-009/list", department: "Operations" },
  { formCode: "OPS-OFD-011", title: "STS Standing Order", model: STSStandingOrder, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-011/list", department: "Operations" },
  { formCode: "OPS-OFD-014", title: "Equipment Checklist", model: STSEquipmentChecklist, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-014/list", department: "Operations" },
  { formCode: "OPS-OFD-015", title: "Hourly Quantity Log", model: STSHourlyQuantityLog, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-015/list", department: "Operations" },
  { formCode: "OPS-OFD-018", title: "STS Timesheet", model: STSTimesheet, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-018/list", department: "Operations" },
  { formCode: "OPS-OFD-029", title: "Mooring Master Expense Sheet", model: MooringMasterExpenseSheet, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-029/list", department: "Operations" },
  { formCode: "OPS-OFD-030", title: "STS Job / Advisor Quotation", model: StsQuotationForm, href: "/operations/sts-operations/new/form-checklist/quotations/list", department: "Operations" },
  { formCode: "OPS-OFD-006A", title: "Joint Plan of Operation", model: Jpo, href: "/operations/sts-operations/new/form-checklist/jpo/list", department: "Operations" },
  { formCode: "OPS-OFD-020", title: "Master's Feedback Form", model: MasterFeedbackForm, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-020/list", department: "Operations" },
  { formCode: "OPS-OFD-023", title: "Record of Work Hours", model: RecordOfWorkHours, href: "/operations/sts-operations/new/form-checklist/sts-checklist/ops-ofd-023/list", department: "Operations" },
  { formCode: "—", title: "Manuals", model: Manual, href: "/operations/sts-operations/new/form-checklist/manual/list", department: "Operations" },
  { formCode: "—", title: "Inspection Checklist", model: InspectionChecklist, href: "/operations/sts-operations/new/form-checklist/inspection-checklist/list", department: "Operations" },
  { formCode: "—", title: "STS Operations", model: StsOperation, href: "/operations/sts-operations/new/list", department: "Operations" },
  { formCode: "—", title: "Ship Compatibility Assessment", model: Compatibility, href: "/operations/sts-operations/new/compatibility/list", department: "Operations" },
  // PMS
  { formCode: "PMS-CERT", title: "Certifications", model: Certificate, href: "/pms/certifications/list", department: "PMS" },
  { formCode: "—", title: "Primary Equipment Register", model: Equipment, href: "/pms", department: "PMS" },
  { formCode: "—", title: "Accessories Register", model: Accessories, href: "/pms", department: "PMS" },
  { formCode: "—", title: "Warehouse Management", model: WarehouseManagement, href: "/pms", department: "PMS" },
  { formCode: "—", title: "Equipment Testing", model: EquipmentTest, href: "/pms/equipment-testing/form", department: "PMS" },
  // HR
  { formCode: "QAF-OFD-046", title: "POAC Certification Matrix", model: PoacMatrix, href: "/hr/poac-matrix", department: "HR" },
  { formCode: "—", title: "Oil Major Approvals", model: OilMajor, href: "/hr/oil-majors", department: "HR" },
  { formCode: "—", title: "CID Register", model: Cid, href: "/hr/cid", department: "HR" },
  { formCode: "—", title: "Statutory Certificates", model: StatutoryCertificate, href: "/hr/statutory-certificates", department: "HR" },
];

/** Template filename in public/templates/controlled-register/ for download. Omit entry if no template. */
const REGISTER_TEMPLATES = {
  "QAF-OFD-003": "QAF-OFD-003.docx",
  "QAF-OFD-004": "QAF-OFD-004.docx",
  "QAF-OFD-006": "QAF-OFD-006.xlsx",
  "QAF-OFD-008": "QAF-OFD-008.docx",
  "QAF-OFD-009": "QAF-OFD-009.docx",
  "QAF-OFD-013": "QAF-OFD-013.docx",
  "QAF-OFD-015": "QAF-OFD-015.docx",
  "QAF-OFD-025": "QAF-OFD-025.xlsx",
  "QAF-OFD-037": "QAF-OFD-037.xlsx",
  "QAF-OFD-038": "QAF-OFD-038.docx",
  "QAF-OFD-039": "QAF-OFD-039.docx",
  "QAF-OFD-040": "QAF-OFD-040.docx",
  "QAF-OFD-043": "QAF-OFD-043.docx",
  "QAF-OFD-048": "QAF-OFD-048.xlsx",
  "QAF-OFD-049": "QAF-OFD-049.docx",
  "QAF-OFD-051": "QAF-OFD-051.docx",
  "QAF-OFD-055": "QAF-OFD-055.docx",
  "QAF-OFD-058": "QAF-OFD-058.docx",
  "QAF-OFD-058A": "QAF-OFD-058A.docx",
  "HSE-001A": "HSE-001-Objectives-Targets.xlsx",
  "HSE-001B": "HSE-001-Objectives-Targets.xlsx",
  "OPS-OFD-001": "OPS-OFD-001.docx",
  "OPS-OFD-001A": "OPS-OFD-001A.docx",
  "OPS-OFD-002": "OPS-OFD-002.docx",
  "OPS-OFD-003": "OPS-OFD-003.docx",
  "OPS-OFD-004": "OPS-OFD-004.docx",
  "OPS-OFD-005": "OPS-OFD-005.docx",
  "OPS-OFD-005B": "OPS-OFD-005B.docx",
  "OPS-OFD-005C": "OPS-OFD-005C.docx",
  "OPS-OFD-005E": "OPS-OFD-005E.docx",
  "OPS-OFD-006A": "OPS-OFD-006A.docx",
  "OPS-OFD-028": "OPS-OFD-028.docx",
  "OPS-OFD-009": "OPS-OFD-009.docx",
  "OPS-OFD-011": "OPS-OFD-011.docx",
  "OPS-OFD-014": "OPS-OFD-014.docx",
  "OPS-OFD-015": "OPS-OFD-015.xlsx",
  "OPS-OFD-018": "OPS-OFD-018.docx",
  "OPS-OFD-029": "OPS-OFD-029.xlsx",
  "OPS-OFD-020": "OPS-OFD-020.docx",
  "OPS-OFD-023": "OPS-OFD-023.docx",
  "OPS-OFD-030": "OPS-OFD-030.docx",
};

/**
 * @param {object} Model - Mongoose model
 * @param {number|null} year - Optional year to filter (documents created in this year). Null = all time.
 */
async function getStats(Model, year = null) {
  try {
    const filter = year == null
      ? {}
      : { createdAt: { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) } };
    const count = await Model.countDocuments(filter);
    if (count === 0) return { count: 0, latestDate: null, issueDate: null };
    const [latest, earliest] = await Promise.all([
      Model.findOne(filter).sort({ updatedAt: -1 }).select("updatedAt").lean(),
      Model.findOne(filter).sort({ createdAt: 1 }).select("createdAt").lean(),
    ]);
    return {
      count,
      latestDate: latest?.updatedAt || null,
      issueDate: earliest?.createdAt || null,
    };
  } catch {
    return { count: 0, latestDate: null, issueDate: null };
  }
}

export async function GET(request) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const filterYear = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;

  try {
    const results = await Promise.all(
      REGISTER_ENTRIES.map(async (entry) => {
        const stats = await getStats(entry.model, filterYear);
        const templateFile = REGISTER_TEMPLATES[entry.formCode];
        return {
          formCode: entry.formCode,
          title: entry.title,
          href: entry.href,
          documents: stats.count,
          issueDate: stats.issueDate,
          revisionDate: stats.latestDate,
          revno: entry.revno ?? "—",
          department: entry.department,
          templatePath: templateFile ? `/templates/controlled-register/${templateFile}` : null,
        };
      })
    );

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Dynamic controlled document register error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
