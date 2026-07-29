import fs from "node:fs";
import path from "node:path";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "Drill Report";
const FORM_CODE_DEFAULT = "QAF-OFD-040";

const FALLBACK_REV = "1.0";
const FALLBACK_APPROVED_BY = "JS";

const MARGIN_MM = 12;
const COL_FRAC = [0.25, 0.5, 0.25];
const META_ROW_H = 4.25;
const META_VALUE_GREY = [237, 237, 237];
const TABLE_TOP_MM = 50;
const LABEL_W_MM = 42;

function formatDate(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

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

function safe(v) {
  if (v === null || v === undefined || v === "") return "-";
  return pdfSafeText(String(v));
}

/* ───────── header (logo | title | meta) — repeats every page ───────── */

function paintHeader(doc, report) {
  const pageW = doc.internal.pageSize.getWidth();
  const x0 = MARGIN_MM;
  const contentW = pageW - 2 * MARGIN_MM;
  const col1 = contentW * COL_FRAC[0];
  const col2 = contentW * COL_FRAC[1];
  const col3 = contentW * COL_FRAC[2];
  const rowTop = MARGIN_MM;
  const formCode = report.formCode || FORM_CODE_DEFAULT;

  let logoBottom = rowTop;
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), "public/image/image.png"));
    const logoW = Math.min(40, col1 - 4);
    const logoH = logoW * 0.55;
    doc.addImage(buf.toString("base64"), "PNG", x0 + (col1 - logoW) / 2, rowTop + 2, logoW, logoH);
    logoBottom = rowTop + 2 + logoH;
  } catch {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("OCEANE", x0 + col1 / 2, rowTop + 10, { align: "center" });
    logoBottom = rowTop + 14;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  const titleLines = doc.splitTextToSize(pdfSafeText(FORM_TITLE), col2 - 6);
  let ty = rowTop + 14;
  titleLines.forEach((l) => { doc.text(l, x0 + col1 + col2 / 2, ty, { align: "center" }); ty += 5.5; });
  const titleBottom = ty;

  const metaX = x0 + col1 + col2 + 1.5;
  const metaW = col3 - 3;
  const labelW = metaW * 0.45;
  const valW = metaW - labelW;
  const metaTop = rowTop + 1;

  const revNo = report.revNo || FALLBACK_REV;
  const issueDateStr = formatMetaDate(report.issueDate || report.updatedAt || report.createdAt);
  const approvedName = report.approvedByName || FALLBACK_APPROVED_BY;

  const rows = [
    ["Form No:", formCode],
    ["Rev.No.", revNo],
    ["Issue Date:", issueDateStr],
    ["Approved by:", approvedName],
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
    doc.text(rows[i][0], metaX + 0.8, y + 2.9);
    const vx = metaX + labelW;
    doc.setFillColor(...META_VALUE_GREY);
    doc.rect(vx, y, valW, META_ROW_H, "FD");
    doc.setFont("helvetica", "normal");
    if (rows[i][1] != null) doc.text(pdfSafeText(String(rows[i][1])), vx + 0.8, y + 2.9);
  }
  const metaBottom = metaTop + 5 * META_ROW_H;

  doc.__drillMetaPageRect = { valX: metaX + labelW, y: metaTop + 4 * META_ROW_H, w: valW, h: META_ROW_H };

  const boxTop = rowTop - 1;
  const boxBottom = Math.max(logoBottom, titleBottom, metaBottom) + 3;
  doc.setLineWidth(0.45);
  doc.rect(x0, boxTop, contentW, boxBottom - boxTop, "S");
  doc.line(x0 + col1, boxTop, x0 + col1, boxBottom);
  doc.line(x0 + col1 + col2, boxTop, x0 + col1 + col2, boxBottom);
}

function overlayPageNumbers(doc) {
  const r = doc.__drillMetaPageRect;
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

function makeHeaderCtl(report) {
  let lastPage = null;
  return {
    willDrawPage(data) {
      const d = data.doc;
      const p = d.getCurrentPageInfo().pageNumber;
      if (lastPage === p) return;
      lastPage = p;
      paintHeader(d, report);
    },
    margins() {
      return { top: TABLE_TOP_MM, left: MARGIN_MM, right: MARGIN_MM, bottom: MARGIN_MM };
    },
  };
}

/* ───────── main ───────── */

export async function generateDrillReportPdf(report) {
  const jspdfModule = await import("jspdf");
  const JsPDF = jspdfModule.jsPDF ?? (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) throw new Error("jsPDF constructor not found");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const hctl = makeHeaderCtl(report);
  const m = MARGIN_MM;
  const atOpts = { margin: hctl.margins(), willDrawPage: hctl.willDrawPage };

  const grid = {
    fontSize: 7.5,
    cellPadding: 2,
    textColor: [30, 30, 30],
    lineColor: [0, 0, 0],
    lineWidth: 0.18,
    overflow: "linebreak",
  };

  const twoCol = { 0: { cellWidth: LABEL_W_MM }, 1: { cellWidth: "auto" } };

  let y = TABLE_TOP_MM - 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("General details", m, y);
  y += 1;

  const participants = Array.isArray(report.participants) ? report.participants : [];
  const dateLocation = [formatDate(report.drillDate), report.location].filter(Boolean).join(" / ");

  const labelStyle = { fontStyle: "bold", fontSize: 7.5 };

  const generalBody = [
    [{ content: "Drill No.", styles: labelStyle }, safe(report.drillNo)],
    [{ content: "Drill Date / Location", styles: labelStyle }, safe(dateLocation)],
    [{ content: "Drill Scenario", styles: labelStyle }, safe(report.drillScenario)],
  ];

  if (participants.length > 0) {
    participants.forEach((p, idx) => {
      const txt = [p.name, p.role].filter(Boolean).join(" \u2013 ");
      if (idx === 0) {
        generalBody.push([{ content: "Participants", styles: labelStyle, rowSpan: participants.length }, safe(txt)]);
      } else {
        generalBody.push([safe(txt)]);
      }
    });
  } else {
    generalBody.push([{ content: "Participants", styles: labelStyle }, "-"]);
  }

  autoTable(doc, {
    ...atOpts,
    startY: y,
    head: [],
    body: generalBody,
    theme: "grid",
    styles: grid,
    columnStyles: twoCol,
  });
  y = doc.lastAutoTable.finalY + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Incident Progression:", m, y);
  y += 1;

  const progText = report.incidentProgression ?? "";
  const bullets = progText.split(/\n/).map((l) => l.trim().replace(/^[-•]\s*/, "")).filter(Boolean);
  const progValue = bullets.length > 0 ? bullets.map((b) => `\u2022  ${b}`).join("\n") : "-";

  autoTable(doc, {
    ...atOpts,
    startY: y,
    head: [],
    body: [
      [{ content: "Sequence of events", styles: { fontStyle: "bold", fontSize: 7.5 } }, safe(progValue)],
    ],
    theme: "grid",
    styles: grid,
    columnStyles: twoCol,
  });
  y = doc.lastAutoTable.finalY + 6;

  const obsY = y;
  if (obsY + 30 > doc.internal.pageSize.getHeight() - m) {
    doc.addPage();
    paintHeader(doc, report);
    y = TABLE_TOP_MM;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Observations: ", m, y, { continued: true });
  doc.setFont("helvetica", "normal");
  const obsLabelW = doc.getTextWidth("Observations: ");
  doc.text("Nil", m + obsLabelW, y);
  y += 1;

  autoTable(doc, {
    ...atOpts,
    startY: y,
    head: [],
    body: [
      [{ content: "Sr. No.", styles: { fontStyle: "bold", fontSize: 7.5 } }, "NA"],
      [{ content: "Observations", styles: { fontStyle: "bold", fontSize: 7.5 } }, "NA"],
      [{ content: "Root cause for the observations", styles: { fontStyle: "bold", fontSize: 7.5 } }, "NA"],
    ],
    theme: "grid",
    styles: grid,
    columnStyles: twoCol,
  });

  overlayPageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
