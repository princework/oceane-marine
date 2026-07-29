import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "Target KPI";
const FORM_CODE_DEFAULT = "HSE-001A";
const BEIGE = [232, 220, 196];

function cellText(value) {
  if (value === null || value === undefined || value === "") return "-";
  return pdfSafeText(String(value));
}

/**
 * Generate PDF for Target KPI.
 * @param {object} record - TargetKpi document (lean)
 * @returns {Promise<Buffer>}
 */
export async function generateTargetKpiPdf(record) {
  const jspdfModule = await import("jspdf");
  const JsPDF =
    jspdfModule.jsPDF ??
    (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) {
    throw new Error("jsPDF constructor not found");
  }
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  const formCode = record.formCode || FORM_CODE_DEFAULT;
  const year = record.year == null ? "" : String(record.year);
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
    fontSize: 7,
    cellPadding: 1.8,
    textColor: [30, 30, 30],
    lineColor: [200, 200, 200],
    lineWidth: 0.2,
    overflow: "linebreak",
  };

  let y = headerCtl.tableTopMm - 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const introText = `Target KPI for the year ${year}. Quarterly targets and achievements are listed below.`;
  const introLines = doc.splitTextToSize(
    pdfSafeText(introText),
    pageW - 2 * m
  );
  doc.text(introLines, m, y);
  y += introLines.length * 4 + 6;

  const rows = Array.isArray(record.rows) ? record.rows : [];
  const bodyRows = rows.map((row) => [
    cellText(row.title),
    cellText(row.targetForYear),
    cellText(row.quarter1),
    cellText(row.quarter2),
    cellText(row.quarter3),
    cellText(row.quarter4),
    cellText(row.targetsAchieved),
  ]);

  const colStyles = {
    0: { cellWidth: "auto" },
    1: { cellWidth: 28, halign: "center" },
    2: { cellWidth: 22, halign: "center" },
    3: { cellWidth: 22, halign: "center" },
    4: { cellWidth: 22, halign: "center" },
    5: { cellWidth: 22, halign: "center" },
    6: { cellWidth: 28, halign: "center" },
  };

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [
      [
        { content: "Title", styles: { fillColor: BEIGE, fontStyle: "bold" } },
        { content: `Targets for ${year}`, styles: { fillColor: BEIGE, fontStyle: "bold", halign: "center" } },
        { content: "Quarter 1", styles: { fillColor: BEIGE, fontStyle: "bold", halign: "center" } },
        { content: "Quarter 2", styles: { fillColor: BEIGE, fontStyle: "bold", halign: "center" } },
        { content: "Quarter 3", styles: { fillColor: BEIGE, fontStyle: "bold", halign: "center" } },
        { content: "Quarter 4", styles: { fillColor: BEIGE, fontStyle: "bold", halign: "center" } },
        { content: "Targets Achieved", styles: { fillColor: BEIGE, fontStyle: "bold", halign: "center" } },
      ],
    ],
    body: bodyRows,
    theme: "grid",
    styles: gridStyles,
    headStyles: {
      fillColor: BEIGE,
      textColor: [20, 20, 20],
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: colStyles,
  });

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
