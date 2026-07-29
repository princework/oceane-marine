import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "Training Record";
const FORM_CODE_DEFAULT = "QAF-OFD-039";
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
    styles: { fillColor: BEIGE, fontStyle: "bold", fontSize: 7 },
  };
}

/**
 * Generate PDF for a Training Record.
 * @param {object} record - TrainingRecord document (lean)
 * @returns {Promise<Buffer>}
 */
export async function generateTrainingRecordPdf(record) {
  const jspdfModule = await import("jspdf");
  const JsPDF =
    jspdfModule.jsPDF ??
    (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) {
    throw new Error("jsPDF constructor not found");
  }
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

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
    fontSize: 7,
    cellPadding: 1.8,
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

  let y = headerCtl.tableTopMm - 4;

  const infoBody = [
    [labelCell("Topic"), { content: cellText(record.topic), colSpan: 3 }],
    [
      labelCell("Planned Date"),
      cellText(formatDate(record.plannedDate)),
      labelCell("Actual Training Date"),
      cellText(formatDate(record.actualTrainingDate)),
    ],
    [
      labelCell("Instructor"),
      { content: cellText(record.instructor), colSpan: 3 },
    ],
  ];

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [],
    body: infoBody,
    theme: "grid",
    styles: gridStyles,
    columnStyles: fourCol,
  });
  y = doc.lastAutoTable.finalY + 8;

  const attendance = Array.isArray(record.attendance) ? record.attendance : [];
  const attendanceBody = attendance.map((row, idx) => [
    cellText(String(idx + 1)),
    cellText(row.traineeName),
    cellText(row.department),
    cellText(row.designation),
  ]);

  const attColStyles = {
    0: { cellWidth: 14 },
    1: { cellWidth: "auto" },
    2: { cellWidth: 40 },
    3: { cellWidth: 50 },
  };

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [
      [
        { content: "Sl No.", styles: { fillColor: BEIGE, fontStyle: "bold" } },
        { content: "Trainee Name", styles: { fillColor: BEIGE, fontStyle: "bold" } },
        { content: "Department", styles: { fillColor: BEIGE, fontStyle: "bold" } },
        { content: "Designation", styles: { fillColor: BEIGE, fontStyle: "bold" } },
      ],
    ],
    body: attendanceBody,
    theme: "grid",
    styles: gridStyles,
    headStyles: {
      fillColor: BEIGE,
      textColor: [20, 20, 20],
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: attColStyles,
  });

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
