import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";
import {
  EVALUATION_CATEGORIES,
  POAC_CROSS_DEFAULT_AREAS as DEFAULT_AREAS,
  poacCrossStatusForHeader,
} from "./poacCrossCompetencyEvaluationData.js";

const FORM_TITLE = "POAC Cross Competency Evaluation";
const FORM_CODE_DEFAULT = "QAF-OFD-009";
const BEIGE = [232, 220, 196];

const INTRO_TEXT =
  "This cross audit is to be carried out by a nominated POAC for another POAC handling the STS operation. This audit will be reviewed by QHSE Manager or Director of Operation as required and it will be determined if POAC (Auditee) require any training.";

const INSTRUCTION_TEXT =
  "Levels of Performance: 1= Unacceptable, 2= Needs Improvement, 3=Meets Expectation, 4= Exceeds Expectation, 5=Outstanding. Require specific comments of auditor in case rating of performance is below 3";

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

function labelCell(text) {
  return {
    content: cellText(text),
    styles: { fillColor: BEIGE, fontStyle: "bold", fontSize: 7 },
  };
}

/**
 * @param {string | null | undefined} value
 * @returns {{ format: string; data: string } | null}
 */
function getSignatureImageForPdf(value) {
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /not available|n\/a/i.test(trimmed)) return null;
  if (trimmed.startsWith("data:image/png")) {
    return {
      format: "PNG",
      data: trimmed.replace(/^data:image\/png;base64,/, ""),
    };
  }
  if (/^data:image\/jpe?g;base64,/i.test(trimmed)) {
    return {
      format: "JPEG",
      data: trimmed.replace(/^data:image\/jpe?g;base64,/i, ""),
    };
  }
  if (/^[A-Za-z0-9+/=]{50,}$/.test(trimmed)) {
    return { format: "PNG", data: trimmed };
  }
  return null;
}

function drawSignatureInCell(doc, data, img, maxW = 52, maxH = 16) {
  if (!img) return;
  try {
    const pad = 1;
    const w = Math.min(maxW, data.cell.width - 2 * pad);
    const h = Math.min(maxH, data.cell.height - 2 * pad);
    doc.addImage(
      img.data,
      img.format,
      data.cell.x + pad,
      data.cell.y + pad,
      w,
      h
    );
  } catch {
    // ignore corrupt image data
  }
}

/**
 * PDF export: same content/sections as {@link generatePoacCrossCompetencyDoc} (Word).
 *
 * @param {object} record – lean PoacCrossCompetency document
 * @returns {Promise<Buffer>}
 */
export async function generatePoacCrossCompetencyPdf(record) {
  const jspdfModule = await import("jspdf");
  const JsPDF =
    jspdfModule.jsPDF ??
    (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) {
    throw new Error("jsPDF constructor not found");
  }
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const formCode = record.formCode || FORM_CODE_DEFAULT;
  const statusLine = poacCrossStatusForHeader(record);
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

  const fourCol = {
    0: { cellWidth: 42 },
    1: { cellWidth: "auto" },
    2: { cellWidth: 38 },
    3: { cellWidth: "auto" },
  };

  const ensureSpace = (y, neededMm = 30) => {
    if (y > pageH - neededMm) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      return headerCtl.tableTopMm;
    }
    return y;
  };

  let y = headerCtl.tableTopMm - 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const introLines = doc.splitTextToSize(
    pdfSafeText(INTRO_TEXT),
    pageW - 2 * m
  );
  doc.text(introLines, m, y);
  y += introLines.length * 4 + 4;

  y = ensureSpace(y, 45);
  const genBody = [
    [labelCell("Name of POAC"), { content: cellText(record.nameOfPOAC), colSpan: 3 }],
    [
      labelCell("Date"),
      cellText(formatDate(record.evaluationDate)),
      labelCell("Location"),
      cellText(record.location),
    ],
    [
      labelCell("Job Ref #"),
      cellText(record.jobRefNo),
      labelCell("Type of Operation"),
      cellText(record.typeOfOperation),
    ],
    [
      labelCell("Lead POAC"),
      cellText(record.leadPOAC),
      labelCell("Weather Condition"),
      cellText(record.weatherCondition),
    ],
    [
      labelCell("Discharging vessel"),
      cellText(record.dischargingVessel),
      labelCell("Deadweight"),
      record.deadweightDischarging == null
        ? ""
        : pdfSafeText(String(record.deadweightDischarging)),
    ],
    [
      labelCell("Receiving vessel"),
      cellText(record.receivingVessel),
      labelCell("Deadweight"),
      record.deadweightReceiving == null
        ? ""
        : pdfSafeText(String(record.deadweightReceiving)),
    ],
  ];

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [],
    body: genBody,
    theme: "grid",
    styles: gridStyles,
    columnStyles: fourCol,
  });
  y = doc.lastAutoTable.finalY + 6;

  y = ensureSpace(y, 20);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  const instrLines = doc.splitTextToSize(
    pdfSafeText(INSTRUCTION_TEXT),
    pageW - 2 * m
  );
  doc.text(instrLines, m, y);
  y += instrLines.length * 3.8 + 6;
  doc.setFont("helvetica", "normal");

  const evaluationItems = record.evaluationItems || [];
  const itemBySrNo = {};
  evaluationItems.forEach((item) => {
    itemBySrNo[item.srNo] = item;
  });

  const checklistBody = [];
  for (const cat of EVALUATION_CATEGORIES) {
    checklistBody.push([
      {
        content: pdfSafeText(cat.name),
        colSpan: 4,
        styles: {
          fillColor: BEIGE,
          fontStyle: "bold",
          halign: "left",
          fontSize: 7,
        },
      },
    ]);
    for (let srNo = cat.start; srNo <= cat.end; srNo++) {
      const item = itemBySrNo[srNo];
      const area = item?.area || DEFAULT_AREAS[srNo] || "";
      const evalVal =
        item?.evaluation != null && item?.evaluation !== undefined
          ? pdfSafeText(String(item.evaluation))
          : "";
      const remarksTxt =
        item?.remarks != null && String(item.remarks).trim() !== ""
          ? pdfSafeText(String(item.remarks))
          : "";
      checklistBody.push([
        cellText(String(srNo)),
        cellText(area),
        evalVal,
        remarksTxt,
      ]);
    }
  }

  const checklistCol = {
    0: { cellWidth: 14 },
    1: { cellWidth: "auto" },
    2: { cellWidth: 22 },
    3: { cellWidth: 48 },
  };

  y = ensureSpace(y, 40);
  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [
      [
        {
          content: "Sr. No.",
          styles: { fillColor: BEIGE, fontStyle: "bold" },
        },
        {
          content: "Areas Audited",
          styles: { fillColor: BEIGE, fontStyle: "bold" },
        },
        {
          content: "Level of Performance",
          styles: { fillColor: BEIGE, fontStyle: "bold" },
        },
        {
          content: "Remarks",
          styles: { fillColor: BEIGE, fontStyle: "bold" },
        },
      ],
    ],
    body: checklistBody,
    theme: "grid",
    styles: { ...gridStyles, fontSize: 6.5 },
    headStyles: {
      fillColor: BEIGE,
      textColor: [20, 20, 20],
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: checklistCol,
  });
  y = doc.lastAutoTable.finalY + 10;

  const leadSig = getSignatureImageForPdf(record.leadPOACSignature);

  y = ensureSpace(y, 55);
  const leadBody = [
    [
      {
        content: "Lead POAC's Comment",
        colSpan: 4,
        styles: { fillColor: BEIGE, fontStyle: "bold" },
      },
    ],
    [{ content: cellText(record.leadPOACComment), colSpan: 4 }],
    [
      labelCell("Name"),
      cellText(record.leadPOACName),
      labelCell("Date"),
      cellText(formatDate(record.leadPOACDate)),
    ],
    [
      labelCell("Signature"),
      {
        content: " ",
        colSpan: 3,
        styles: { minCellHeight: leadSig ? 18 : 6 },
      },
    ],
  ];

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [],
    body: leadBody,
    theme: "grid",
    styles: gridStyles,
    columnStyles: fourCol,
    didDrawCell: (data) => {
      if (data.section === "body" && data.row.index === 3 && data.column.index === 1) {
        drawSignatureInCell(doc, data, leadSig);
      }
    },
  });
  y = doc.lastAutoTable.finalY + 10;

  const opsSig1 = getSignatureImageForPdf(record.opsTeamSignature);
  const opsSig2 = getSignatureImageForPdf(record.opsTeamSupdtSignature);

  y = ensureSpace(y, 70);
  const opsBody = [
    [
      {
        content: "Operation & Operations Support Team Comments",
        colSpan: 4,
        styles: { fillColor: BEIGE, fontStyle: "bold" },
      },
    ],
    [{ content: cellText(record.opsSupportTeamComment), colSpan: 4 }],
    [
      labelCell("Ops Team Name"),
      cellText(record.opsTeamName),
      labelCell("Signature"),
      {
        content: " ",
        styles: { minCellHeight: opsSig1 ? 16 : 6 },
      },
    ],
    [
      labelCell("Date"),
      cellText(formatDate(record.opsTeamDate)),
      "",
      "",
    ],
    [
      labelCell("Ops. Team Supdt. Name"),
      cellText(record.opsTeamSupdtName),
      labelCell("Signature"),
      {
        content: " ",
        styles: { minCellHeight: opsSig2 ? 16 : 6 },
      },
    ],
    [
      labelCell("Date"),
      cellText(formatDate(record.opsTeamSupdtDate)),
      "",
      "",
    ],
  ];

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [],
    body: opsBody,
    theme: "grid",
    styles: gridStyles,
    columnStyles: fourCol,
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      if (data.row.index === 2 && data.column.index === 3) {
        drawSignatureInCell(doc, data, opsSig1);
      }
      if (data.row.index === 4 && data.column.index === 3) {
        drawSignatureInCell(doc, data, opsSig2);
      }
    },
  });

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
