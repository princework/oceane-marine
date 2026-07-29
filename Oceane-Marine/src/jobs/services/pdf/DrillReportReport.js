import fs from "node:fs";
import path from "node:path";
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
  ImageRun,
  BorderStyle,
  SimpleField,
} from "docx";

const FORM_TITLE = "Drill Report";
const FORM_CODE_DEFAULT = "QAF-OFD-040";

const FALLBACK_REV = "1.0";
const FALLBACK_APPROVED_BY = "JS";

const THIN_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
};

const HEADER_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
};

const META_GREY = "EDEDED";
const FONT_SM = 18;
const FONT_XS = 16;

function formatDate(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
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

function labelCell(text, opts = {}) {
  const { rowSpan, columnSpan } = opts;
  return new TableCell({
    borders: THIN_BORDER,
    rowSpan,
    columnSpan,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text), bold: true, size: FONT_SM })],
      }),
    ],
  });
}

function valueCell(text, opts = {}) {
  const { rowSpan, columnSpan } = opts;
  const children = [];
  const val = text !== null && text !== undefined ? String(text) : "";
  if (val.includes("\n")) {
    val.split("\n").forEach((line, i) => {
      if (i > 0) children.push(new TextRun({ break: 1, size: FONT_SM }));
      children.push(new TextRun({ text: line, size: FONT_SM }));
    });
  } else {
    children.push(new TextRun({ text: val, size: FONT_SM }));
  }
  return new TableCell({
    borders: THIN_BORDER,
    rowSpan,
    columnSpan,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children })],
  });
}

function metaLabelCell(text) {
  return new TableCell({
    borders: THIN_BORDER,
    shading: { fill: "FFFFFF" },
    width: { size: 45, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: FONT_XS })],
      }),
    ],
  });
}

function metaValueCell(text) {
  return new TableCell({
    borders: THIN_BORDER,
    shading: { fill: META_GREY },
    width: { size: 55, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: FONT_XS })],
      }),
    ],
  });
}

function metaPageCell() {
  return new TableCell({
    borders: THIN_BORDER,
    shading: { fill: META_GREY },
    width: { size: 55, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [
          new SimpleField("PAGE", "1"),
          new TextRun({ text: " of ", size: FONT_XS }),
          new SimpleField("NUMPAGES", "1"),
        ],
      }),
    ],
  });
}

function sectionLabel(text) {
  return new Paragraph({
    spacing: { before: 250, after: 100 },
    children: [new TextRun({ text, bold: true, size: 20, underline: { type: "single" } })],
  });
}

/**
 * Generate Word document for a Drill Report.
 */
export async function generateDrillReportDoc(report, fullPath) {
  let logoImage = null;
  try {
    logoImage = fs.readFileSync(path.join(process.cwd(), "public/image/image.png"));
  } catch {
    /* no logo */
  }

  const formCode = report.formCode || FORM_CODE_DEFAULT;

  const revNo = report.revNo || FALLBACK_REV;
  const issueDateStr = formatMetaDate(report.issueDate || report.updatedAt || report.createdAt);
  const approvedName = report.approvedByName || FALLBACK_APPROVED_BY;

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [metaLabelCell("Form No:"), metaValueCell(formCode)] }),
      new TableRow({ children: [metaLabelCell("Rev.No."), metaValueCell(revNo)] }),
      new TableRow({ children: [metaLabelCell("Issue Date:"), metaValueCell(issueDateStr)] }),
      new TableRow({ children: [metaLabelCell("Approved by:"), metaValueCell(approvedName)] }),
      new TableRow({ children: [metaLabelCell("Page:"), metaPageCell()] }),
    ],
  });

  const headerRow = new TableRow({
    children: [
      new TableCell({
        borders: HEADER_BORDER,
        width: { size: 25, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          logoImage
            ? new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({ data: logoImage, transformation: { width: 200, height: 100 } }),
                ],
              })
            : new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "OCEANE GROUP", bold: true })],
              }),
        ],
      }),
      new TableCell({
        borders: HEADER_BORDER,
        width: { size: 45, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: FORM_TITLE, bold: true, size: 32 })],
          }),
        ],
      }),
      new TableCell({
        borders: HEADER_BORDER,
        width: { size: 30, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        children: [metaTable],
      }),
    ],
  });

  const participants = Array.isArray(report.participants) ? report.participants : [];
  const dateLocation = [formatDate(report.drillDate), report.location].filter(Boolean).join(" / ");

  const generalRows = [
    new TableRow({
      children: [labelCell("Drill No."), valueCell(report.drillNo ?? "")],
    }),
    new TableRow({
      children: [labelCell("Drill Date / Location"), valueCell(dateLocation)],
    }),
    new TableRow({
      children: [labelCell("Drill Scenario"), valueCell(report.drillScenario ?? "")],
    }),
  ];

  if (participants.length > 0) {
    participants.forEach((p, idx) => {
      const participantText = [p.name, p.role].filter(Boolean).join(" \u2013 ");
      if (idx === 0) {
        generalRows.push(
          new TableRow({
            children: [
              labelCell("Participants", { rowSpan: participants.length }),
              valueCell(participantText),
            ],
          })
        );
      } else {
        generalRows.push(
          new TableRow({ children: [valueCell(participantText)] })
        );
      }
    });
  } else {
    generalRows.push(
      new TableRow({ children: [labelCell("Participants"), valueCell("-")] })
    );
  }

  const generalTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3000, 7000],
    rows: generalRows,
  });

  const incidentChildren = [];
  const progText = report.incidentProgression ?? "";
  if (progText) {
    const bullets = progText
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    bullets.forEach((b) => {
      const line = b.replace(/^[-•]\s*/, "");
      incidentChildren.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: line, size: FONT_SM })],
        })
      );
    });
  } else {
    incidentChildren.push(new Paragraph({ children: [new TextRun({ text: "-", size: FONT_SM })] }));
  }

  const incidentTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3000, 7000],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: THIN_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Sequence of events", bold: true, size: FONT_SM })],
              }),
            ],
          }),
          new TableCell({
            borders: THIN_BORDER,
            children: incidentChildren,
          }),
        ],
      }),
    ],
  });

  const obsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3000, 7000],
    rows: [
      new TableRow({
        children: [labelCell("Sr. No."), valueCell("NA")],
      }),
      new TableRow({
        children: [labelCell("Observations"), valueCell("NA")],
      }),
      new TableRow({
        children: [labelCell("Root cause for the observations"), valueCell("NA")],
      }),
    ],
  });

  const sections = [
    {
      properties: {
        page: { margin: { top: 500, right: 600, bottom: 500, left: 600 } },
      },
      children: [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: HEADER_BORDER.top,
            bottom: HEADER_BORDER.bottom,
            left: HEADER_BORDER.left,
            right: HEADER_BORDER.right,
            insideVertical: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
          },
          rows: [headerRow],
        }),

        sectionLabel("General details"),
        generalTable,

        sectionLabel("Incident Progression:"),
        incidentTable,

        new Paragraph({
          spacing: { before: 250, after: 100 },
          children: [
            new TextRun({ text: "Observations: ", bold: true, size: 20, underline: { type: "single" } }),
            new TextRun({ text: "Nil", size: 20 }),
          ],
        }),
        obsTable,
      ],
    },
  ];

  const doc = new Document({ sections });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);
}
