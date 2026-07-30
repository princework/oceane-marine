import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "DEFECTS LIST";
const FORM_CODE_DEFAULT = "QAF-OFD-025";

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

/** Empty or missing -> "-"; otherwise ASCII-safe for jsPDF */
function cellText(value) {
  if (value === null || value === undefined || value === "") return "-";
  return pdfSafeText(String(value));
}

/**
 * PMS equipment snapshot as one line. Reads the stored strings rather than the
 * live PMS record so a historical defect keeps the label it was raised against.
 */
function equipmentLabel(defect) {
  return [defect.equipmentCode, defect.equipmentName, defect.equipmentSerialCode]
    .filter(Boolean)
    .join(" - ");
}

/**
 * PDF export aligned with defects DOCX: header meta + record details table.
 *
 * @param {object} defect – lean EquipmentDefect document
 * @returns {Promise<Buffer>}
 */
export async function generateEquipmentDefectPdf(defect) {
  const jspdfModule = await import("jspdf");
  const JsPDF =
    jspdfModule.jsPDF ??
    (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) {
    throw new Error("jsPDF constructor not found");
  }
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const formCode = defect.formCode || FORM_CODE_DEFAULT;
  const meta = buildStandardMeta(defect, FORM_CODE_DEFAULT);
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
    ["Serial", cellText(defect.serialNumber)],
    ["Equipment", cellText(equipmentLabel(defect))],
    ["Defect Description", cellText(defect.equipmentDefect)],
    ["Base", cellText(defect.base)],
    ["Action Required", cellText(defect.actionRequired)],
    ["Target Date", cellText(formatDate(defect.targetDate))],
    ["Status", cellText(defect.status)],
    ["Completion Date", cellText(formatDate(defect.completionDate))],
    ["Created At", cellText(formatDate(defect.createdAt))],
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
