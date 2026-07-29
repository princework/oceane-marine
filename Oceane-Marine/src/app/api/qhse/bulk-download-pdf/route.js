import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { createQhsePdfHeaderController, buildStandardMeta, overlayQhsePageNumbers } from "@/jobs/services/pdf/shared/qhseRepeatingHeaderPdf.js";
import { pdfSafeText } from "@/jobs/services/pdf/shared/pdfSafeText.js";

import STSEquipmentBaseStock from "@/lib/mongodb/models/qhse-form-checklist/StsEquipmentBaseStockLevel";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";
import BestPractice from "@/lib/mongodb/models/qhse-best-practices/BestPractice";
import TargetKpi from "@/lib/mongodb/models/qhse-kpi/TargetKpi";
import AuditInspectionPlanner from "@/lib/mongodb/models/qhse-audit-inspection/AuditInspectionPlanner";

function formatDate(date) {
  if (!date) return "-";
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

function cellText(value) {
  if (value === null || value === undefined || value === "") return "-";
  return pdfSafeText(String(value));
}

const MODULE_MAP = {
  "equipment-base-stock": {
    model: STSEquipmentBaseStock,
    title: "STS EQUIPMENT BASE STOCK LEVEL",
    formCode: "QAF-OFD-013",
    yearField: "year",
    fileName: "STS-Equipment-Base-Stock-Level",
  },
  "defects-list": {
    model: EquipmentDefect,
    title: "DEFECTS LIST",
    formCode: "QAF-OFD-025",
    yearField: "createdAt",
    fileName: "Defects-List",
  },
  "best-practice": {
    model: BestPractice,
    title: "BEST PRACTICES",
    formCode: "QAF-BP",
    yearField: "createdAt",
    fileName: "Best-Practices",
  },
  "target-kpi": {
    model: TargetKpi,
    title: "TARGET KPI",
    formCode: "HSE-001A",
    yearField: "year",
    fileName: "Target-KPI",
  },
  "audit-inspection": {
    model: AuditInspectionPlanner,
    title: "AUDITS & INSPECTION PLANNER",
    formCode: "QAF-OFD-048",
    yearField: "year",
    fileName: "Audit-Inspection-Planner",
  },
};

async function fetchRecords(config, year) {
  const Model = config.model;
  let filter = {};

  if (year) {
    const y = Number(year);
    if (config.yearField === "year") {
      filter = { year: y };
    } else {
      filter = {
        createdAt: {
          $gte: new Date(y, 0, 1),
          $lt: new Date(y + 1, 0, 1),
        },
      };
    }
  }

  return Model.find(filter).sort({ createdAt: 1 }).lean();
}

async function generateEquipmentBaseStockBulkPdf(records, year) {
  const jspdfModule = await import("jspdf");
  const JsPDF = jspdfModule.jsPDF ?? (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();

  const yearLabel = year ? ` - ${year}` : "";
  const meta = buildStandardMeta({}, "QAF-OFD-013");
  const headerCtl = createQhsePdfHeaderController({ formTitle: `STS EQUIPMENT BASE STOCK LEVEL${yearLabel}`, meta });
  const tableMargins = headerCtl.getAutoTableMargins();
  const m = headerCtl.sideMarginMm;

  const gridStyles = { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 30], lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" };
  const headStyles = { fillColor: [54, 96, 146], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 };

  if (records.length === 0) {
    headerCtl.willDrawPage({ doc });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("No records found for the selected year.", m, headerCtl.tableTopMm + 5);
    overlayQhsePageNumbers(doc);
    return Buffer.from(doc.output("arraybuffer"));
  }

  for (let idx = 0; idx < records.length; idx++) {
    const report = records[idx];
    if (idx > 0) doc.addPage();

    headerCtl.willDrawPage({ doc });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Record ${idx + 1} of ${records.length}  -  ${cellText(report.serialNumber)}`, m, headerCtl.tableTopMm - 4);

    autoTable(doc, {
      startY: headerCtl.tableTopMm + 2,
      margin: tableMargins,
      willDrawPage: headerCtl.willDrawPage,
      head: [],
      body: [
        ["Serial", cellText(report.serialNumber)],
        ["Year", report.year != null ? String(report.year) : "-"],
        ["Status", cellText(report.status)],
        ["Filled By", cellText(report.filledBy?.name)],
        ["Created", cellText(formatDate(report.createdAt))],
      ],
      theme: "grid",
      styles: gridStyles,
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 48 }, 1: { cellWidth: "auto" } },
    });

    let y = doc.lastAutoTable.finalY + 8;
    const categories = report.equipmentCategories || [];

    for (const cat of categories) {
      const rawTitle = cat.subCategory ? `${cat.categoryName} - ${cat.subCategory}` : cat.categoryName;

      if (y > pageH - 45) {
        doc.addPage();
        headerCtl.notifyManualNewPage(doc);
        y = headerCtl.tableTopMm;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(pdfSafeText(rawTitle || "(Category)"), m, y);
      y += 5;

      const items = cat.items || [];
      if (items.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.text("No items.", m, y);
        y += 6;
        continue;
      }

      autoTable(doc, {
        startY: y,
        margin: tableMargins,
        willDrawPage: headerCtl.willDrawPage,
        head: [["Item Name", "Qty in Use", "Qty Spare", "Condition", "Comments"]],
        body: items.map((item) => [
          cellText(item.name),
          item.quantityInUse != null ? String(item.quantityInUse) : "-",
          item.quantitySpare != null ? String(item.quantitySpare) : "-",
          cellText(item.overallCondition),
          cellText(item.additionalComments),
        ]),
        theme: "grid",
        styles: { ...gridStyles, fontSize: 7 },
        headStyles: { ...headStyles, fontSize: 7 },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 18, halign: "center" }, 2: { cellWidth: 18, halign: "center" }, 3: { cellWidth: 22 }, 4: { cellWidth: "auto" } },
      });
      y = doc.lastAutoTable.finalY + 8;
    }
  }

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

async function generateDefectsListBulkPdf(records, year) {
  const jspdfModule = await import("jspdf");
  const JsPDF = jspdfModule.jsPDF ?? (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const yearLabel = year ? ` - ${year}` : "";
  const meta = buildStandardMeta({}, "QAF-OFD-025");
  const headerCtl = createQhsePdfHeaderController({ formTitle: `DEFECTS LIST${yearLabel}`, meta });
  const tableMargins = headerCtl.getAutoTableMargins();
  const m = headerCtl.sideMarginMm;

  const gridStyles = { fontSize: 7, cellPadding: 2, textColor: [30, 30, 30], lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" };
  const headStyles = { fillColor: [54, 96, 146], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 };

  if (records.length === 0) {
    headerCtl.willDrawPage({ doc });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("No records found for the selected year.", m, headerCtl.tableTopMm + 5);
    overlayQhsePageNumbers(doc);
    return Buffer.from(doc.output("arraybuffer"));
  }

  const body = records.map((d, i) => [
    String(i + 1),
    cellText(d.formCode),
    cellText(d.serialNumber),
    cellText(d.equipmentDefect),
    cellText(d.base),
    cellText(d.actionRequired),
    cellText(formatDate(d.targetDate)),
    cellText(d.status),
    cellText(formatDate(d.completionDate)),
  ]);

  autoTable(doc, {
    startY: headerCtl.tableTopMm,
    margin: tableMargins,
    willDrawPage: headerCtl.willDrawPage,
    head: [["#", "Form Code", "Serial", "Equipment Defect", "Base", "Action Required", "Target Date", "Status", "Completion Date"]],
    body,
    theme: "grid",
    styles: gridStyles,
    headStyles,
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 24 },
      2: { cellWidth: 22 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 25 },
      5: { cellWidth: 45 },
      6: { cellWidth: 22 },
      7: { cellWidth: 22 },
      8: { cellWidth: 24 },
    },
  });

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

async function generateBestPracticeBulkPdf(records, year) {
  const jspdfModule = await import("jspdf");
  const JsPDF = jspdfModule.jsPDF ?? (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const yearLabel = year ? ` - ${year}` : "";
  const meta = buildStandardMeta({}, "QAF-BP");
  const headerCtl = createQhsePdfHeaderController({ formTitle: `BEST PRACTICES${yearLabel}`, meta });
  const tableMargins = headerCtl.getAutoTableMargins();
  const m = headerCtl.sideMarginMm;

  const gridStyles = { fontSize: 8, cellPadding: 3, textColor: [30, 30, 30], lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" };
  const headStyles = { fillColor: [54, 96, 146], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 };

  if (records.length === 0) {
    headerCtl.willDrawPage({ doc });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("No records found for the selected year.", m, headerCtl.tableTopMm + 5);
    overlayQhsePageNumbers(doc);
    return Buffer.from(doc.output("arraybuffer"));
  }

  const body = records.map((bp, i) => [
    String(i + 1),
    cellText(bp.formCode),
    cellText(bp.serialNumber),
    cellText(formatDate(bp.eventDate)),
    cellText(bp.description),
    cellText(formatDate(bp.createdAt)),
  ]);

  autoTable(doc, {
    startY: headerCtl.tableTopMm,
    margin: tableMargins,
    willDrawPage: headerCtl.willDrawPage,
    head: [["#", "Form Code", "Serial", "Event Date", "Description", "Created At"]],
    body,
    theme: "grid",
    styles: gridStyles,
    headStyles,
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 24 },
      2: { cellWidth: 22 },
      3: { cellWidth: 24 },
      4: { cellWidth: "auto" },
      5: { cellWidth: 24 },
    },
  });

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

async function generateTargetKpiBulkPdf(records, year) {
  const jspdfModule = await import("jspdf");
  const JsPDF = jspdfModule.jsPDF ?? (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const yearLabel = year ? ` - ${year}` : "";
  const meta = buildStandardMeta({}, "HSE-001A");
  const headerCtl = createQhsePdfHeaderController({ formTitle: `TARGET KPI${yearLabel}`, meta });
  const tableMargins = headerCtl.getAutoTableMargins();
  const m = headerCtl.sideMarginMm;

  const BEIGE = [232, 220, 196];
  const gridStyles = { fontSize: 7, cellPadding: 1.8, textColor: [30, 30, 30], lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" };
  const headStyles = { fillColor: BEIGE, textColor: [20, 20, 20], fontStyle: "bold", fontSize: 7 };

  if (records.length === 0) {
    headerCtl.willDrawPage({ doc });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("No records found for the selected year.", m, headerCtl.tableTopMm + 5);
    overlayQhsePageNumbers(doc);
    return Buffer.from(doc.output("arraybuffer"));
  }

  let isFirstPage = true;

  for (let idx = 0; idx < records.length; idx++) {
    const record = records[idx];
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;

    headerCtl.willDrawPage({ doc });

    const yr = record.year != null ? String(record.year) : "-";
    let y = headerCtl.tableTopMm - 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Record ${idx + 1} of ${records.length}  -  ${cellText(record.serialNumber)}  (Year: ${yr})`, m, y);
    y += 7;

    const rows = Array.isArray(record.rows) ? record.rows : [];
    const bodyRows = rows.map((row) => [
      cellText(row.title),
      cellText(row.targetForYear),
      cellText(row.quarter1),
      cellText(row.quarter2),
      cellText(row.quarter3),
      cellText(row.quarter4),
      cellText(row.targetsAchieved),
    ]);

    autoTable(doc, {
      startY: y,
      margin: tableMargins,
      willDrawPage: headerCtl.willDrawPage,
      head: [["Title", `Targets for ${yr}`, "Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4", "Targets Achieved"]],
      body: bodyRows,
      theme: "grid",
      styles: gridStyles,
      headStyles,
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 28, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 22, halign: "center" },
        6: { cellWidth: 28, halign: "center" },
      },
    });
  }

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

async function generateAuditInspectionBulkPdf(records, year) {
  const jspdfModule = await import("jspdf");
  const JsPDF = jspdfModule.jsPDF ?? (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();

  const yearLabel = year ? ` - ${year}` : "";
  const meta = buildStandardMeta({}, "QAF-OFD-048");
  const headerCtl = createQhsePdfHeaderController({ formTitle: `AUDITS & INSPECTION PLANNER${yearLabel}`, meta });
  const tableMargins = headerCtl.getAutoTableMargins();
  const m = headerCtl.sideMarginMm;

  const gridStyles = { fontSize: 7, cellPadding: 1.8, textColor: [30, 30, 30], lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" };
  const headStyles = { fillColor: [54, 96, 146], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 };

  const ensureSpace = (y, neededMm = 35) => {
    if (y > pageH - neededMm) {
      doc.addPage();
      headerCtl.notifyManualNewPage(doc);
      return headerCtl.tableTopMm;
    }
    return y;
  };

  if (records.length === 0) {
    headerCtl.willDrawPage({ doc });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("No records found for the selected year.", m, headerCtl.tableTopMm + 5);
    overlayQhsePageNumbers(doc);
    return Buffer.from(doc.output("arraybuffer"));
  }

  let isFirstPage = true;

  for (let idx = 0; idx < records.length; idx++) {
    const record = records[idx];
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;

    headerCtl.willDrawPage({ doc });

    let y = headerCtl.tableTopMm - 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(
      `Record ${idx + 1} of ${records.length}  -  ${cellText(record.serialNumber)}  |  Version: ${cellText(record.version)}  |  Issue Date: ${cellText(formatDate(record.issueDate))}`,
      m,
      y
    );
    y += 7;

    const categories = record.categories || [];
    for (const cat of categories) {
      const title = String(cat.title || cat.key || "Section");
      const rows = Array.isArray(cat.rows) ? cat.rows : [];

      y = ensureSpace(y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(pdfSafeText(title.toUpperCase()), m, y);
      y += 4;

      const body = rows.map((r) => [
        cellText(r.description),
        cellText(r.frequency),
        cellText(r.dueBy),
        cellText(r.status),
        cellText(r.auditorName),
        cellText(formatDate(r.auditDate)),
        cellText(r.remarks),
      ]);

      autoTable(doc, {
        startY: y,
        margin: tableMargins,
        willDrawPage: headerCtl.willDrawPage,
        head: [["Description", "Frequency", "Due By", "Status", "Auditor", "Audit Date", "Remarks"]],
        body: body.length ? body : [],
        theme: "grid",
        styles: gridStyles,
        headStyles,
        columnStyles: {
          0: { cellWidth: 42 },
          1: { cellWidth: 26 },
          2: { cellWidth: 24 },
          3: { cellWidth: 22 },
          4: { cellWidth: 28 },
          5: { cellWidth: 26 },
          6: { cellWidth: "auto" },
        },
      });
      y = doc.lastAutoTable.finalY + 8;
    }
  }

  overlayQhsePageNumbers(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

const GENERATORS = {
  "equipment-base-stock": generateEquipmentBaseStockBulkPdf,
  "defects-list": generateDefectsListBulkPdf,
  "best-practice": generateBestPracticeBulkPdf,
  "target-kpi": generateTargetKpiBulkPdf,
  "audit-inspection": generateAuditInspectionBulkPdf,
};

export async function GET(request) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const moduleName = searchParams.get("module");
  const year = searchParams.get("year");

  if (!moduleName || !MODULE_MAP[moduleName]) {
    return NextResponse.json(
      { success: false, error: `Invalid module. Valid: ${Object.keys(MODULE_MAP).join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const config = MODULE_MAP[moduleName];
    const records = await fetchRecords(config, year);
    const generator = GENERATORS[moduleName];
    const pdfBuffer = await generator(records, year);
    const suffix = year ? `-${year}` : "-All";
    const fileName = `${config.fileName}${suffix}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("Bulk PDF generation error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
