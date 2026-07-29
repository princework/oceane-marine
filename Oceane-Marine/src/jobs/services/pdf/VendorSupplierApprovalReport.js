import fs from "fs";
import path from "path";
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
  ImageRun,
} from "docx";
import { buildQhseDocxHeaderTable, buildDocxMeta } from "./shared/qhseDocxHeader.js";

const supplyOfPartsLabels = {
  technicalComparison: "Technical Comparison",
  commercialComparison: "Commercial Comparison",
  legalEntityForServiceOrSupply: "Legal Entity for Service or Supply",
  agreesToOceaneTerms: "Agrees to Oceane Terms & Conditions",
  infrastructureAndFacilities: "Infrastructure & Facilities",
  previousExperienceExpertise: "Previous Experience / Expertise",
};

const supplyOfServicesLabels = {
  skilledManpowerAvailability: "Skilled Manpower Availability",
  contractorCertifications: "Contractor Certifications",
  hseSystemDueDiligence: "HSE System / Due Diligence",
  insuranceAndWorkPermit: "Insurance & Work Permit",
  previousExperienceYears: "Previous Experience (Years)",
};

function getSignatureBuffer(value) {
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let b64 = null;
  if (trimmed.startsWith("data:image")) {
    const match = trimmed.match(/^data:[^;]+;base64,(.+)$/s);
    if (match && match[1]) b64 = match[1];
  } else if (/^[A-Za-z0-9+/=]{50,}$/.test(trimmed)) {
    b64 = trimmed;
  }
  if (!b64) return null;
  try {
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

export async function generateVendorSupplierApprovalDoc(report, fullPath) {
  const meta = buildDocxMeta(report, "QAF-OFD-037");
  const headerTable = buildQhseDocxHeaderTable({ formTitle: "VENDOR/SUPPLIER/CONTRACTOR APPROVAL", meta });

  const basicInfoRows = [
    ["Vendor Name", report.vendorName || ""],
    ["Vendor Address", report.vendorAddress || ""],
    ["Date", formatDate(report.date)],
    ["Year", report.year != null ? String(report.year) : ""],
    ["Status", report.status || ""],
    ["Requested By", report.requestedBy || ""],
    ["For Accounts (Sign)", report.forAccountsSign || ""],
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

  const children = [
    headerTable,
    new Paragraph({ spacing: { before: 200 } }),
    new Paragraph({
      children: [new TextRun({ text: "BASIC INFORMATION", bold: true, size: 24 })],
    }),
    basicInfoTable,
  ];

  // Supply of Parts
  children.push(new Paragraph({ spacing: { before: 300 } }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "For Supply of Parts", bold: true, size: 22 })],
    })
  );
  const partsRows = [
    new TableRow({
      children: [tableCell("Criterion", true), tableCell("Rating (1-4)", true)],
    }),
  ];
  const supplyOfParts = report.supplyOfParts || {};
  Object.entries(supplyOfPartsLabels).forEach(([key, label]) => {
    partsRows.push(
      new TableRow({
        children: [
          tableCell(label, false),
          tableCell(supplyOfParts[key] != null ? String(supplyOfParts[key]) : "—", false),
        ],
      })
    );
  });
  partsRows.push(
    new TableRow({
      children: [
        tableCell("Percentage Score", true),
        tableCell(`${supplyOfParts.percentageScore != null ? supplyOfParts.percentageScore : 0}%`, false),
      ],
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: partsRows,
    })
  );

  // Supply of Services
  children.push(new Paragraph({ spacing: { before: 300 } }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "For Supply of Services", bold: true, size: 22 })],
    })
  );
  const servicesRows = [
    new TableRow({
      children: [tableCell("Criterion", true), tableCell("Rating (1-4)", true)],
    }),
  ];
  const supplyOfServices = report.supplyOfServices || {};
  Object.entries(supplyOfServicesLabels).forEach(([key, label]) => {
    servicesRows.push(
      new TableRow({
        children: [
          tableCell(label, false),
          tableCell(supplyOfServices[key] != null ? String(supplyOfServices[key]) : "—", false),
        ],
      })
    );
  });
  servicesRows.push(
    new TableRow({
      children: [
        tableCell("Percentage Score", true),
        tableCell(`${supplyOfServices.percentageScore != null ? supplyOfServices.percentageScore : 0}%`, false),
      ],
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: servicesRows,
    })
  );

  // Overall Result
  children.push(new Paragraph({ spacing: { before: 300 } }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Overall Result", bold: true, size: 22 })],
    })
  );
  const overallRows = [
    ["Overall Percentage Score", `${report.overallPercentageScore != null ? report.overallPercentageScore : 0}%`],
    ["Approved Vendor Eligible (≥80%)", report.approvedVendorEligible ? "Yes" : "No"],
  ];
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: overallRows.map(([label, value]) =>
        new TableRow({
          children: [tableCell(label, true), tableCell(value, false)],
        })
      ),
    })
  );

  // Signatures
  children.push(new Paragraph({ spacing: { before: 300 } }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Signatures", bold: true, size: 22 })],
    })
  );
  const sigRows = [
    ["Requested By", report.requestedBy || ""],
    ["For Accounts (Sign)", report.forAccountsSign || ""],
  ];
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: sigRows.map(([label, value]) =>
        new TableRow({
          children: [tableCell(label, true), tableCell(value || "—", false)],
        })
      ),
    })
  );
  if (report.requestedBySignatureImage) {
    const buf = report.requestedBySignatureImage.startsWith("data:")
      ? getSignatureBuffer(report.requestedBySignatureImage)
      : readSignatureFromPath(report.requestedBySignatureImage);
    if (buf && buf.length > 0) {
      children.push(new Paragraph({ spacing: { before: 150 } }));
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Requested By Signature: ", bold: true })],
        })
      );
      children.push(
        new Paragraph({
          children: [new ImageRun({ data: buf, transformation: { width: 180, height: 60 } })],
        })
      );
    }
  }
  if (report.forAccountsSignSignatureImage) {
    const buf = report.forAccountsSignSignatureImage.startsWith("data:")
      ? getSignatureBuffer(report.forAccountsSignSignatureImage)
      : readSignatureFromPath(report.forAccountsSignSignatureImage);
    if (buf && buf.length > 0) {
      children.push(new Paragraph({ spacing: { before: 150 } }));
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "For Accounts Signature: ", bold: true })],
        })
      );
      children.push(
        new Paragraph({
          children: [new ImageRun({ data: buf, transformation: { width: 180, height: 60 } })],
        })
      );
    }
  }

  if (report.approvedBy || report.approvedAt) {
    children.push(new Paragraph({ spacing: { before: 300 } }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Approval", bold: true, size: 22 })],
      })
    );
    const approvalRows = [];
    if (report.approvedBy) approvalRows.push(["Approved By", report.approvedBy]);
    if (report.approvedAt) approvalRows.push(["Approved At", formatDate(report.approvedAt)]);
    if (approvalRows.length > 0) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: approvalRows.map(([label, value]) =>
            new TableRow({
              children: [tableCell(label, true), tableCell(value || "—", false)],
            })
          ),
        })
      );
    }
  }

  if (report.rejectionReason) {
    children.push(new Paragraph({ spacing: { before: 300 } }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Rejection Reason", bold: true, size: 22 })],
      })
    );
    children.push(new Paragraph({ children: [new TextRun(report.rejectionReason)] }));
  }

  if (report.instructionsToAccountsDepartment) {
    children.push(new Paragraph({ spacing: { before: 300 } }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Instructions to Accounts Department", bold: true, size: 22 })],
      })
    );
    children.push(new Paragraph({ children: [new TextRun(report.instructionsToAccountsDepartment)] }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 500, right: 600, bottom: 500, left: 600 },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);
}

function readSignatureFromPath(filePath) {
  if (!filePath || typeof filePath !== "string") return null;
  try {
    const absPath = filePath.startsWith("/")
      ? path.join(process.cwd(), "public", filePath.slice(1))
      : path.join(process.cwd(), filePath);
    if (fs.existsSync(absPath)) return fs.readFileSync(absPath);
  } catch {}
  return null;
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

const PDF_FORM_CODE_DEFAULT = "QAF-OFD-037";

function bufferToPdfImage(buf) {
  if (!buf || !buf.length) return null;
  const format = buf[0] === 0xff && buf[1] === 0xd8 ? "JPEG" : "PNG";
  return { data: buf.toString("base64"), format };
}

function loadVendorSignatureBuffer(report, key) {
  const v = report[key];
  if (!v || typeof v !== "string") return null;
  if (v.startsWith("data:")) return getSignatureBuffer(v);
  return readSignatureFromPath(v);
}

/**
 * PDF export: same structure as Word + repeating header on every page.
 * @param {object} report – lean VendorSupplierApproval document
 * @returns {Promise<Buffer>}
 */
export async function generateVendorSupplierApprovalPdf(report) {
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
    formTitle: "VENDOR / SUPPLIER APPROVAL",
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
    ["Vendor Name", pdfSafeText(report.vendorName) || "________________________"],
    ["Vendor Address", pdfSafeText(report.vendorAddress) || "________________________"],
    ["Date", formatDate(report.date) || "________________________"],
    ["Year", report.year != null ? String(report.year) : "________________________"],
    ["Status", pdfSafeText(report.status) || "________________________"],
    ["Requested By", pdfSafeText(report.requestedBy) || "________________________"],
    ["For Accounts (Sign)", pdfSafeText(report.forAccountsSign) || "________________________"],
  ];

  autoTable(doc, {
    ...autoTableOpts,
    startY: headerCtl.tableTopMm + 5,
    head: [],
    body: basicBody,
    theme: "grid",
    styles: gridStyles,
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 52 },
      1: { cellWidth: "auto" },
    },
  });

  let y = doc.lastAutoTable.finalY + 10;

  const supplyOfParts = report.supplyOfParts || {};
  const partsBody = Object.entries(supplyOfPartsLabels).map(([key, label]) => [
    pdfSafeText(label),
    supplyOfParts[key] != null ? pdfSafeText(String(supplyOfParts[key])) : "-",
  ]);
  partsBody.push([
    "Percentage Score",
    `${supplyOfParts.percentageScore != null ? supplyOfParts.percentageScore : 0}%`,
  ]);

  if (y > pageH - 40) {
    doc.addPage();
    headerCtl.notifyManualNewPage(doc);
    y = headerCtl.tableTopMm;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("For Supply of Parts", m, y);
  y += 6;

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [["Criterion", "Rating (1-4)"]],
    body: partsBody,
    theme: "grid",
    styles: { ...gridStyles, fontSize: 8 },
    headStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 24, halign: "center" },
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  const supplyOfServices = report.supplyOfServices || {};
  const servicesBody = Object.entries(supplyOfServicesLabels).map(([key, label]) => [
    pdfSafeText(label),
    supplyOfServices[key] != null ? pdfSafeText(String(supplyOfServices[key])) : "-",
  ]);
  servicesBody.push([
    "Percentage Score",
    `${supplyOfServices.percentageScore != null ? supplyOfServices.percentageScore : 0}%`,
  ]);

  if (y > pageH - 40) {
    doc.addPage();
    headerCtl.notifyManualNewPage(doc);
    y = headerCtl.tableTopMm;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("For Supply of Services", m, y);
  y += 6;

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [["Criterion", "Rating (1-4)"]],
    body: servicesBody,
    theme: "grid",
    styles: { ...gridStyles, fontSize: 8 },
    headStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 24, halign: "center" },
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  if (y > pageH - 35) {
    doc.addPage();
    headerCtl.notifyManualNewPage(doc);
    y = headerCtl.tableTopMm;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Overall Result", m, y);
  y += 6;

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [],
    body: [
      [
        "Overall Percentage Score",
        `${report.overallPercentageScore != null ? report.overallPercentageScore : 0}%`,
      ],
      // ASCII only — Unicode "≥" breaks jsPDF Helvetica (wide letter spacing, clipping)
      ["Approved Vendor Eligible (>= 80%)", report.approvedVendorEligible ? "Yes" : "No"],
    ],
    theme: "grid",
    styles: gridStyles,
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: "auto" },
      1: { cellWidth: 28, halign: "center" },
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  if (y > pageH - 45) {
    doc.addPage();
    headerCtl.notifyManualNewPage(doc);
    y = headerCtl.tableTopMm;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Signatures", m, y);
  y += 6;

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [],
    body: [
      ["Requested By", pdfSafeText(report.requestedBy) || "-"],
      ["For Accounts (Sign)", pdfSafeText(report.forAccountsSign) || "-"],
    ],
    theme: "grid",
    styles: gridStyles,
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 52 },
      1: { cellWidth: "auto" },
    },
  });
  y = doc.lastAutoTable.finalY + 8;

  const reqBuf = loadVendorSignatureBuffer(report, "requestedBySignatureImage");
  const reqImg = bufferToPdfImage(reqBuf);
  if (reqImg) {
    if (y > pageH - 32) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      y = headerCtl.tableTopMm;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Requested By Signature:", m, y);
    y += 5;
    try {
      doc.addImage(reqImg.data, reqImg.format, m, y, 55, 18);
      y += 22;
    } catch {
      y += 4;
    }
  }

  const accBuf = loadVendorSignatureBuffer(report, "forAccountsSignSignatureImage");
  const accImg = bufferToPdfImage(accBuf);
  if (accImg) {
    if (y > pageH - 32) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      y = headerCtl.tableTopMm;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("For Accounts Signature:", m, y);
    y += 5;
    try {
      doc.addImage(accImg.data, accImg.format, m, y, 55, 18);
      y += 22;
    } catch {
      y += 4;
    }
  }

  if (report.approvedBy || report.approvedAt) {
    if (y > pageH - 35) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      y = headerCtl.tableTopMm;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Approval", m, y);
    y += 6;
    const approvalBody = [];
    if (report.approvedBy) approvalBody.push(["Approved By", pdfSafeText(report.approvedBy)]);
    if (report.approvedAt) approvalBody.push(["Approved At", formatDate(report.approvedAt)]);
    if (approvalBody.length > 0) {
      autoTable(doc, {
        ...autoTableOpts,
        startY: y,
        head: [],
        body: approvalBody,
        theme: "grid",
        styles: gridStyles,
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 52 },
          1: { cellWidth: "auto" },
        },
      });
      y = doc.lastAutoTable.finalY + 8;
    }
  }

  if (report.rejectionReason) {
    if (y > pageH - 30) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      y = headerCtl.tableTopMm;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Rejection Reason", m, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const reasonLines = doc.splitTextToSize(pdfSafeText(report.rejectionReason), contentW);
    for (const line of reasonLines) {
      if (y > pageH - 12) {
        doc.addPage();
        headerCtl.notifyManualNewPage(doc);
        y = headerCtl.tableTopMm;
      }
      doc.text(line, m, y);
      y += 5;
    }
    y += 4;
  }

  if (report.instructionsToAccountsDepartment) {
    if (y > pageH - 30) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      y = headerCtl.tableTopMm;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Instructions to Accounts Department", m, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const instLines = doc.splitTextToSize(
      pdfSafeText(report.instructionsToAccountsDepartment),
      contentW
    );
    for (const line of instLines) {
      if (y > pageH - 12) {
        doc.addPage();
        headerCtl.notifyManualNewPage(doc);
        y = headerCtl.tableTopMm;
      }
      doc.text(line, m, y);
      y += 5;
    }
  }

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
