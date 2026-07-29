import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "CID Record";
const BEIGE = [232, 220, 196];

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

function labelCell(text) {
  return {
    content: cellText(text),
    styles: { fillColor: BEIGE, fontStyle: "bold", fontSize: 8 },
  };
}

/**
 * @param {object} record – lean Cid document
 * @returns {Promise<Buffer>}
 */
export async function generateCidPdf(record) {
  const jspdfModule = await import("jspdf");
  const JsPDF =
    jspdfModule.jsPDF ??
    (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) {
    throw new Error("jsPDF constructor not found");
  }
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const headerCtl = createQhsePdfHeaderController({
    formTitle: FORM_TITLE,
    meta: buildStandardMeta(record, "HR-CID"),
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

  const fourCol = {
    0: { cellWidth: 42 },
    1: { cellWidth: "auto" },
    2: { cellWidth: 42 },
    3: { cellWidth: "auto" },
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RECORD DETAILS", m, headerCtl.tableTopMm - 5);

  const body = [
    [labelCell("Title"), { content: cellText(record.title), colSpan: 3 }],
    [
      labelCell("Name"),
      cellText(record.name),
      labelCell("Location"),
      cellText(record.location),
    ],
    [
      labelCell("Validity"),
      cellText(formatDate(record.validity)),
      labelCell("Created"),
      cellText(formatDate(record.createdAt)),
    ],
  ];

  autoTable(doc, {
    startY: headerCtl.tableTopMm + 5,
    margin: tableMargins,
    willDrawPage: headerCtl.willDrawPage,
    head: [],
    body,
    theme: "grid",
    styles: gridStyles,
    columnStyles: fourCol,
  });

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
