import { readDocumentLogo } from "../../../../lib/brand/documentLogo.js";

export const QHSE_PDF_SIDE_MARGIN_MM = 12;
export const QHSE_PDF_TABLE_TOP_MM = 58;

const META_ROW_H = 4.25;
const META_VALUE_GREY = [237, 237, 237];
const FALLBACK_APPROVED_BY = "JS";

function formatMetaDate(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Build the standard 5-row meta block from a record.
 * @param {object} record - DB document (formCode, revNo, issueDate, approvedByName, updatedAt, createdAt …)
 * @param {string} formCodeDefault - Fallback form code for this module
 */
export function buildStandardMeta(record, formCodeDefault) {
  return {
    formNo: record.formCode || formCodeDefault || "-",
    revNo: record.revNo || record.revisionNo || "1.0",
    issueDate: formatMetaDate(record.issueDate || record.revisionDate || record.updatedAt || record.createdAt),
    approvedBy: record.approvedByName || FALLBACK_APPROVED_BY,
  };
}

/**
 * Draw logo | form title | 5-row bordered metadata grid.
 * Stores `doc.__qhsePageRect` so `overlayQhsePageNumbers` can fill in page counts.
 */
export function paintQhseFormHeader(doc, { formTitle, meta }) {
  const margin = QHSE_PDF_SIDE_MARGIN_MM;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - 2 * margin;
  const col1 = contentW * 0.25;
  const col2 = contentW * 0.5;
  const col3 = contentW * 0.25;
  const rowTop = margin;

  let logoBottom = rowTop;
  try {
    const buf = readDocumentLogo();
    const logoW = Math.min(40, col1 - 4);
    const logoH = logoW * 0.55;
    doc.addImage(buf.toString("base64"), "PNG", margin + (col1 - logoW) / 2, rowTop + 2, logoW, logoH);
    logoBottom = rowTop + 2 + logoH;
  } catch {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("OCEANE", margin + col1 / 2, rowTop + 10, { align: "center" });
    logoBottom = rowTop + 14;
  }

  const titleX = margin + col1 + col2 / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  const titleLines = doc.splitTextToSize(String(formTitle || ""), col2 - 6);
  let ty = rowTop + 12;
  titleLines.forEach((line) => {
    doc.text(line, titleX, ty, { align: "center" });
    ty += 5;
  });
  const titleBottom = ty;

  const metaX = margin + col1 + col2 + 1.5;
  const metaW = col3 - 3;
  const labelW = metaW * 0.45;
  const valW = metaW - labelW;
  const metaTop = rowTop + 1;

  const rows = [
    ["Form No:", meta.formNo],
    ["Rev.No.", meta.revNo],
    ["Issue Date:", meta.issueDate],
    ["Approved by:", meta.approvedBy],
    ["Page:", null],
  ];

  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);
  for (let i = 0; i < 5; i++) {
    const y = metaTop + i * META_ROW_H;
    doc.setFillColor(255, 255, 255);
    doc.rect(metaX, y, labelW, META_ROW_H, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(rows[i][0], metaX + 0.8, y + 2.9);
    const vx = metaX + labelW;
    doc.setFillColor(...META_VALUE_GREY);
    doc.rect(vx, y, valW, META_ROW_H, "FD");
    doc.setFont("helvetica", "normal");
    if (rows[i][1] != null) {
      doc.text(String(rows[i][1]), vx + 0.8, y + 2.9);
    }
  }
  const metaBottom = metaTop + 5 * META_ROW_H;

  doc.__qhsePageRect = { valX: metaX + labelW, y: metaTop + 4 * META_ROW_H, w: valW, h: META_ROW_H };

  const boxTop = rowTop - 1;
  const boxBottom = Math.max(logoBottom, titleBottom, metaBottom) + 3;
  doc.setLineWidth(0.45);
  doc.setDrawColor(0, 0, 0);
  doc.rect(margin, boxTop, contentW, boxBottom - boxTop, "S");
  doc.line(margin + col1, boxTop, margin + col1, boxBottom);
  doc.line(margin + col1 + col2, boxTop, margin + col1 + col2, boxBottom);

  return boxBottom;
}

/**
 * Call after all content is rendered to stamp "X of Y" on every page's Page row.
 */
export function overlayQhsePageNumbers(doc) {
  const r = doc.__qhsePageRect;
  if (!r) return;
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(...META_VALUE_GREY);
    doc.rect(r.valX, r.y, r.w, r.h, "F");
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(r.valX, r.y, r.w, r.h, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(`${p} of ${total}`, r.valX + 0.8, r.y + 2.9);
  }
}

/**
 * Repeats the QHSE header on every physical PDF page, without duplicating
 * on the same page when multiple autoTable() runs.
 * @param {{ formTitle: string, meta: { formNo, revNo, issueDate, approvedBy } }} params
 */
export function createQhsePdfHeaderController(params) {
  let lastPhysicalPage = null;

  function willDrawPage(data) {
    const doc = data.doc;
    const p = doc.getCurrentPageInfo().pageNumber;
    if (lastPhysicalPage === p) return;
    lastPhysicalPage = p;
    paintQhseFormHeader(doc, params);
  }

  function notifyManualNewPage(doc) {
    paintQhseFormHeader(doc, params);
    lastPhysicalPage = doc.getCurrentPageInfo().pageNumber;
  }

  function getAutoTableMargins() {
    return {
      top: QHSE_PDF_TABLE_TOP_MM,
      left: QHSE_PDF_SIDE_MARGIN_MM,
      right: QHSE_PDF_SIDE_MARGIN_MM,
      bottom: QHSE_PDF_SIDE_MARGIN_MM,
    };
  }

  return {
    willDrawPage,
    notifyManualNewPage,
    getAutoTableMargins,
    tableTopMm: QHSE_PDF_TABLE_TOP_MM,
    sideMarginMm: QHSE_PDF_SIDE_MARGIN_MM,
  };
}
