import fs from "fs";
import path from "path";
import { getQhseSignatureAbsolutePathForRead } from "@/lib/utils/qhse-file-storage";
import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
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
  ImageRun,
} from "docx";
import { buildQhseDocxHeaderTable, buildDocxMeta } from "./shared/qhseDocxHeader.js";

/**
 * @param {object} completedBy
 * @returns {Buffer | null}
 */
function readTransferAuditSignatureBuffer(completedBy) {
  if (!completedBy) return null;
  const photo = completedBy.signaturePhoto;
  if (photo && typeof photo === "string" && photo.startsWith("data:")) {
    const match = photo.match(/^data:([^;]+);base64,(.+)$/s);
    if (match?.[2]) {
      try {
        return Buffer.from(match[2], "base64");
      } catch (_) {
        return null;
      }
    }
  }
  const abs =
    getQhseSignatureAbsolutePathForRead(photo) ||
    getQhseSignatureAbsolutePathForRead(completedBy.signatureUrl);
  if (abs && fs.existsSync(abs)) {
    try {
      return fs.readFileSync(abs);
    } catch (_) {
      return null;
    }
  }
  const url = completedBy.signatureUrl;
  if (url && typeof url === "string" && !url.startsWith("data:")) {
    try {
      const sigPath = url.startsWith("/")
        ? path.join(process.cwd(), "public", url.slice(1))
        : path.join(process.cwd(), url);
      if (fs.existsSync(sigPath)) return fs.readFileSync(sigPath);
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

export async function generateTransferAuditReportDoc(report, fullPath) {
  /* ================= HEADER TABLE ================= */
  const meta = buildDocxMeta(report, "QAF-OFD-003");
  const headerTable = buildQhseDocxHeaderTable({ formTitle: "STS TRANSFER AUDIT REPORT", meta });

  const reportDate = report.header?.date || report.revisionDate || report.createdAt;

  /* ================= BASIC INFORMATION TABLE (metadata same style as Base Audit) ================= */
  const basicInfoRows = [
    ["Location", report.header?.locationName || ""],
    ["Job No", report.header?.jobNo || ""],
    ["Date", formatDate(report.header?.date)],
    ["Discharging Vessel", report.header?.dischargingVessel || ""],
    ["Receiving Vessel", report.header?.receivingVessel || ""],
    ["Status", report.status || ""],
    ["Completed By", report.completedBy?.name || ""],
    ["Completed Date", formatDate(report.completedBy?.date)],
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

  const sectionTitles = [
    { key: "sectionA_PrePlanning", title: "Section A – Pre-Planning" },
    { key: "sectionB_MobilizationToDemobilization", title: "Section B – Mobilization to Demobilization" },
    { key: "sectionC_SupportCraft", title: "Section C – Support Craft" },
    { key: "sectionD_STSEquipment", title: "Section D – STS Equipment" },
    { key: "sectionE_PostOperation", title: "Section E – Post Operation" },
  ];

  const children = [
    headerTable,
    new Paragraph({ spacing: { before: 200 } }),
    new Paragraph({
      children: [new TextRun({ text: "BASIC INFORMATION", bold: true, size: 24 })],
    }),
    basicInfoTable,
  ];

  sectionTitles.forEach(({ key, title }) => {
    const sectionData = report[key];
    if (sectionData && Array.isArray(sectionData) && sectionData.length > 0) {
      children.push(new Paragraph({ spacing: { before: 300 } }));
      children.push(
        new Paragraph({
          children: [new TextRun({ text: title, bold: true, size: 22 })],
        })
      );
      const sectionTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              tableCell("Q No", true),
              tableCell("Question", true),
              tableCell("Answer", true),
              tableCell("Remarks", true),
            ],
          }),
          ...sectionData.map((q) =>
            new TableRow({
              children: [
                tableCell(q.qNo || ""),
                tableCell(q.question || ""),
                tableCell(q.answer || ""),
                tableCell(q.remarks || ""),
              ],
            })
          ),
        ],
      });
      children.push(sectionTable);
    }
  });

  if (report.comments?.remarks) {
    children.push(new Paragraph({ spacing: { before: 300 } }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "COMMENTS", bold: true, size: 22 })],
      })
    );
    children.push(
      new Paragraph({
        children: [new TextRun(report.comments.remarks)],
      })
    );
  }

  /* ================= COMPLETED BY & SIGNATURE ================= */
  const completedBy = report.completedBy;
  if (completedBy?.name || completedBy?.date || completedBy?.signatureText || completedBy?.signaturePhoto || completedBy?.signatureUrl) {
    children.push(new Paragraph({ spacing: { before: 300 } }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "COMPLETED BY", bold: true, size: 22 })],
      })
    );
    const completedRows = [
      ["Name", completedBy?.name || ""],
      ["Date", formatDate(completedBy?.date)],
    ];
    if (completedBy?.signatureText) {
      completedRows.push(["Signature (text)", completedBy.signatureText]);
    }
    const completedTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: completedRows.map(([label, value]) =>
        new TableRow({
          children: [
            tableCell(label, true),
            tableCell(value || "________________________"),
          ],
        })
      ),
    });
    children.push(completedTable);

    const signatureImageBuffer = readTransferAuditSignatureBuffer(completedBy);
    if (signatureImageBuffer && signatureImageBuffer.length > 0) {
      children.push(new Paragraph({ spacing: { before: 200 } }));
      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({ text: "Signature: ", bold: true }),
          ],
        })
      );
      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new ImageRun({
              data: signatureImageBuffer,
              transformation: { width: 180, height: 60 },
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 500,
              right: 600,
              bottom: 500,
              left: 600,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);
}

function tableCell(text, bold = false) {
  const textValue = text !== null && text !== undefined ? String(text) : "";
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: textValue,
            bold,
          }),
        ],
      }),
    ],
  });
}

function formatDate(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (e) {
    return "";
  }
}

const PDF_FORM_TITLE = "STS TRANSFER AUDIT REPORT";
const PDF_FORM_CODE_DEFAULT = "QAF-OFD-003";

const PDF_SECTION_DEFS = [
  { key: "sectionA_PrePlanning", title: "Section A – Pre-Planning" },
  { key: "sectionB_MobilizationToDemobilization", title: "Section B – Mobilization to Demobilization" },
  { key: "sectionC_SupportCraft", title: "Section C – Support Craft" },
  { key: "sectionD_STSEquipment", title: "Section D – STS Equipment" },
  { key: "sectionE_PostOperation", title: "Section E – Post Operation" },
];

/**
 * PDF export: same structure as Word (bordered header, basic info, sections, comments, completed by + signature).
 * @param {object} report – lean STSTransferAudit document
 * @returns {Promise<Buffer>}
 */
export async function generateTransferAuditReportPdf(report) {
  const jspdfModule = await import("jspdf");
  const JsPDF =
    jspdfModule.jsPDF ??
    (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  if (!JsPDF) {
    throw new Error("jsPDF constructor not found");
  }
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const meta = buildStandardMeta(report, PDF_FORM_CODE_DEFAULT);
  const headerCtl = createQhsePdfHeaderController({
    formTitle: PDF_FORM_TITLE,
    meta,
  });
  const tableMargins = headerCtl.getAutoTableMargins();
  const m = headerCtl.sideMarginMm;
  const contentW = pageW - 2 * m;

  const autoTableHeaderOpts = {
    margin: tableMargins,
    willDrawPage: headerCtl.willDrawPage,
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BASIC INFORMATION", m, headerCtl.tableTopMm - 5);

  const basicBody = [
    ["Location", report.header?.locationName || "________________________"],
    ["Job No", report.header?.jobNo || "________________________"],
    ["Date", formatDate(report.header?.date) || "________________________"],
    ["Discharging Vessel", report.header?.dischargingVessel || "________________________"],
    ["Receiving Vessel", report.header?.receivingVessel || "________________________"],
    ["Status", report.status || "________________________"],
    ["Completed By", report.completedBy?.name || "________________________"],
    ["Completed Date", formatDate(report.completedBy?.date) || "________________________"],
  ];

  autoTable(doc, {
    ...autoTableHeaderOpts,
    startY: headerCtl.tableTopMm + 5,
    head: [],
    body: basicBody,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [30, 30, 30],
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 48 },
      1: { cellWidth: "auto" },
    },
  });

  let y = doc.lastAutoTable.finalY + 10;

  for (const { key, title } of PDF_SECTION_DEFS) {
    const sectionData = report[key];
    if (!sectionData || !Array.isArray(sectionData) || sectionData.length === 0) continue;

    if (y > pageH - 35) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      y = headerCtl.tableTopMm;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, m, y);
    y += 6;

    autoTable(doc, {
      ...autoTableHeaderOpts,
      startY: y,
      head: [["Q No", "Question", "Answer", "Remarks"]],
      body: sectionData.map((q) => [
        q.qNo || "",
        q.question || "",
        q.answer || "",
        q.remarks || "",
      ]),
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [30, 30, 30],
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      headStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 78 },
        2: { cellWidth: 16 },
        3: { cellWidth: "auto" },
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (report.comments?.remarks) {
    if (y > pageH - 40) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      y = headerCtl.tableTopMm;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("COMMENTS", m, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const remarkLines = doc.splitTextToSize(String(report.comments.remarks), contentW);
    for (const line of remarkLines) {
      if (y > pageH - 15) {
        doc.addPage();
        headerCtl.notifyManualNewPage(doc);
        y = headerCtl.tableTopMm;
      }
      doc.text(line, m, y);
      y += 5;
    }
    y += 4;
  }

  const completedBy = report.completedBy;
  if (
    completedBy?.name ||
    completedBy?.date ||
    completedBy?.signatureText ||
    completedBy?.signaturePhoto ||
    completedBy?.signatureUrl
  ) {
    if (y > pageH - 50) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      y = headerCtl.tableTopMm;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("COMPLETED BY", m, y);
    y += 6;

    const completedRows = [
      ["Name", completedBy?.name || ""],
      ["Date", formatDate(completedBy?.date)],
    ];
    if (completedBy?.signatureText) {
      completedRows.push(["Signature (text)", completedBy.signatureText]);
    }

    autoTable(doc, {
      ...autoTableHeaderOpts,
      startY: y,
      head: [],
      body: completedRows.map(([label, value]) => [
        label,
        value || "________________________",
      ]),
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [30, 30, 30],
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 48 },
        1: { cellWidth: "auto" },
      },
    });
    y = doc.lastAutoTable.finalY + 6;

    const sig = loadSignatureImageForPdf(completedBy);
    if (sig) {
      if (y > pageH - 35) {
        doc.addPage();
        headerCtl.notifyManualNewPage(doc);
        y = headerCtl.tableTopMm;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Signature:", m, y);
      y += 5;
      try {
        const imgW = 55;
        const imgH = 20;
        doc.addImage(sig.data, sig.format, m, y, imgW, imgH);
        y += imgH + 6;
      } catch {
        y += 4;
      }
    }
  }

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

/** @returns {{ data: string, format: "PNG"|"JPEG" } | null} base64 without data URL prefix */
function loadSignatureImageForPdf(completedBy) {
  const buf = readTransferAuditSignatureBuffer(completedBy);
  if (!buf || buf.length === 0) return null;
  const photo = completedBy.signaturePhoto;
  if (photo && typeof photo === "string" && photo.startsWith("data:")) {
    const match = photo.match(/^data:([^;]+);base64,(.+)$/s);
    if (match?.[2]) {
      const mime = match[1].toLowerCase();
      const format =
        mime.includes("png") ? "PNG" : mime.includes("jpeg") || mime.includes("jpg") ? "JPEG" : "PNG";
      return { data: match[2], format };
    }
  }
  const pathStr = String(completedBy.signaturePhoto || completedBy.signatureUrl || "");
  const ext = path.extname(pathStr).toLowerCase();
  const format = ext === ".jpg" || ext === ".jpeg" ? "JPEG" : "PNG";
  return { data: buf.toString("base64"), format };
}
