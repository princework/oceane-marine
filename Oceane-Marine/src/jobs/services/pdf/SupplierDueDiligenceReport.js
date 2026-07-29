import fs from "fs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import { buildQhseDocxHeaderTable, buildDocxMeta } from "./shared/qhseDocxHeader.js";

const FORM_TITLE = "SUPPLIER DUE DILIGENCE QUESTIONNAIRE";
const FORM_CODE_DEFAULT = "QAF-OFD-043";
const MAX_PAGES = 3;
const PAGE_MARGINS = { top: 500, right: 600, bottom: 500, left: 600 };

function buildHeaderTable(record) {
  const meta = buildDocxMeta(record, FORM_CODE_DEFAULT);
  return buildQhseDocxHeaderTable({ formTitle: FORM_TITLE, meta });
}

function tableCell(text, bold = false) {
  const textValue = text !== null && text !== undefined ? String(text) : "";
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: textValue, bold })],
      }),
    ],
  });
}

function formatDate(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function sectionTitle(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    spacing: { before: 300 },
  });
}

function keyValueTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value]) =>
      new TableRow({
        children: [
          tableCell(label, true),
          tableCell(value ?? "—"),
        ],
      })
    ),
  });
}

function yesNo(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

export async function generateSupplierDueDiligenceDoc(record, fullPath) {
  const sd = record.supplierDetails || {};
  const ld = record.legalDeclarations || {};
  const ins = record.insuranceDetails || {};
  const comp = record.complianceDetails || {};
  const qms = comp.qualityManagementSystem || {};
  const eth = record.ethicsAndGovernance || {};
  const fin = record.financialAndData || {};
  const banker = fin.bankerDetails || {};
  const genDecl = record.generalDeclaration || {};
  const purchDecl = record.purchasingDeclaration || {};

  const blocks = [];

  blocks.push({
    rowCount: 14,
    children: [
      sectionTitle("Supplier Details"),
      keyValueTable([
        ["Incharge Name & Company", sd.inchargeNameAndCompany],
        ["Contact Details", sd.contactDetails],
        ["Company Registration", sd.companyRegistrationDetails],
        ["Parent Company", sd.parentCompanyDetails],
        ["Has Subsidiaries", yesNo(sd.hasSubsidiaries)],
        ["Subsidiaries Details", sd.subsidiariesDetails],
        ["Employee Count", sd.employeeCount != null ? String(sd.employeeCount) : ""],
        ["Business Activities", sd.businessActivities],
        ["Operating Locations", sd.operatingLocations],
        ["Payment Terms", sd.paymentTerms],
      ]),
    ],
  });

  blocks.push({
    rowCount: 8,
    children: [
      sectionTitle("Legal & Financial Declarations"),
      keyValueTable([
        ["Missing Licenses", yesNo(ld.missingLicenses)],
        ["Criminal Offence History", yesNo(ld.criminalOffenceHistory)],
        ["Insolvency Status", yesNo(ld.insolvencyStatus)],
        ["Business Misconduct", yesNo(ld.businessMisconduct)],
        ["Unpaid Statutory Payments", yesNo(ld.unpaidStatutoryPayments)],
        ["Declaration Details", ld.declarationDetails],
      ]),
    ],
  });

  blocks.push({
    rowCount: 6,
    children: [
      sectionTitle("Insurance Details"),
      keyValueTable([
        ["P&I", ins.pAndI],
        ["Workers Compensation", ins.workersCompensation],
        ["Public Liability", ins.publicLiability],
        ["Other Insurance", ins.otherInsurance],
      ]),
    ],
  });

  blocks.push({
    rowCount: 14,
    children: [
      sectionTitle("Quality & Compliance"),
      keyValueTable([
        ["QMS Registered", yesNo(qms.registered)],
        ["Date Accredited", formatDate(qms.dateAccredited)],
        ["Accredited By", qms.accreditedBy],
        ["Environmental Policy", yesNo(comp.environmentalPolicy)],
        ["ESG Programme", yesNo(comp.esgProgramme)],
        ["Other Certifications", comp.otherCertifications],
        ["ISO Certification", comp.isoCertification],
        ["Drug/Alcohol Policy", yesNo(comp.drugAlcoholPolicy)],
        ["Drug/Alcohol Procedure", comp.drugAlcoholProcedure],
        ["Health & Safety Policy", yesNo(comp.healthSafetyPolicy)],
        ["Incidents Last Two Years", yesNo(comp.incidentsLastTwoYears)],
        ["Incident Details", comp.incidentDetails],
      ]),
    ],
  });

  blocks.push({
    rowCount: 12,
    children: [
      sectionTitle("Ethics & Governance"),
      keyValueTable([
        ["Ethical Conduct Policy", yesNo(eth.ethicalConductPolicy)],
        ["Equality & Diversity Policy", yesNo(eth.equalityDiversityPolicy)],
        ["Subcontracting", yesNo(eth.subcontracting)],
        ["Subcontracting Details", eth.subcontractingDetails],
        ["Due Diligence for Subcontractors", yesNo(eth.dueDiligenceForSubcontractors)],
        ["Anti-Corruption Acknowledged", yesNo(eth.antiCorruptionAcknowledged)],
        ["Modern Slavery Acknowledged", yesNo(eth.modernSlaveryAcknowledged)],
        ["Sanctions Exposure", yesNo(eth.sanctionsExposure)],
      ]),
    ],
  });

  blocks.push({
    rowCount: 10,
    children: [
      sectionTitle("Financial & Data Protection"),
      keyValueTable([
        ["Credit Rating", fin.creditRatingDetails],
        ["Turnover Last Two Years", fin.turnoverLastTwoYears],
        ["Data Protection Policy", yesNo(fin.dataProtectionPolicy)],
        ["Banker Name", banker.name],
        ["Banker Branch", banker.branch],
        ["Banker Contact", banker.contactDetails],
        ["IBAN/Account Number", banker.ibanOrAccountNumber],
      ]),
    ],
  });

  blocks.push({
    rowCount: 8,
    children: [
      sectionTitle("Declarations"),
      keyValueTable([
        ["General Declaration – Name", genDecl.name],
        ["General Declaration – Position", genDecl.positionHeld],
        ["General Declaration – Signed At", formatDate(genDecl.signedAt)],
        ["Purchasing Declaration – Name", purchDecl.name],
        ["Purchasing Declaration – Position", purchDecl.positionHeld],
        ["Purchasing Declaration – Signed At", formatDate(purchDecl.signedAt)],
      ]),
    ],
  });

  const totalRowCount = blocks.reduce((sum, b) => sum + b.rowCount, 0);
  const totalPages = MAX_PAGES;
  const ROWS_PER_PAGE = Math.ceil(totalRowCount / totalPages) + 4;

  const sections = [];
  let sectionChildren = [
    buildHeaderTable(record),
    new Paragraph({ spacing: { before: 200 } }),
  ];
  let rowsUsed = 0;
  let pageNum = 1;

  for (const block of blocks) {
    if (rowsUsed + block.rowCount > ROWS_PER_PAGE && rowsUsed > 0) {
      sections.push({
        properties: { page: { margin: PAGE_MARGINS } },
        children: sectionChildren,
      });
      pageNum++;
      sectionChildren = [
        buildHeaderTable(record),
        new Paragraph({ spacing: { before: 200 } }),
      ];
      rowsUsed = 0;
    }
    sectionChildren = sectionChildren.concat(block.children);
    rowsUsed += block.rowCount;
  }

  if (sectionChildren.length > 0) {
    sections.push({
      properties: { page: { margin: PAGE_MARGINS } },
      children: sectionChildren,
    });
  }

  const doc = new Document({
    sections: sections.length ? sections : [{
      properties: { page: { margin: PAGE_MARGINS } },
      children: [
        buildHeaderTable(record),
        new Paragraph({ spacing: { before: 200 } }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);
}
