import fs from "fs";
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

const FORM_TITLE = "AUDITS & INSPECTION PLANNER";
const FORM_CODE_DEFAULT = "QAF-OFD-048";
const MAX_PAGES = 3;
const PAGE_MARGINS = { top: 500, right: 600, bottom: 500, left: 600 };

function buildHeaderTable(record) {
  const meta = buildDocxMeta(record, FORM_CODE_DEFAULT);
  return buildQhseDocxHeaderTable({ formTitle: FORM_TITLE, meta });
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

function sectionTitle(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    spacing: { before: 300 },
  });
}

export async function generateAuditInspectionPlannerDoc(record, fullPath) {
  const categories = record.categories || [];
  const blocks = [];

  for (const cat of categories) {
    const title = cat.title || cat.key || "Section";
    const rows = cat.rows || [];
    const headerRow = new TableRow({
      children: [
        tableCell("Description", true),
        tableCell("Frequency", true),
        tableCell("Due By", true),
        tableCell("Status", true),
        tableCell("Auditor", true),
        tableCell("Audit Date", true),
        tableCell("Remarks", true),
      ],
    });
    const dataRows = rows.map((r) =>
      new TableRow({
        children: [
          tableCell(r.description),
          tableCell(r.frequency),
          tableCell(r.dueBy),
          tableCell(r.status),
          tableCell(r.auditorName),
          tableCell(formatDate(r.auditDate)),
          tableCell(r.remarks),
        ],
      })
    );
    const rowCount = 2 + (dataRows.length || 1);
    blocks.push({
      rowCount,
      children: [
        sectionTitle(title),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: dataRows.length ? [headerRow, ...dataRows] : [headerRow],
        }),
      ],
    });
  }

  const totalRowCount = blocks.reduce((sum, b) => sum + b.rowCount, 0) || 10;
  const totalPages = MAX_PAGES;
  const ROWS_PER_PAGE = Math.ceil(totalRowCount / totalPages) + 4;

  const sections = [];
  let sectionChildren = [
    buildHeaderTable(record),
    new Paragraph({ spacing: { before: 200 } }),
  ];
  let rowsUsed = 0;
  let pageNum = 1;

  for (const block of blocks) {
    if (rowsUsed + block.rowCount > ROWS_PER_PAGE && rowsUsed > 0) {
      sections.push({
        properties: { page: { margin: PAGE_MARGINS } },
        children: sectionChildren,
      });
      pageNum++;
      sectionChildren = [
        buildHeaderTable(record),
        new Paragraph({ spacing: { before: 200 } }),
      ];
      rowsUsed = 0;
    }
    sectionChildren = sectionChildren.concat(block.children);
    rowsUsed += block.rowCount;
  }

  if (sectionChildren.length > 0) {
    sections.push({
      properties: { page: { margin: PAGE_MARGINS } },
      children: sectionChildren,
    });
  }

  const doc = new Document({
    sections: sections.length ? sections : [{
      properties: { page: { margin: PAGE_MARGINS } },
      children: [
        buildHeaderTable(record),
        new Paragraph({ spacing: { before: 200 } }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);
}
