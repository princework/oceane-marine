import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "BEST PRACTICES";
const FORM_CODE_DEFAULT = "QAF-BP";

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
 * PDF export aligned with Best Practice DOCX: header meta + record details.
 *
 * @param {object} practice – lean BestPractice document
 * @returns {Promise<Buffer>}
 */
export async function generateBestPracticePdf(practice) {
  const jspdfModule = await import("jspdf");
  const JsPDF =
    jspdfModule.jsPDF ??
    (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) {
    throw new Error("jsPDF constructor not found");
  }
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const formCode = practice.formCode || FORM_CODE_DEFAULT;
  const meta = buildStandardMeta(practice, FORM_CODE_DEFAULT);
  const headerCtl = createQhsePdfHeaderController({
    formTitle: FORM_TITLE,
    meta,
  });
  const tableMargins = headerCtl.getAutoTableMargins();
  const m = headerCtl.sideMarginMm;

  const gridStyles = {
    fontSize: 9,
    cellPadding: 3,
    textColor: [30, 30, 30],
    lineColor: [200, 200, 200],
    lineWidth: 0.2,
    overflow: "linebreak",
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RECORD DETAILS", m, headerCtl.tableTopMm - 5);

  const body = [
    ["Form Code", cellText(formCode)],
    ["Serial", cellText(practice.serialNumber)],
    ["Event Date", cellText(formatDate(practice.eventDate))],
    ["Description", cellText(practice.description)],
    ["Created At", cellText(formatDate(practice.createdAt))],
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
      0: { fontStyle: "bold", cellWidth: 48 },
      1: { cellWidth: "auto" },
    },
  });

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
