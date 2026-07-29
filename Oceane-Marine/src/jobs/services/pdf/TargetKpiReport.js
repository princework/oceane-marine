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
  AlignmentType,
  VerticalAlign,
} from "docx";
import { buildQhseDocxHeaderTable, buildDocxMeta } from "./shared/qhseDocxHeader.js";

const FORM_TITLE = "Target KPI";
const FORM_CODE_DEFAULT = "HSE-001A";
const BEIGE_FILL = "E8DCC4";

function cell(text, opts = {}) {
  const { bold = false, shading = null, columnSpan, alignment } = opts;
  const textValue = text !== null && text !== undefined ? String(text) : "";
  return new TableCell({
    shading: shading ? { fill: shading } : undefined,
    columnSpan,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: alignment || AlignmentType.LEFT,
        children: [new TextRun({ text: textValue, bold })],
      }),
    ],
  });
}

/**
 * Generate Word document for Target KPI.
 * @param {object} record - TargetKpi document (formCode, serialNumber, year, rows)
 * @param {string} fullPath - Absolute path to write the .docx file
 */
export async function generateTargetKpiDoc(record, fullPath) {
  const meta = buildDocxMeta(record, FORM_CODE_DEFAULT);
  const headerTable = buildQhseDocxHeaderTable({ formTitle: FORM_TITLE, meta });
  const year = record.year == null ? "" : String(record.year);

  const rows = Array.isArray(record.rows) ? record.rows : [];
  const tableHeaderRow = new TableRow({
    children: [
      cell("Title", { bold: true, shading: BEIGE_FILL }),
      cell(`Targets for ${year}`, { bold: true, shading: BEIGE_FILL, alignment: AlignmentType.CENTER }),
      cell("Quarter 1", { bold: true, shading: BEIGE_FILL, alignment: AlignmentType.CENTER }),
      cell("Quarter 2", { bold: true, shading: BEIGE_FILL, alignment: AlignmentType.CENTER }),
      cell("Quarter 3", { bold: true, shading: BEIGE_FILL, alignment: AlignmentType.CENTER }),
      cell("Quarter 4", { bold: true, shading: BEIGE_FILL, alignment: AlignmentType.CENTER }),
      cell("Targets Achieved", { bold: true, shading: BEIGE_FILL, alignment: AlignmentType.CENTER }),
    ],
  });

  const dataRows = rows.map((row) =>
    new TableRow({
      children: [
        cell(row.title ?? ""),
        cell(row.targetForYear != null ? String(row.targetForYear) : "", { alignment: AlignmentType.CENTER }),
        cell(row.quarter1 != null ? String(row.quarter1) : "", { alignment: AlignmentType.CENTER }),
        cell(row.quarter2 != null ? String(row.quarter2) : "", { alignment: AlignmentType.CENTER }),
        cell(row.quarter3 != null ? String(row.quarter3) : "", { alignment: AlignmentType.CENTER }),
        cell(row.quarter4 != null ? String(row.quarter4) : "", { alignment: AlignmentType.CENTER }),
        cell(row.targetsAchieved != null ? String(row.targetsAchieved) : "", { alignment: AlignmentType.CENTER }),
      ],
    })
  );

  const kpiTable = new Table({
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
              text: `Target KPI for the year ${year}. Quarterly targets and achievements are listed below.`,
            }),
          ],
        }),
        new Paragraph({ spacing: { before: 200 } }),
        kpiTable,
      ],
    },
  ];

  const doc = new Document({ sections });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);
}
