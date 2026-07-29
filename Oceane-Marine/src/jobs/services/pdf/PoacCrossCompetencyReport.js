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
  ImageRun,
} from "docx";
import {
  EVALUATION_CATEGORIES,
  POAC_CROSS_DEFAULT_AREAS as DEFAULT_AREAS,
} from "./poacCrossCompetencyEvaluationData.js";
import { buildQhseDocxHeaderTable, buildDocxMeta } from "./shared/qhseDocxHeader.js";
import { loadSignatureImage } from "./shared/loadSignatureImage.js";

const FORM_TITLE = "POAC Cross Competency Evaluation";
const FORM_CODE_DEFAULT = "QAF-OFD-009";
const BEIGE_FILL = "E8DCC4"; // light tan/beige for headers and labels
const ROWS_PER_PAGE = 32; // one section ≈ one page so header repeats; first section has intro+table+instruction+first chunk (~31 rows)
const PAGE_MARGINS = { top: 500, right: 600, bottom: 500, left: 600 };
const CHECKLIST_CHUNK_SIZE = 22; // rows per checklist table chunk (header + 21 data rows)

function buildHeaderTable(record) {
  const meta = buildDocxMeta(record, FORM_CODE_DEFAULT);
  return buildQhseDocxHeaderTable({ formTitle: FORM_TITLE, meta });
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

function getSignatureBuffer(value) {
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /not available|n\/a/i.test(trimmed)) return null;
  return loadSignatureImage(trimmed, "POAC-CrossCompetency");
}

export async function generatePoacCrossCompetencyDoc(record, fullPath) {
  const blocks = [];
  const firstPageChildren = [];

  // --- Intro paragraph ---
  const introText =
    "This cross audit is to be carried out by a nominated POAC for another POAC handling the STS operation. This audit will be reviewed by QHSE Manager or Director of Operation as required and it will be determined if POAC (Auditee) require any training.";
  firstPageChildren.push(
    new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun(introText)],
    })
  );

  // --- General Information Table (6 rows, 4 columns) ---
  const genInfoRows = [
    [
      cell("Name of POAC", { shading: BEIGE_FILL }),
      cell(record.nameOfPOAC ?? "", { columnSpan: 3 }),
    ],
    [
      cell("Date", { shading: BEIGE_FILL }),
      cell(formatDate(record.evaluationDate)),
      cell("Location", { shading: BEIGE_FILL }),
      cell(record.location ?? ""),
    ],
    [
      cell("Job Ref #", { shading: BEIGE_FILL }),
      cell(record.jobRefNo ?? ""),
      cell("Type of Operation", { shading: BEIGE_FILL }),
      cell(record.typeOfOperation ?? ""),
    ],
    [
      cell("Lead POAC", { shading: BEIGE_FILL }),
      cell(record.leadPOAC ?? ""),
      cell("Weather Condition", { shading: BEIGE_FILL }),
      cell(record.weatherCondition ?? ""),
    ],
    [
      cell("Discharging vessel", { shading: BEIGE_FILL }),
      cell(record.dischargingVessel ?? ""),
      cell("Deadweight", { shading: BEIGE_FILL }),
      cell(record.deadweightDischarging != null ? String(record.deadweightDischarging) : ""),
    ],
    [
      cell("Receiving vessel", { shading: BEIGE_FILL }),
      cell(record.receivingVessel ?? ""),
      cell("Deadweight", { shading: BEIGE_FILL }),
      cell(record.deadweightReceiving != null ? String(record.deadweightReceiving) : ""),
    ],
  ].map((cells) => new TableRow({ children: cells }));
  firstPageChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: genInfoRows,
    })
  );

  // --- Performance levels instruction ---
  const instructionText =
    "Levels of Performance: 1= Unacceptable, 2= Needs Improvement, 3=Meets Expectation, 4= Exceeds Expectation, 5=Outstanding. Require specific comments of auditor in case rating of performance is below 3";
  firstPageChildren.push(
    new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({ text: instructionText, italics: true })],
    })
  );

  // --- Checklist: build all rows then split into chunks so first page gets content + header on every page ---
  const evaluationItems = record.evaluationItems || [];
  const itemBySrNo = {};
  evaluationItems.forEach((item) => {
    itemBySrNo[item.srNo] = item;
  });
  const checklistHeaderRow = new TableRow({
    children: [
      cell("Sr. No.", { bold: true, shading: BEIGE_FILL }),
      cell("Areas Audited", { bold: true, shading: BEIGE_FILL }),
      cell("Level of Performance", { bold: true, shading: BEIGE_FILL }),
      cell("Remarks", { bold: true, shading: BEIGE_FILL }),
    ],
  });
  const allChecklistRows = [checklistHeaderRow];
  for (const cat of EVALUATION_CATEGORIES) {
    allChecklistRows.push(
      new TableRow({
        children: [
          cell("", { shading: BEIGE_FILL }),
          cell(cat.name, { bold: true, shading: BEIGE_FILL, columnSpan: 2 }),
          cell("", { shading: BEIGE_FILL }),
        ],
      })
    );
    for (let srNo = cat.start; srNo <= cat.end; srNo++) {
      const item = itemBySrNo[srNo];
      const area = item?.area || DEFAULT_AREAS[srNo] || "";
      const evalVal =
        item?.evaluation != null && item?.evaluation !== undefined
          ? String(item.evaluation)
          : "";
      const remarks = item?.remarks ?? "";
      allChecklistRows.push(
        new TableRow({
          children: [
            cell(srNo),
            cell(area),
            cell(evalVal),
            cell(remarks),
          ],
        })
      );
    }
  }
  // First chunk goes on page 1 with intro + gen info + instruction; rest as separate blocks (header each page)
  const checklistChunks = [];
  for (let start = 0; start < allChecklistRows.length; start += CHECKLIST_CHUNK_SIZE) {
    const end = Math.min(start + CHECKLIST_CHUNK_SIZE, allChecklistRows.length);
    const chunkRows = allChecklistRows.slice(start, end);
    const needHeader = start > 0;
    const tableRows = needHeader ? [checklistHeaderRow, ...chunkRows] : chunkRows;
    checklistChunks.push({
      rowCount: tableRows.length,
      table: new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      }),
    });
  }
  // First block = intro (2) + gen info (6) + instruction (1) + first checklist chunk (~22) = fills page 1
  const firstChunk = checklistChunks[0];
  if (firstChunk) {
    firstPageChildren.push(firstChunk.table);
    blocks.push({
      rowCount: 2 + 6 + 1 + firstChunk.rowCount,
      children: firstPageChildren,
    });
  } else {
    blocks.push({
      rowCount: 2 + 6 + 1,
      children: firstPageChildren,
    });
  }
  // Remaining checklist chunks each get their own block (new section = new page with header)
  for (let i = 1; i < checklistChunks.length; i++) {
    blocks.push({
      rowCount: checklistChunks[i].rowCount,
      children: [checklistChunks[i].table],
    });
  }

  // --- Lead POAC's Comment (beige title bar, content, signature block) ---
  const leadPoacRows = [
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 4,
          shading: { fill: BEIGE_FILL },
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Lead POAC's Comment", bold: true })],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 4,
          children: [
            new Paragraph({
              children: [new TextRun(record.leadPOACComment || "")],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        cell("Name", { shading: BEIGE_FILL }),
        cell(record.leadPOACName ?? ""),
        cell("Date", { shading: BEIGE_FILL }),
        cell(formatDate(record.leadPOACDate)),
      ],
    }),
  ];
  const leadSigBuf = getSignatureBuffer(record.leadPOACSignature);
  leadPoacRows.push(
    new TableRow({
      children: [
        cell("Signature", { shading: BEIGE_FILL }),
        leadSigBuf
          ? new TableCell({
              columnSpan: 3,
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: leadSigBuf,
                      transformation: { width: 180, height: 60 },
                    }),
                  ],
                }),
              ],
            })
          : cell("", { columnSpan: 3 }),
      ],
    })
  );
  blocks.push({
    rowCount: leadPoacRows.length,
    children: [
      new Paragraph({ spacing: { before: 400 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: leadPoacRows,
      }),
    ],
  });

  // --- Operation & Operations Support Team Comments ---
  const opsRows = [
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 4,
          shading: { fill: BEIGE_FILL },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Operation & Operations Support Team Comments",
                  bold: true,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 4,
          children: [
            new Paragraph({
              children: [new TextRun(record.opsSupportTeamComment || "")],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        cell("Ops Team Name", { shading: BEIGE_FILL }),
        cell(record.opsTeamName ?? ""),
        cell("Signature", { shading: BEIGE_FILL }),
        getSignatureBuffer(record.opsTeamSignature)
          ? new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: getSignatureBuffer(record.opsTeamSignature),
                      transformation: { width: 120, height: 40 },
                    }),
                  ],
                }),
              ],
            })
          : cell(""),
      ],
    }),
    new TableRow({
      children: [
        cell("Date", { shading: BEIGE_FILL }),
        cell(formatDate(record.opsTeamDate)),
        cell(""),
        cell(""),
      ],
    }),
    new TableRow({
      children: [
        cell("Ops. Team Supdt. Name", { shading: BEIGE_FILL }),
        cell(record.opsTeamSupdtName ?? ""),
        cell("Signature", { shading: BEIGE_FILL }),
        getSignatureBuffer(record.opsTeamSupdtSignature)
          ? new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: getSignatureBuffer(record.opsTeamSupdtSignature),
                      transformation: { width: 120, height: 40 },
                    }),
                  ],
                }),
              ],
            })
          : cell(""),
      ],
    }),
    new TableRow({
      children: [
        cell("Date", { shading: BEIGE_FILL }),
        cell(formatDate(record.opsTeamSupdtDate)),
        cell(""),
        cell(""),
      ],
    }),
  ];
  blocks.push({
    rowCount: opsRows.length,
    children: [
      new Paragraph({ spacing: { before: 300 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: opsRows,
      }),
    ],
  });

  // First pass: count how many sections we will have so header can show "Page X of Y"
  let rowsUsedCount = 0;
  let sectionCount = 1;
  for (const block of blocks) {
    if (rowsUsedCount + block.rowCount > ROWS_PER_PAGE && rowsUsedCount > 0) {
      sectionCount++;
      rowsUsedCount = 0;
    }
    rowsUsedCount += block.rowCount;
  }
  const totalPages = sectionCount;

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
    sections: sections.length
      ? sections
      : [
          {
            properties: { page: { margin: PAGE_MARGINS } },
            children: [
              buildHeaderTable(record),
              new Paragraph({ spacing: { before: 200 } }),
            ],
          },
        ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);
}
