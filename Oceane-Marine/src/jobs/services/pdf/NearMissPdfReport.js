import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "NEAR MISS REPORTING";
const FORM_CODE_DEFAULT = "QAF-OFD-015";

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

/**
 * PDF export aligned with near-miss DOCX: header meta + record details.
 *
 * @param {object} report – lean NearMiss document
 * @returns {Promise<Buffer>}
 */
export async function generateNearMissPdf(report) {
  const jspdfModule = await import("jspdf");
  const JsPDF =
    jspdfModule.jsPDF ??
    (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) {
    throw new Error("jsPDF constructor not found");
  }
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const formCode = report.formCode || FORM_CODE_DEFAULT;
  const meta = buildStandardMeta(report, FORM_CODE_DEFAULT);
  const headerCtl = createQhsePdfHeaderController({
    formTitle: FORM_TITLE,
    meta,
  });
  const tableMargins = headerCtl.getAutoTableMargins();
  const m = headerCtl.sideMarginMm;

  const gridStyles = {
    fontSize: 8,
    cellPadding: 2.5,
    textColor: [30, 30, 30],
    lineColor: [200, 200, 200],
    lineWidth: 0.2,
    overflow: "linebreak",
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RECORD DETAILS", m, headerCtl.tableTopMm - 5);

  const body = [
    ["Serial", cellText(report.serialNumber)],
    ["Job Ref No", cellText(report.JobRefNo)],
    ["Vessel Name", cellText(report.VesselName)],
    ["Time of Incident", cellText(formatDate(report.timeOfIncident))],
    ["Name of Observer", cellText(report.NameOfObserver)],
    ["Position of Observer", cellText(report.PositionOfObserver)],
    ["Email", cellText(report.email)],
    ["Type of Reporting", cellText(report.TypeOfReporting)],
    ["Area of Near Miss", cellText(report.AreaOfNearMiss)],
    ["Description", cellText(report.Description)],
    ["Immediate Cause", cellText(report.ImmediateCause)],
    ["Root Cause", cellText(report.RootCause)],
    ["Corrective Action", cellText(report.CorrectiveAction)],
    ["Status", cellText(report.status)],
    ["Remarks by Reviewer", cellText(report.remarksByReviewer)],
    ["Created At", cellText(formatDate(report.createdAt))],
  ];

  autoTable(doc, {
    startY: headerCtl.tableTopMm + 5,
    margin: tableMargins,
    willDrawPage: headerCtl.willDrawPage,
    head: [],
    body,
    theme: "grid",
    styles: gridStyles,
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42 },
      1: { cellWidth: "auto" },
    },
  });

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
