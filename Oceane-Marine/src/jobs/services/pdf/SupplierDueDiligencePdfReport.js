import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "SUPPLIER DUE DILIGENCE QUESTIONNAIRE";
const FORM_CODE_DEFAULT = "QAF-OFD-043";

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

function cellText(value) {
  if (value === null || value === undefined || value === "") return "-";
  return pdfSafeText(String(value));
}

function ynCell(value) {
  if (value === true) return cellText("Yes");
  if (value === false) return cellText("No");
  return "-";
}

/**
 * PDF export: same sections/fields as {@link generateSupplierDueDiligenceDoc} (Word).
 *
 * @param {object} record – lean SupplierDueDiligence document
 * @returns {Promise<Buffer>}
 */
export async function generateSupplierDueDiligencePdf(record) {
  const jspdfModule = await import("jspdf");
  const JsPDF =
    jspdfModule.jsPDF ??
    (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) {
    throw new Error("jsPDF constructor not found");
  }
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();

  const formCode = record.formCode || FORM_CODE_DEFAULT;
  const reportDate = record.revisionDate || record.updatedAt;
  const meta = buildStandardMeta(record, FORM_CODE_DEFAULT);
  const headerCtl = createQhsePdfHeaderController({
    formTitle: FORM_TITLE,
    meta,
  });
  const tableMargins = headerCtl.getAutoTableMargins();
  const m = headerCtl.sideMarginMm;

  const autoTableOpts = {
    margin: tableMargins,
    willDrawPage: headerCtl.willDrawPage,
  };

  const gridStyles = {
    fontSize: 8,
    cellPadding: 2.5,
    textColor: [30, 30, 30],
    lineColor: [200, 200, 200],
    lineWidth: 0.2,
    overflow: "linebreak",
  };

  const columnStyles = {
    0: { fontStyle: "bold", cellWidth: 52 },
    1: { cellWidth: "auto" },
  };

  const ensureSpace = (y, neededMm = 28) => {
    if (y > pageH - neededMm) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      return headerCtl.tableTopMm;
    }
    return y;
  };

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

  let y = headerCtl.tableTopMm - 5;

  const drawSection = (title, body) => {
    y = ensureSpace(y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, m, y);
    y += 6;
    autoTable(doc, {
      ...autoTableOpts,
      startY: y,
      head: [],
      body: body,
      theme: "grid",
      styles: gridStyles,
      columnStyles,
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  drawSection("SUPPLIER DETAILS", [
    ["Incharge Name & Company", cellText(sd.inchargeNameAndCompany)],
    ["Contact Details", cellText(sd.contactDetails)],
    ["Company Registration", cellText(sd.companyRegistrationDetails)],
    ["Parent Company", cellText(sd.parentCompanyDetails)],
    ["Has Subsidiaries", ynCell(sd.hasSubsidiaries)],
    ["Subsidiaries Details", cellText(sd.subsidiariesDetails)],
    [
      "Employee Count",
      sd.employeeCount == null ? "-" : cellText(String(sd.employeeCount)),
    ],
    ["Business Activities", cellText(sd.businessActivities)],
    ["Operating Locations", cellText(sd.operatingLocations)],
    ["Payment Terms", cellText(sd.paymentTerms)],
  ]);

  drawSection("LEGAL & FINANCIAL DECLARATIONS", [
    ["Missing Licenses", ynCell(ld.missingLicenses)],
    ["Criminal Offence History", ynCell(ld.criminalOffenceHistory)],
    ["Insolvency Status", ynCell(ld.insolvencyStatus)],
    ["Business Misconduct", ynCell(ld.businessMisconduct)],
    ["Unpaid Statutory Payments", ynCell(ld.unpaidStatutoryPayments)],
    ["Declaration Details", cellText(ld.declarationDetails)],
  ]);

  drawSection("INSURANCE DETAILS", [
    ["P&I", cellText(ins.pAndI)],
    ["Workers Compensation", cellText(ins.workersCompensation)],
    ["Public Liability", cellText(ins.publicLiability)],
    ["Other Insurance", cellText(ins.otherInsurance)],
  ]);

  drawSection("QUALITY & COMPLIANCE", [
    ["QMS Registered", ynCell(qms.registered)],
    ["Date Accredited", cellText(formatDate(qms.dateAccredited))],
    ["Accredited By", cellText(qms.accreditedBy)],
    ["Environmental Policy", ynCell(comp.environmentalPolicy)],
    ["ESG Programme", ynCell(comp.esgProgramme)],
    ["Other Certifications", cellText(comp.otherCertifications)],
    ["ISO Certification", cellText(comp.isoCertification)],
    ["Drug/Alcohol Policy", ynCell(comp.drugAlcoholPolicy)],
    ["Drug/Alcohol Procedure", cellText(comp.drugAlcoholProcedure)],
    ["Health & Safety Policy", ynCell(comp.healthSafetyPolicy)],
    ["Incidents Last Two Years", ynCell(comp.incidentsLastTwoYears)],
    ["Incident Details", cellText(comp.incidentDetails)],
  ]);

  drawSection("ETHICS & GOVERNANCE", [
    ["Ethical Conduct Policy", ynCell(eth.ethicalConductPolicy)],
    ["Equality & Diversity Policy", ynCell(eth.equalityDiversityPolicy)],
    ["Subcontracting", ynCell(eth.subcontracting)],
    ["Subcontracting Details", cellText(eth.subcontractingDetails)],
    [
      "Due Diligence for Subcontractors",
      ynCell(eth.dueDiligenceForSubcontractors),
    ],
    ["Anti-Corruption Acknowledged", ynCell(eth.antiCorruptionAcknowledged)],
    ["Modern Slavery Acknowledged", ynCell(eth.modernSlaveryAcknowledged)],
    ["Sanctions Exposure", ynCell(eth.sanctionsExposure)],
  ]);

  drawSection("FINANCIAL & DATA PROTECTION", [
    ["Credit Rating", cellText(fin.creditRatingDetails)],
    ["Turnover Last Two Years", cellText(fin.turnoverLastTwoYears)],
    ["Data Protection Policy", ynCell(fin.dataProtectionPolicy)],
    ["Banker Name", cellText(banker.name)],
    ["Banker Branch", cellText(banker.branch)],
    ["Banker Contact", cellText(banker.contactDetails)],
    ["IBAN/Account Number", cellText(banker.ibanOrAccountNumber)],
  ]);

  drawSection("DECLARATIONS", [
    ["General Declaration – Name", cellText(genDecl.name)],
    ["General Declaration – Position", cellText(genDecl.positionHeld)],
    ["General Declaration – Signed At", cellText(formatDate(genDecl.signedAt))],
    ["Purchasing Declaration – Name", cellText(purchDecl.name)],
    ["Purchasing Declaration – Position", cellText(purchDecl.positionHeld)],
    [
      "Purchasing Declaration – Signed At",
      cellText(formatDate(purchDecl.signedAt)),
    ],
  ]);

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
