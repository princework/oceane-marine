/**
 * Central registry mapping module keys (used by archive / generic APIs)
 * to their Mongoose model imports. Each module key is a stable string
 * that the client passes to the generic archive-record / unarchive-record
 * endpoints.
 *
 * Training, drill, archive catalog and controlled-document register are
 * intentionally excluded from the archive flow by product decision, but
 * they can still be listed here if future endpoints need them.
 */

import VendorApproval from "@/lib/mongodb/models/qhse-form-checklist/VendorSupplierApproval.js";
import HseInductionChecklist from "@/lib/mongodb/models/qhse-form-checklist/HseInductionChecklist.js";
import StsBaseAuditReport from "@/lib/mongodb/models/qhse-form-checklist/StsBaseAuditReport.js";
import StsEquipmentBaseStockLevel from "@/lib/mongodb/models/qhse-form-checklist/StsEquipmentBaseStockLevel.js";
import StsTransferAudit from "@/lib/mongodb/models/qhse-form-checklist/StsTransferAudit.js";
import StsTransferLocationQuest from "@/lib/mongodb/models/qhse-form-checklist/StsTransferLocationQuest.js";
import NewBaseSetupChecklist from "@/lib/mongodb/models/qhse-form-checklist/NewBaseSetupChecklist.js";
import NearMiss from "@/lib/mongodb/models/qhse-near-miss/NearMiss.js";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect.js";
import BestPractice from "@/lib/mongodb/models/qhse-best-practices/BestPractice.js";
import RiskAssessment from "@/lib/mongodb/models/qhse-risk-assessment/RiskAssessment.js";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange.js";
import MOCRiskAssessment from "@/lib/mongodb/models/qhse-moc/mocs-riskAssessment.js";
import PoacCrossCompetency from "@/lib/mongodb/models/qhse-poac/PoacCrossCompetency.js";
import SupplierDueDiligence from "@/lib/mongodb/models/qhse-due-diligence/SupplierDueDiligence.js";
import SubContractorAudit from "@/lib/mongodb/models/qhse-due-diligence/SubContractorAudit.js";
import AuditInspectionPlanner from "@/lib/mongodb/models/qhse-audit-inspection/AuditInspectionPlanner.js";

export const QHSE_MODULE_REGISTRY = {
  "vendor-supply": { model: VendorApproval, label: "Vendor Supply" },
  "hse-induction-checklist": {
    model: HseInductionChecklist,
    label: "HSE Induction Checklist",
  },
  "base-audit": { model: StsBaseAuditReport, label: "Base Audit" },
  "equipment-base-stock": {
    model: StsEquipmentBaseStockLevel,
    label: "Equipment Base Stock Level",
  },
  "transfer-audit": { model: StsTransferAudit, label: "Transfer Audit" },
  "transfer-location-quest": {
    model: StsTransferLocationQuest,
    label: "Transfer Location Questionnaire",
  },
  "new-base-setup": {
    model: NewBaseSetupChecklist,
    label: "New Base Setup Checklist",
  },
  "near-miss": { model: NearMiss, label: "Near Miss" },
  "equipment-defect": { model: EquipmentDefect, label: "Equipment Defect" },
  "best-practice": { model: BestPractice, label: "Best Practice" },
  "risk-assessment": { model: RiskAssessment, label: "Risk Assessment" },
  "moc-management-change": {
    model: MOCManagementChange,
    label: "MOC Management Change",
  },
  "moc-risk-assessment": {
    model: MOCRiskAssessment,
    label: "MOC Risk Assessment",
  },
  "poac-cross-competency": {
    model: PoacCrossCompetency,
    label: "POAC Cross Competency",
  },
  "due-diligence-questionnaire": {
    model: SupplierDueDiligence,
    label: "Due Diligence Questionnaire",
  },
  "audit-sub-contractor": {
    model: SubContractorAudit,
    label: "Audit Sub Contractor",
  },
  "audit-inspection-planner": {
    model: AuditInspectionPlanner,
    label: "Audit & Inspection Planner",
  },
};

export function getQhseModule(key) {
  return QHSE_MODULE_REGISTRY[String(key || "").trim()] || null;
}
