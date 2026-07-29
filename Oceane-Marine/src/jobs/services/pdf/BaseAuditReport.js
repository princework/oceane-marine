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
} from "docx";
import { buildQhseDocxHeaderTable, buildDocxMeta } from "./shared/qhseDocxHeader.js";

export async function generateBaseAuditReportDoc(report, fullPath) {
    /* ================= HEADER TABLE ================= */
    const meta = buildDocxMeta(report, "QAF-OFD-004");
    const headerTable = buildQhseDocxHeaderTable({ formTitle: "STS BASE AUDIT REPORT", meta });

    /* ================= BASIC INFORMATION TABLE ================= */
    const basicInfoRows = [
        ["Description", report.description || ""],
        ["Location", report.location?.name || ""],
        ["Uploaded By", report.uploadedBy?.name || ""],
        ["Upload Date", formatDate(report.uploadedAt || report.createdAt)]
    ];

    const basicInfoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: basicInfoRows.map(([label, value]) =>
            new TableRow({
                children: [
                    tableCell(label, true),
                    tableCell(value || "________________________")
                ]
            })
        )
    });

    /* ================= DOC ================= */
    const children = [
        headerTable,
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [new TextRun({ text: "BASIC INFORMATION", bold: true, size: 24 })]
        }),
        basicInfoTable
    ];

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 500,
                            right: 600,
                            bottom: 500,
                            left: 600
                        }
                    }
                },
                children
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
}

const FORM_TITLE_PDF = "STS BASE AUDIT REPORT";
const FORM_CODE_DEFAULT_PDF = "QAF-OFD-004";

/**
 * Same information layout as the Word export: logo + title + form meta header,
 * then BASIC INFORMATION table. Returns a PDF buffer (no temp file).
 * @param {object} report - StsBaseAuditReport lean document
 * @returns {Promise<Buffer>}
 */
export async function generateBaseAuditReportPdf(report) {
    const jspdfModule = await import("jspdf");
    /** Node resolves `jspdf` with named `jsPDF`; browser bundles often use default as constructor */
    const JsPDF = jspdfModule.jsPDF
        ?? (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
    if (!JsPDF) {
        throw new Error("jsPDF constructor not found");
    }
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });

    const meta = buildStandardMeta(report, FORM_CODE_DEFAULT_PDF);
    const headerCtl = createQhsePdfHeaderController({
        formTitle: FORM_TITLE_PDF,
        meta,
    });
    const tableMargins = headerCtl.getAutoTableMargins();

    /* Section title only on first page; header repeats via willDrawPage on every page */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("BASIC INFORMATION", headerCtl.sideMarginMm, headerCtl.tableTopMm - 5);

    autoTable(doc, {
        startY: headerCtl.tableTopMm + 5,
        margin: tableMargins,
        willDrawPage: headerCtl.willDrawPage,
        head: [],
        body: [
            ["Description", report.description || "________________________"],
            ["Location", report.location?.name || "________________________"],
            ["Uploaded By", report.uploadedBy?.name || "________________________"],
            [
                "Upload Date",
                formatDate(report.uploadedAt || report.createdAt) || "________________________",
            ],
        ],
        theme: "grid",
        styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: [30, 30, 30],
            lineColor: [200, 200, 200],
            lineWidth: 0.2,
        },
        headStyles: { fillColor: [240, 240, 240] },
        columnStyles: {
            0: { fontStyle: "bold", cellWidth: 48 },
            1: { cellWidth: "auto" },
        },
    });

    overlayQhsePageNumbers(doc);
    return Buffer.from(doc.output("arraybuffer"));
}

/* HELPERS */
function tableCell(text, bold = false) {
    const textValue = text !== null && text !== undefined ? String(text) : "";
    return new TableCell({
        children: [
            new Paragraph({
                children: [
                    new TextRun({
                        text: textValue,
                        bold
                    })
                ]
            })
        ]
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
            year: "numeric"
        });
    } catch (e) {
        return "";
    }
}
