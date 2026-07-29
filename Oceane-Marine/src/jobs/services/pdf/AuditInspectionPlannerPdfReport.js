import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "AUDITS & INSPECTION PLANNER";
const FORM_CODE_DEFAULT = "QAF-OFD-048";

const TABLE_HEAD = [
  "Description",
  "Frequency",
  "Due By",
  "Status",
  "Auditor",
  "Audit Date",
  "Remarks",
];

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

function rowToBodyCells(r) {
  return [
    cellText(r.description),
    cellText(r.frequency),
    cellText(r.dueBy),
    cellText(r.status),
    cellText(r.auditorName),
    cellText(formatDate(r.auditDate)),
    cellText(r.remarks),
  ];
}

/**
 * PDF export: same structure/columns as {@link generateAuditInspectionPlannerDoc} (Word).
 * Landscape A4 fits the 7-column category grids.
 *
 * @param {object} record – lean AuditInspectionPlanner document
 * @returns {Promise<Buffer>}
 */
export async function generateAuditInspectionPlannerPdf(record) {
  const jspdfModule = await import("jspdf");
  const JsPDF =
    jspdfModule.jsPDF ??
    (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) {
    throw new Error("jsPDF constructor not found");
  }
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();

  const formCode = record.formCode || FORM_CODE_DEFAULT;
  const reportDate = record.issueDate || record.updatedAt;
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

  const headStyles = {
    fillColor: [240, 240, 240],
    textColor: [20, 20, 20],
    fontStyle: "bold",
    fontSize: 7,
  };

  /** Narrow columns first; remarks column takes remainder */
  const columnStyles = {
    0: { cellWidth: 42 },
    1: { cellWidth: 26 },
    2: { cellWidth: 24 },
    3: { cellWidth: 22 },
    4: { cellWidth: 28 },
    5: { cellWidth: 26 },
    6: { cellWidth: "auto" },
  };

  const ensureSpace = (y, neededMm = 35) => {
    if (y > pageH - neededMm) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      return headerCtl.tableTopMm;
    }
    return y;
  };

  const categories = record.categories || [];

  let y = headerCtl.tableTopMm - 5;

  if (!categories.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("No categories defined for this planner.", m, y);
    overlayQhsePageNumbers(doc);
    return Buffer.from(doc.output("arraybuffer"));
  }

  for (const cat of categories) {
    const title = String(cat.title || cat.key || "Section");
    const rows = Array.isArray(cat.rows) ? cat.rows : [];
    const body = rows.map((r) => rowToBodyCells(r));

    y = ensureSpace(y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(pdfSafeText(title.toUpperCase()), m, y);
    y += 5;

    autoTable(doc, {
      ...autoTableOpts,
      startY: y,
      head: [TABLE_HEAD.map((h) => cellText(h))],
      body: body.length ? body : [],
      theme: "grid",
      styles: gridStyles,
      headStyles,
      columnStyles,
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
