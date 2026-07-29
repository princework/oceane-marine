import fs from "node:fs";
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

const FORM_TITLE = "Annual Drill Plan";
const FORM_CODE_DEFAULT = "QAF-OFD-040";
const BEIGE_FILL = "E8DCC4";

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

function cell(text, opts = {}) {
  const { bold = false, shading = null, columnSpan } = opts;
  const textValue = text !== null && text !== undefined ? String(text) : "";
  return new TableCell({
    shading: shading ? { fill: shading } : undefined,
    columnSpan,
    children: [
      new Paragraph({
        children: [new TextRun({ text: textValue, bold })],
      }),
    ],
  });
}

/**
 * Generate Word document for Annual Drill Plan.
 * @param {object} plan - DrillPlan document (formCode, serialNumber, year, planItems, status)
 * @param {string} fullPath - Absolute path to write the .docx file
 */
export async function generateDrillPlanDoc(plan, fullPath) {
  const meta = buildDocxMeta(plan, FORM_CODE_DEFAULT);
  const headerTable = buildQhseDocxHeaderTable({ formTitle: FORM_TITLE, meta });

  const planItems = Array.isArray(plan.planItems) ? plan.planItems : [];
  const tableHeaderRow = new TableRow({
    children: [
      cell("Sl No.", { bold: true, shading: BEIGE_FILL }),
      cell("Quarter", { bold: true, shading: BEIGE_FILL }),
      cell("Planned Date", { bold: true, shading: BEIGE_FILL }),
      cell("Topic", { bold: true, shading: BEIGE_FILL }),
      cell("Instructor", { bold: true, shading: BEIGE_FILL }),
      cell("Description", { bold: true, shading: BEIGE_FILL }),
    ],
  });

  const dataRows = planItems.map((item, idx) =>
    new TableRow({
      children: [
        cell(idx + 1),
        cell(item.quarter ?? ""),
        cell(formatDate(item.plannedDate)),
        cell(item.topic ?? ""),
        cell(item.instructor ?? ""),
        cell(item.description ?? ""),
      ],
    })
  );

  const matrixTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...dataRows],
  });

  const sections = [
    {
      properties: {
        page: {
          margin: { top: 500, right: 600, bottom: 500, left: 600 },
        },
      },
      children: [
        headerTable,
        new Paragraph({ spacing: { before: 300 } }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Annual drill plan (matrix) for the year. Planned dates, topics, instructors and descriptions are listed below.",
            }),
          ],
        }),
        new Paragraph({ spacing: { before: 200 } }),
        matrixTable,
      ],
    },
  ];

  const doc = new Document({ sections });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);
}
