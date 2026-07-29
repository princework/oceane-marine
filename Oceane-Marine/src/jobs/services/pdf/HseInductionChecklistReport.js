import fs from "fs";
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
  ImageRun,
} from "docx";
import { buildQhseDocxHeaderTable, buildDocxMeta } from "./shared/qhseDocxHeader.js";
import { loadSignatureImage } from "./shared/loadSignatureImage.js";

// Same question labels as list page (HSE Checklist)
const hseChecklistLabels = {
  hsePolicy: "HSE Policy",
  facilityTour:
    "A facility tour including a discussion of the types of processes performed, location of bulletin boards for postings, breakrooms, restrooms, First-Aid cabinets, fire-fighting equipment, evacuation routes & assembly areas",
  reportingFire: "Reporting fire",
  occupationalHazards: "Occupational Hazards",
  injuryIllnessNearMissReporting:
    "The procedure for reporting an industrial injury, illness, near-miss accident, or an unsafe condition",
  emergencyActionPlan: "The facility Emergency Action Plan",
  wasteManagementProcedures: "Waste Management Procedures",
  ppeRequirements:
    "PPE (Personal Protective Equipment) requirements by area including the proper use, care & maintenance of such equipment",
  hazcomMsds:
    "(HazCom) - Location of MSDS sheets, summary of hazardous chemicals on site",
  spillReportingProcedures:
    "The procedure for reporting spills, and the importance of keeping containers covered",
  ergonomicsAwareness: "Ergonomics (awareness)",
  housekeepingExpectations:
    "The importance and expectations for good housekeeping",
  disciplinaryProcedure:
    "The disciplinary procedure for Safety and Environmental Violations",
};

const jobSpecificLabels = {
  safeOperationOfToolsMachinery:
    "Safe operation of any tools/machinery that may be required",
  trainingAndCertificationRequirements:
    "Training & certification requirements prior to driving a forklift or other motorized equipment",
  riskAssessmentOverview: "Risk Assessment overview",
  safeLiftingAndBackInjuryPrevention: "Safe Lifting & Back Injury Prevention",
  craneOperationAndSlingInspection: "Safe crane operation & sling inspection",
  loadingUnloadingHandlingProcedures:
    "Procedures for safely loading/unloading and handling of equipment",
};

function getSignatureBuffer(value) {
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return loadSignatureImage(trimmed, "HSE-Induction");
}

export async function generateHseInductionChecklistDoc(report, fullPath) {
  const meta = buildDocxMeta(report, "QAF-OFD-008");
  const headerTable = buildQhseDocxHeaderTable({ formTitle: "HSE INDUCTION CHECKLIST", meta });

  const basicInfoRows = [
    ["Employee / Contractor Name", report.employeeOrContractorName || ""],
    ["Date of Induction", formatDate(report.dateOfInduction)],
    ["Location", report.location || ""],
    ["Status", report.status || ""],
    ["Submitted By", report.submittedBy || ""],
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
      children: [new TextRun({ text: "EMPLOYEE / CONTRACTOR DETAILS", bold: true, size: 24 })],
    }),
    basicInfoTable,
  ];

  // HSE Checklist section
  children.push(new Paragraph({ spacing: { before: 300 } }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "HSE INDUCTION CHECKLIST", bold: true, size: 22 })],
    })
  );
  const hseRows = [
    new TableRow({
      children: [tableCell("Topic", true), tableCell("Discussed", true)],
    }),
  ];
  const hseChecklist = report.hseChecklist || {};
  Object.entries(hseChecklistLabels).forEach(([key, label]) => {
    hseRows.push(
      new TableRow({
        children: [
          tableCell(label, false),
          tableCell(hseChecklist[key] ? "Yes" : "No", false),
        ],
      })
    );
  });
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: hseRows,
    })
  );

  // Job Specific Checklist section
  children.push(new Paragraph({ spacing: { before: 300 } }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "As appropriate by job function & facility operation",
          bold: true,
          size: 22,
        }),
      ],
    })
  );
  const jobRows = [
    new TableRow({
      children: [tableCell("Topic", true), tableCell("Discussed", true)],
    }),
  ];
  const jobChecklist = report.jobSpecificChecklist || {};
  Object.entries(jobSpecificLabels).forEach(([key, label]) => {
    jobRows.push(
      new TableRow({
        children: [
          tableCell(label, false),
          tableCell(jobChecklist[key] ? "Yes" : "No", false),
        ],
      })
    );
  });
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: jobRows,
    })
  );

  // Signatures section
  const sigs = report.signatures;
  if (sigs) {
    children.push(new Paragraph({ spacing: { before: 300 } }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "SIGNATURES", bold: true, size: 22 })],
      })
    );
    const sigRows = [];
    if (sigs.employeeSignatureDate != null) {
      sigRows.push(["Employee Signature Date", formatDate(sigs.employeeSignatureDate)]);
    }
    if (sigs.employeeSignature && !getSignatureBuffer(sigs.employeeSignature)) {
      sigRows.push(["Employee Signature (text)", sigs.employeeSignature]);
    }
    if (sigRows.length > 0) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: sigRows.map(([label, value]) =>
            new TableRow({
              children: [
                tableCell(label, true),
                tableCell(value || "—", false),
              ],
            })
          ),
        })
      );
    }
    let empSigBuf = getSignatureBuffer(sigs.employeeSignature);
    if (empSigBuf && empSigBuf.length > 0) {
      children.push(new Paragraph({ spacing: { before: 150 } }));
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Employee Signature: ", bold: true })],
        })
      );
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: empSigBuf,
              transformation: { width: 180, height: 60 },
            }),
          ],
        })
      );
    }
    let inductionSigBuf = getSignatureBuffer(sigs.inductionGivenBySignature);
    if (inductionSigBuf && inductionSigBuf.length > 0) {
      children.push(new Paragraph({ spacing: { before: 150 } }));
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Signature of Person Giving Induction: ",
              bold: true,
            }),
          ],
        })
      );
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: inductionSigBuf,
              transformation: { width: 180, height: 60 },
            }),
          ],
        })
      );
    }
    if (
      sigs.inductionGivenBySignature &&
      !getSignatureBuffer(sigs.inductionGivenBySignature) &&
      typeof sigs.inductionGivenBySignature === "string"
    ) {
      children.push(new Paragraph({ spacing: { before: 150 } }));
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Signature of Person Giving Induction: ",
              bold: true,
            }),
            new TextRun(sigs.inductionGivenBySignature.trim() || "—"),
          ],
        })
      );
    }
  }

  if (report.status === "Rejected" && report.rejectionReason) {
    children.push(new Paragraph({ spacing: { before: 300 } }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "REJECTION REASON", bold: true, size: 22 })],
      })
    );
    children.push(new Paragraph({ children: [new TextRun(report.rejectionReason)] }));
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

const PDF_FORM_CODE_DEFAULT = "QAF-OFD-008";

function yn(v) {
  return v ? "Yes" : "No";
}

/** @returns {{ data: string, format: "PNG"|"JPEG" } | null} */
function bufferToPdfImage(buf) {
  if (!buf || !buf.length) return null;
  const format = buf[0] === 0xff && buf[1] === 0xd8 ? "JPEG" : "PNG";
  return { data: buf.toString("base64"), format };
}

/**
 * PDF export: same structure as Word + repeating header on every page (like Base/Transfer Audit).
 * @param {object} report – lean HseInductionChecklist document
 * @returns {Promise<Buffer>}
 */
export async function generateHseInductionChecklistPdf(report) {
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
    formTitle: "HSE INDUCTION CHECKLIST",
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
  doc.text("EMPLOYEE / CONTRACTOR DETAILS", m, headerCtl.tableTopMm - 5);

  const basicBody = [
    ["Employee / Contractor Name", report.employeeOrContractorName || "________________________"],
    ["Date of Induction", formatDate(report.dateOfInduction) || "________________________"],
    ["Location", report.location || "________________________"],
    ["Status", report.status || "________________________"],
    ["Submitted By", report.submittedBy || "________________________"],
  ];

  autoTable(doc, {
    ...autoTableOpts,
    startY: headerCtl.tableTopMm + 5,
    head: [],
    body: basicBody,
    theme: "grid",
    styles: gridStyles,
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 62 },
      1: { cellWidth: "auto" },
    },
  });

  let y = doc.lastAutoTable.finalY + 10;

  const hseChecklist = report.hseChecklist || {};
  const hseBody = Object.entries(hseChecklistLabels).map(([key, label]) => [
    label,
    yn(hseChecklist[key]),
  ]);

  if (y > pageH - 40) {
    doc.addPage();
    headerCtl.notifyManualNewPage(doc);
    y = headerCtl.tableTopMm;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("HSE INDUCTION CHECKLIST", m, y);
  y += 6;

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [["Topic", "Discussed"]],
    body: hseBody,
    theme: "grid",
    styles: { ...gridStyles, fontSize: 8 },
    headStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 22, halign: "center" },
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  const jobChecklist = report.jobSpecificChecklist || {};
  const jobBody = Object.entries(jobSpecificLabels).map(([key, label]) => [
    label,
    yn(jobChecklist[key]),
  ]);

  if (y > pageH - 40) {
    doc.addPage();
    headerCtl.notifyManualNewPage(doc);
    y = headerCtl.tableTopMm;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const jobTitleLines = doc.splitTextToSize(
    "As appropriate by job function & facility operation",
    contentW
  );
  jobTitleLines.forEach((line, i) => {
    doc.text(line, m, y + i * 5);
  });
  y += jobTitleLines.length * 5 + 4;

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [["Topic", "Discussed"]],
    body: jobBody,
    theme: "grid",
    styles: { ...gridStyles, fontSize: 8 },
    headStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 22, halign: "center" },
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  const sigs = report.signatures;
  if (sigs) {
    const sigTextRows = [];
    if (sigs.employeeSignatureDate != null) {
      sigTextRows.push([
        "Employee Signature Date",
        formatDate(sigs.employeeSignatureDate) || "—",
      ]);
    }
    if (sigs.employeeSignature && !getSignatureBuffer(sigs.employeeSignature)) {
      sigTextRows.push(["Employee Signature (text)", String(sigs.employeeSignature).trim() || "—"]);
    }

    if (sigTextRows.length > 0) {
      if (y > pageH - 35) {
        doc.addPage();
        headerCtl.notifyManualNewPage(doc);
        y = headerCtl.tableTopMm;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("SIGNATURES", m, y);
      y += 6;
      autoTable(doc, {
        ...autoTableOpts,
        startY: y,
        head: [],
        body: sigTextRows,
        theme: "grid",
        styles: gridStyles,
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 62 },
          1: { cellWidth: "auto" },
        },
      });
      y = doc.lastAutoTable.finalY + 8;
    } else if (
      getSignatureBuffer(sigs.employeeSignature) ||
      getSignatureBuffer(sigs.inductionGivenBySignature) ||
      (sigs.inductionGivenBySignature &&
        typeof sigs.inductionGivenBySignature === "string" &&
        !getSignatureBuffer(sigs.inductionGivenBySignature))
    ) {
      if (y > pageH - 35) {
        doc.addPage();
        headerCtl.notifyManualNewPage(doc);
        y = headerCtl.tableTopMm;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("SIGNATURES", m, y);
      y += 8;
    }

    const empImg = bufferToPdfImage(getSignatureBuffer(sigs.employeeSignature));
    if (empImg) {
      if (y > pageH - 35) {
        doc.addPage();
        headerCtl.notifyManualNewPage(doc);
        y = headerCtl.tableTopMm;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Employee Signature:", m, y);
      y += 5;
      try {
        doc.addImage(empImg.data, empImg.format, m, y, 55, 18);
        y += 22;
      } catch {
        y += 4;
      }
    }

    const indImg = bufferToPdfImage(getSignatureBuffer(sigs.inductionGivenBySignature));
    if (indImg) {
      if (y > pageH - 35) {
        doc.addPage();
        headerCtl.notifyManualNewPage(doc);
        y = headerCtl.tableTopMm;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Signature of Person Giving Induction:", m, y);
      y += 5;
      try {
        doc.addImage(indImg.data, indImg.format, m, y, 55, 18);
        y += 22;
      } catch {
        y += 4;
      }
    }

    if (
      sigs.inductionGivenBySignature &&
      !getSignatureBuffer(sigs.inductionGivenBySignature) &&
      typeof sigs.inductionGivenBySignature === "string"
    ) {
      const t = sigs.inductionGivenBySignature.trim();
      if (t) {
        if (y > pageH - 25) {
          doc.addPage();
          headerCtl.notifyManualNewPage(doc);
          y = headerCtl.tableTopMm;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Signature of Person Giving Induction:", m, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(t, contentW);
        lines.forEach((line) => {
          if (y > pageH - 12) {
            doc.addPage();
            headerCtl.notifyManualNewPage(doc);
            y = headerCtl.tableTopMm;
          }
          doc.text(line, m, y);
          y += 5;
        });
      }
    }
  }

  if (report.status === "Rejected" && report.rejectionReason) {
    if (y > pageH - 30) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      y = headerCtl.tableTopMm;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("REJECTION REASON", m, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const reasonLines = doc.splitTextToSize(String(report.rejectionReason), contentW);
    reasonLines.forEach((line) => {
      if (y > pageH - 12) {
        doc.addPage();
        headerCtl.notifyManualNewPage(doc);
        y = headerCtl.tableTopMm;
      }
      doc.text(line, m, y);
      y += 5;
    });
  }

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
