import fs from "fs";
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
} from "docx";
import { buildQhseDocxHeaderTable, buildDocxMeta } from "./shared/qhseDocxHeader.js";

const PDF_FORM_CODE_DEFAULT = "QAF-OFD-049";
const PDF_FORM_TITLE = "TRANSFER LOCATION QUESTIONNAIRE";

export async function generateTransferLocationQuestDoc(quest, fullPath) {
    /* ================= HEADER TABLE ================= */
    const meta = buildDocxMeta(quest, "QAF-OFD-049");
    const headerTable = buildQhseDocxHeaderTable({ formTitle: "TRANSFER LOCATION QUESTIONNAIRE", meta });

    /* ================= BASIC INFORMATION TABLE ================= */
    const basicInfoRows = [
        ["Location Name", quest.locationName || ""],
        ["Uploaded By", quest.uploadedBy?.name || ""],
        ["Upload Date", formatDate(quest.uploadedAt || quest.createdAt)]
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

/**
 * PDF export: same fields as Word + repeating QHSE header.
 * Dynamic text uses {@link pdfSafeText} for jsPDF Helvetica compatibility.
 *
 * @param {object} quest – lean STSTransferLocationQuest document
 * @returns {Promise<Buffer>}
 */
export async function generateTransferLocationQuestPdf(quest) {
    const jspdfModule = await import("jspdf");
    const JsPDF =
        jspdfModule.jsPDF ??
        (typeof jspdfModule.default === "function" ? jspdfModule.default : null);
    if (!JsPDF) {
        throw new Error("jsPDF constructor not found");
    }
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });

    const meta = buildStandardMeta(quest, PDF_FORM_CODE_DEFAULT);
    const headerCtl = createQhsePdfHeaderController({
        formTitle: PDF_FORM_TITLE,
        meta,
    });
    const tableMargins = headerCtl.getAutoTableMargins();
    const m = headerCtl.sideMarginMm;

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

    const uploadDateStr =
        formatDate(quest.uploadedAt || quest.createdAt) || "________________________";

    const basicBody = [
        [
            "Location Name",
            pdfSafeText(quest.locationName) || "________________________",
        ],
        [
            "Uploaded By",
            pdfSafeText(quest.uploadedBy?.name) || "________________________",
        ],
        ["Upload Date", pdfSafeText(uploadDateStr) || "________________________"],
    ];

    autoTable(doc, {
        startY: headerCtl.tableTopMm + 5,
        margin: tableMargins,
        willDrawPage: headerCtl.willDrawPage,
        head: [],
        body: basicBody,
        theme: "grid",
        styles: gridStyles,
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
