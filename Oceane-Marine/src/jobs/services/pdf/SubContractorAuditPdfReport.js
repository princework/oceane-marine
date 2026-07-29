import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "SUB-CONTRACTOR AUDIT";
const FORM_CODE_DEFAULT = "QAF-OFD-055";

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
 * PDF export: same sections/fields as {@link generateSubContractorAuditDoc} (Word).
 *
 * @param {object} record – lean SubContractorAudit document
 * @returns {Promise<Buffer>}
 */
export async function generateSubContractorAuditPdf(record) {
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

  const auditBy = record.auditCompletedBy || {};
  const approvedBy = record.contractorApprovedBy || {};

  const isoCerts =
    Array.isArray(record.isoCertifications) &&
    record.isoCertifications.length
      ? cellText(record.isoCertifications.join(", "))
      : "-";

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

  drawSection("SUB-CONTRACTOR DETAILS", [
    ["Sub-Contractor Name", cellText(record.subcontractorName)],
    ["Address", cellText(record.subcontractorAddress)],
    ["Service Type", cellText(record.serviceType)],
    ["Contact Person", cellText(record.contactPerson)],
    ["Email", cellText(record.emailOfContactPerson)],
    ["Phone", cellText(record.phoneOfContactPerson)],
    ["Operating Areas", cellText(record.operatingAreas)],
  ]);

  drawSection("COMPLIANCE", [
    ["Trade License Copy Available", ynCell(record.tradeLicenseCopyAvailable)],
    ["Has HSE Policy", ynCell(record.hasHSEPolicy)],
    ["Audits Subcontractors", ynCell(record.auditsSubcontractors)],
    ["Has Insurance", ynCell(record.hasInsurance)],
    ["Insurance Details", cellText(record.insuranceDetails)],
    ["ISO Certifications", isoCerts],
  ]);

  drawSection("OFFICE USE", [
    ["Audit Completed By", cellText(auditBy.name)],
    ["Designation", cellText(auditBy.designation)],
    ["Signed At", cellText(formatDate(auditBy.signedAt))],
    ["Signature (text)", cellText(auditBy.signatureText)],
    ["Contractor Approved By", cellText(approvedBy.name)],
    ["Designation", cellText(approvedBy.designation)],
    ["Signed At", cellText(formatDate(approvedBy.signedAt))],
    ["Signature (text)", cellText(approvedBy.signatureText)],
  ]);

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
