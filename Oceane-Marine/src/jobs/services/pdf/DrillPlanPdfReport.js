import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "Annual Drill Plan";
const FORM_CODE_DEFAULT = "QAF-OFD-040";
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

/**
 * Generate PDF for Annual Drill Plan.
 * @param {object} plan - DrillPlan document (lean)
 * @returns {Promise<Buffer>}
 */
export async function generateDrillPlanPdf(plan) {
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

  const formCode = plan.formCode || FORM_CODE_DEFAULT;
  const meta = buildStandardMeta(plan, FORM_CODE_DEFAULT);
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
  const introText =
    "Annual drill plan (matrix) for the year. Planned dates, topics, instructors and descriptions are listed below.";
  const introLines = doc.splitTextToSize(
    pdfSafeText(introText),
    pageW - 2 * m
  );
  doc.text(introLines, m, y);
  y += introLines.length * 4 + 6;

  const planItems = Array.isArray(plan.planItems) ? plan.planItems : [];
  const bodyRows = planItems.map((item, idx) => [
    cellText(String(idx + 1)),
    cellText(item.quarter),
    cellText(formatDate(item.plannedDate)),
    cellText(item.topic),
    cellText(item.instructor),
    cellText(item.description),
  ]);

  const colStyles = {
    0: { cellWidth: 12 },
    1: { cellWidth: 20 },
    2: { cellWidth: 26 },
    3: { cellWidth: "auto" },
    4: { cellWidth: 32 },
    5: { cellWidth: "auto" },
  };

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [
      [
        { content: "Sl No.", styles: { fillColor: BEIGE, fontStyle: "bold" } },
        { content: "Quarter", styles: { fillColor: BEIGE, fontStyle: "bold" } },
        { content: "Planned Date", styles: { fillColor: BEIGE, fontStyle: "bold" } },
        { content: "Topic", styles: { fillColor: BEIGE, fontStyle: "bold" } },
        { content: "Instructor", styles: { fillColor: BEIGE, fontStyle: "bold" } },
        { content: "Description", styles: { fillColor: BEIGE, fontStyle: "bold" } },
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
