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

const FORM_TITLE = "Training Record";
const FORM_CODE_DEFAULT = "QAF-OFD-039";
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
 * Generate Word document for a Training Record.
 * @param {object} record - TrainingRecord document (formCode, serialNumber, topic, plannedDate, actualTrainingDate, instructor, attendance, status)
 * @param {string} fullPath - Absolute path to write the .docx file
 */
export async function generateTrainingRecordDoc(record, fullPath) {
  const meta = buildDocxMeta(record, FORM_CODE_DEFAULT);
  const headerTable = buildQhseDocxHeaderTable({ formTitle: FORM_TITLE, meta });

  const infoRows = [
    new TableRow({
      children: [
        cell("Topic", { shading: BEIGE_FILL }),
        cell(record.topic ?? "", { columnSpan: 3 }),
      ],
    }),
    new TableRow({
      children: [
        cell("Planned Date", { shading: BEIGE_FILL }),
        cell(formatDate(record.plannedDate)),
        cell("Actual Training Date", { shading: BEIGE_FILL }),
        cell(formatDate(record.actualTrainingDate)),
      ],
    }),
    new TableRow({
      children: [
        cell("Instructor", { shading: BEIGE_FILL }),
        cell(record.instructor ?? "", { columnSpan: 3 }),
      ],
    }),
  ];

  const attendance = Array.isArray(record.attendance) ? record.attendance : [];
  const attendanceHeaderRow = new TableRow({
    children: [
      cell("Sl No.", { bold: true, shading: BEIGE_FILL }),
      cell("Trainee Name", { bold: true, shading: BEIGE_FILL }),
      cell("Department", { bold: true, shading: BEIGE_FILL }),
      cell("Designation", { bold: true, shading: BEIGE_FILL }),
    ],
  });
  const attendanceDataRows = attendance.map((row, idx) =>
    new TableRow({
      children: [
        cell(idx + 1),
        cell(row.traineeName ?? ""),
        cell(row.department ?? ""),
        cell(row.designation ?? ""),
      ],
    })
  );

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
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: infoRows,
        }),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
          children: [new TextRun({ text: "Attendance", bold: true })],
        }),
        new Paragraph({ spacing: { before: 100 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [attendanceHeaderRow, ...attendanceDataRows],
        }),
      ],
    },
  ];

  const doc = new Document({ sections });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);
}
