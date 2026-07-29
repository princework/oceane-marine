import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "./shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "./shared/pdfSafeText.js";

const FORM_TITLE = "MANAGEMENT OF CHANGE";
const FORM_CODE_DEFAULT = "QAF-OFD-058";

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

function yn(b) {
  return b ? "Yes" : "No";
}

function consequenceLabels(moc) {
  const c = moc.potentialConsequences || {};
  const labels = [];
  if (c.environment) labels.push("Environment");
  if (c.safety) labels.push("Safety");
  if (c.contractual) labels.push("Contractual");
  if (c.cost) labels.push("Cost");
  if (c.operational) labels.push("Operational");
  if (c.reputation) labels.push("Reputation");
  return labels.length ? labels.join(", ") : "None";
}

function changeMadeByDisplay(moc) {
  const v = moc.changeMadeBy;
  if (v == null || v === "") return "-";
  if (typeof v === "object" && v !== null && v.name) {
    return cellText(v.name);
  }
  return cellText(String(v));
}

/**
 * PDF export: same sections/fields as {@link generateMOCManagementChangeDoc} (Word).
 *
 * @param {object} moc – lean MOCManagementChange document
 * @returns {Promise<Buffer>}
 */
export async function generateMOCManagementChangePdf(moc) {
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

  const formCode = moc.formCode || FORM_CODE_DEFAULT;
  const meta = buildStandardMeta(moc, FORM_CODE_DEFAULT);
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
    fontSize: 8,
    cellPadding: 2.5,
    textColor: [30, 30, 30],
    lineColor: [200, 200, 200],
    lineWidth: 0.2,
    overflow: "linebreak",
  };

  const columnStyles = {
    0: { fontStyle: "bold", cellWidth: 52 },
    1: { cellWidth: "auto" },
  };

  const ensureSpace = (y, neededMm = 28) => {
    if (y > pageH - neededMm) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      return headerCtl.tableTopMm;
    }
    return y;
  };

  let y = headerCtl.tableTopMm - 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BASIC INFORMATION", m, y);

  const basicBody = [
    ["Proposed Change", cellText(moc.proposedChange)],
    ["Reason for Change", cellText(moc.reasonForChange)],
    ["Proposed By", cellText(moc.proposedBy)],
    ["MOC Initiated By", cellText(moc.mocInitiatedBy)],
    ["Initiation Date", cellText(formatDate(moc.initiationDate))],
    [
      "Target Implementation Date",
      cellText(formatDate(moc.targetImplementationDate)),
    ],
  ];

  autoTable(doc, {
    ...autoTableOpts,
    startY: headerCtl.tableTopMm + 5,
    head: [],
    body: basicBody,
    theme: "grid",
    styles: gridStyles,
    columnStyles,
  });
  y = doc.lastAutoTable.finalY + 8;

  y = ensureSpace(y);
  doc.text("POTENTIAL CONSEQUENCES", m, y);
  y += 6;

  const cons = moc.potentialConsequences || {};
  const consequencesBody = [
    ["Potential Consequences", cellText(consequenceLabels(moc))],
    ["Remarks", cellText(cons.remarks)],
    [
      "Equipment/Facility/Documentation Affected",
      cellText(moc.equipmentFacilityDocumentationAffected),
    ],
  ];

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [],
    body: consequencesBody,
    theme: "grid",
    styles: gridStyles,
    columnStyles,
  });
  y = doc.lastAutoTable.finalY + 8;

  y = ensureSpace(y);
  doc.text("RISK ASSESSMENT", m, y);
  y += 6;

  const riskBody = [
    ["Risk Assessment Required", cellText(yn(!!moc.riskAssessmentRequired))],
    ["Risk Level", cellText(moc.riskLevel)],
  ];

  autoTable(doc, {
    ...autoTableOpts,
    startY: y,
    head: [],
    body: riskBody,
    theme: "grid",
    styles: gridStyles,
    columnStyles,
  });
  y = doc.lastAutoTable.finalY + 8;

  if (moc.trainingRequired || moc.trainingDetails || moc.trainingCompleted) {
    y = ensureSpace(y);
    doc.text("TRAINING", m, y);
    y += 6;

    const trainingBody = [
      ["Training Required", cellText(yn(!!moc.trainingRequired))],
      ["Training Details", cellText(moc.trainingDetails)],
      ["Training Completed", cellText(yn(!!moc.trainingCompleted))],
      [
        "Training Completion Date",
        cellText(formatDate(moc.trainingCompletionDate)),
      ],
    ];

    autoTable(doc, {
      ...autoTableOpts,
      startY: y,
      head: [],
      body: trainingBody,
      theme: "grid",
      styles: gridStyles,
      columnStyles,
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (moc.documentChangeRequired || moc.dcrNumber) {
    y = ensureSpace(y);
    doc.text("DOCUMENT CONTROL", m, y);
    y += 6;

    const docBody = [
      [
        "Document Change Required",
        cellText(yn(!!moc.documentChangeRequired)),
      ],
      ["DCR Number", cellText(moc.dcrNumber)],
    ];

    autoTable(doc, {
      ...autoTableOpts,
      startY: y,
      head: [],
      body: docBody,
      theme: "grid",
      styles: gridStyles,
      columnStyles,
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (moc.changeMadeBy || moc.changeDetails || moc.changeCompletionDate) {
    y = ensureSpace(y);
    doc.text("IMPLEMENTATION DETAILS", m, y);
    y += 6;

    const implBody = [
      ["Change Made By", changeMadeByDisplay(moc)],
      ["Change Details", cellText(moc.changeDetails)],
      [
        "Change Completion Date",
        cellText(formatDate(moc.changeCompletionDate)),
      ],
    ];

    autoTable(doc, {
      ...autoTableOpts,
      startY: y,
      head: [],
      body: implBody,
      theme: "grid",
      styles: gridStyles,
      columnStyles,
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (moc.statusReview && moc.statusReview !== "Pending") {
    y = ensureSpace(y);
    doc.text("STATUS REVIEW", m, y);
    y += 6;

    const reviewBody = [
      ["Status Review", cellText(moc.statusReview)],
      ["Reviewer Comments", cellText(moc.reviewerComments)],
      ["Rejection Reason", cellText(moc.rejectionReason)],
    ];

    autoTable(doc, {
      ...autoTableOpts,
      startY: y,
      head: [],
      body: reviewBody,
      theme: "grid",
      styles: gridStyles,
      columnStyles,
    });
  }

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
