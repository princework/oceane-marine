import fs from "fs";
import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import { buildQhseDocxHeaderTable, buildDocxMeta } from "./shared/qhseDocxHeader.js";

const ROWS_PER_PAGE = 28;
const BASIC_INFO_ROW_COUNT = 6;

const PDF_FORM_CODE_DEFAULT = "QAF-OFD-013";
const PDF_FORM_TITLE = "STS EQUIPMENT BASE STOCK LEVEL";

function buildStsHeaderTable(report) {
  const meta = buildDocxMeta(report, "QAF-OFD-013");
  return buildQhseDocxHeaderTable({ formTitle: "STS EQUIPMENT BASE STOCK LEVEL", meta });
}

export async function generateStsEquipmentBaseStockLevelDoc(report, fullPath) {
  const basicInfoRows = [
    ["Year", report.year != null ? String(report.year) : ""],
    ["Status", report.status || ""],
    ["Filled By", report.filledBy?.name || ""],
    ["Role at Submission", report.filledBy?.roleAtSubmission || ""],
  ];

  const basicInfoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: basicInfoRows.map(([label, value]) =>
      new TableRow({
        children: [
          tableCell(label, true),
          tableCell(value || "________________________"),
        ],
      })
    ),
  });

  const basicInfoBlock = [
    new Paragraph({ spacing: { before: 200 } }),
    new Paragraph({
      children: [new TextRun({ text: "BASIC INFORMATION", bold: true, size: 24 })],
    }),
    basicInfoTable,
  ];

  const categories = report.equipmentCategories || [];
  const categoryBlocks = [];
  let totalRowCount = BASIC_INFO_ROW_COUNT;
  for (const cat of categories) {
    const title = cat.subCategory
      ? `${cat.categoryName} – ${cat.subCategory}`
      : cat.categoryName;
    const items = cat.items || [];
    const itemRows = items.length
      ? [
          new TableRow({
            children: [
              tableCell("Item Name", true),
              tableCell("Qty in Use", true),
              tableCell("Qty Spare", true),
              tableCell("Condition", true),
              tableCell("Comments", true),
            ],
          }),
          ...items.map((item) =>
            new TableRow({
              children: [
                tableCell(item.name || "", false),
                tableCell(item.quantityInUse != null ? String(item.quantityInUse) : "—", false),
                tableCell(item.quantitySpare != null ? String(item.quantitySpare) : "—", false),
                tableCell(item.overallCondition || "—", false),
                tableCell(item.additionalComments || "—", false),
              ],
            })
          ),
        ]
      : [];
    const blockRowCount = 2 + (itemRows.length ? itemRows.length : 1);
    totalRowCount += blockRowCount;
    categoryBlocks.push({
      rowCount: blockRowCount,
      children: [
        new Paragraph({ spacing: { before: 300 } }),
        new Paragraph({
          children: [new TextRun({ text: title, bold: true, size: 22 })],
        }),
        ...(items.length === 0
          ? [new Paragraph({ children: [new TextRun("No items.")] })]
          : [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: itemRows,
              }),
            ]),
      ],
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalRowCount / ROWS_PER_PAGE));
  const pageMargins = { top: 500, right: 600, bottom: 500, left: 600 };

  const sections = [];
  let blockIndex = 0;
  let pageNum = 1;
  let rowsUsedOnPage = 0;
  const firstPageCapacity = ROWS_PER_PAGE - BASIC_INFO_ROW_COUNT;

  let sectionChildren = [
    buildStsHeaderTable(report),
    ...basicInfoBlock,
  ];
  rowsUsedOnPage = BASIC_INFO_ROW_COUNT;

  while (blockIndex < categoryBlocks.length) {
    const block = categoryBlocks[blockIndex];
    const fitsOnCurrentPage =
      pageNum === 1
        ? rowsUsedOnPage + block.rowCount <= firstPageCapacity
        : rowsUsedOnPage + block.rowCount <= ROWS_PER_PAGE;
    if (fitsOnCurrentPage) {
      sectionChildren = sectionChildren.concat(block.children);
      rowsUsedOnPage += block.rowCount;
      blockIndex++;
    } else {
      sections.push({
        properties: { page: { margin: pageMargins } },
        children: sectionChildren,
      });
      pageNum++;
      sectionChildren = [
        buildStsHeaderTable(report),
        new Paragraph({ spacing: { before: 200 } }),
      ];
      rowsUsedOnPage = 0;
    }
  }

  if (sectionChildren.length > 0) {
    sections.push({
      properties: { page: { margin: pageMargins } },
      children: sectionChildren,
    });
  }

  const doc = new Document({
    sections: sections.length ? sections : [
      {
        properties: { page: { margin: pageMargins } },
        children: [
          buildStsHeaderTable(report),
          ...basicInfoBlock,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);
}

/**
 * PDF export: same content as Word + repeating QHSE header.
 * All dynamic text passes through {@link pdfSafeText} for jsPDF Helvetica compatibility.
 *
 * @param {object} report – lean STSEquipmentBaseStock document
 * @returns {Promise<Buffer>}
 */
export async function generateStsEquipmentBaseStockLevelPdf(report) {
  const jspdfModule = await import("jspdf");
  const JsPDF =
    jspdfModule.jsPDF ??
    (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) {
    throw new Error("jsPDF constructor not found");
  }
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();

  const meta = buildStandardMeta(report, PDF_FORM_CODE_DEFAULT);
  const headerCtl = createQhsePdfHeaderController({
    formTitle: PDF_FORM_TITLE,
    meta,
  });
  const tableMargins = headerCtl.getAutoTableMargins();
  const m = headerCtl.sideMarginMm;
  const contentW = pageW - 2 * m;

  const autoTableOpts = {
    margin: tableMargins,
    willDrawPage: headerCtl.willDrawPage,
  };

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
  doc.text("BASIC INFORMATION", m, headerCtl.tableTopMm - 5);

  const basicBody = [
    [
      "Year",
      pdfSafeText(report.year != null ? String(report.year) : "") ||
        "________________________",
    ],
    ["Status", pdfSafeText(report.status) || "________________________"],
    [
      "Filled By",
      pdfSafeText(report.filledBy?.name) || "________________________",
    ],
    [
      "Role at Submission",
      pdfSafeText(report.filledBy?.roleAtSubmission) || "________________________",
    ],
  ];

  autoTable(doc, {
    ...autoTableOpts,
    startY: headerCtl.tableTopMm + 5,
    head: [],
    body: basicBody,
    theme: "grid",
    styles: gridStyles,
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 48 },
      1: { cellWidth: "auto" },
    },
  });

  let y = doc.lastAutoTable.finalY + 10;

  const categories = report.equipmentCategories || [];
  for (const cat of categories) {
    const rawTitle = cat.subCategory
      ? `${cat.categoryName} – ${cat.subCategory}`
      : cat.categoryName;
    const title = pdfSafeText(rawTitle);

    if (y > pageH - 50) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      y = headerCtl.tableTopMm;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(title || "(Category)", contentW);
    titleLines.forEach((line, i) => {
      doc.text(line, m, y + i * 5.2);
    });
    y += titleLines.length * 5.2 + 4;

    const items = cat.items || [];
    if (items.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text("No items.", m, y);
      doc.setFont("helvetica", "bold");
      y += 8;
      continue;
    }

    const body = items.map((item) => [
      pdfSafeText(item.name || ""),
      item.quantityInUse != null ? pdfSafeText(String(item.quantityInUse)) : "-",
      item.quantitySpare != null ? pdfSafeText(String(item.quantitySpare)) : "-",
      pdfSafeText(item.overallCondition || "-"),
      pdfSafeText(item.additionalComments || "-"),
    ]);

    autoTable(doc, {
      ...autoTableOpts,
      startY: y,
      head: [["Item Name", "Qty in Use", "Qty Spare", "Condition", "Comments"]],
      body,
      theme: "grid",
      styles: { ...gridStyles, fontSize: 8 },
      headStyles: {
        fillColor: [240, 240, 240],
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 16, halign: "center" },
        2: { cellWidth: 16, halign: "center" },
        3: { cellWidth: 22 },
        4: { cellWidth: "auto" },
      },
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

function tableCell(text, bold = false) {
  const textValue = text !== null && text !== undefined ? String(text) : "";
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: textValue, bold })],
      }),
    ],
  });
}

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
