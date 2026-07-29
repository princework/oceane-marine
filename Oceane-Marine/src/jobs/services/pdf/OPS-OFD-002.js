import fs from "node:fs";
import { loadSignatureImage } from "./shared/loadSignatureImage.js";
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
    BorderStyle,
    VerticalAlign,
    ImageRun
} from "docx";
import { buildHeaderTable } from "./shared/headerBuilder.js";

// ========== CONSTANTS ==========
const FONT_SIZE = 18; // ~9pt
const FONT_SIZE_SMALL = 16; // ~8pt
const CELL_MARGIN = { top: 40, bottom: 40, left: 60, right: 60 };

// ✅ FIX: Create new border object each time to avoid docx mutation bug
const makeBorder = () => ({
    style: BorderStyle.SINGLE,
    size: 8,
    color: "000000"
});

const FORM_TITLE = "CHECKLIST 2 - BEFORE RUN IN & MOORING";

export async function generateOpsOfd002Doc(checklist, fullPath) {
    const transferInfo = checklist.transferInfo || {};
    const checklistItems = checklist.checklistItems || [];
    const signature = checklist.signature || {};

    const totalPages = 2;

    // ========== PAGE 1 ==========
    const page1Children = [
        buildHeaderTable(checklist, 1, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        buildTransferInfoTable(transferInfo),
        new Paragraph({ spacing: { before: 200 } }),

        // Checklist Items 1-12 (first page)
        buildChecklistTable(checklistItems.slice(0, 12)),
        new Paragraph({ spacing: { before: 200 } }),

        buildFooterLine(FORM_TITLE)
    ];

    // ========== PAGE 2 ==========
    const page2Children = [
        buildHeaderTable(checklist, 2, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),

        // Checklist Items 13-15 (second page)
        buildChecklistTable(checklistItems.slice(12)),
        new Paragraph({ spacing: { before: 400 } }),

        // Name and Rank fields
        buildNameRankFields(signature),
        new Paragraph({ spacing: { before: 200 } }),

        // Signature section
        buildSignatureSection(signature),
        new Paragraph({ spacing: { before: 200 } }),

        buildFooterLine(FORM_TITLE)
    ];

    const pageMargins = {
        top: 500,
        right: 600,
        bottom: 500,
        left: 600
    };

    const doc = new Document({
        sections: [
            {
                properties: { page: { margin: pageMargins } },
                children: page1Children
            },
            {
                properties: { page: { margin: pageMargins } },
                children: page2Children
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
}

// ================================================================
// TRANSFER INFO TABLE
// ================================================================
function buildTransferInfoTable(info) {
    const rows = [
        makeInfoRow("Constant Heading Ship:", info.constantHeadingShip || ""),
        makeInfoRow("Maneuvering Ship:", info.manoeuvringShip || ""),
        makeInfoRow("Name of Designated POAC:", info.designatedPOACName || ""),
        makeInfoRow("Name of STS Superintendent If Different from POAC:", info.stsSuperintendentName || ""),
        makeInfoRow("Date of Transfer:", info.transferDate ? formatDate(info.transferDate) : ""),
        makeInfoRow("Location of Transfer:", info.transferLocation || "")
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: makeBorder(),
            bottom: makeBorder(),
            left: makeBorder(),
            right: makeBorder(),
            insideHorizontal: makeBorder(),
            insideVertical: makeBorder()
        },
        rows
    });
}

function makeInfoRow(label, value) {
    return new TableRow({
        children: [
            new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: label, bold: true, size: FONT_SIZE })
                        ]
                    })
                ]
            }),
            new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: value || "", size: FONT_SIZE })
                        ]
                    })
                ]
            })
        ]
    });
}

function fullBorders() {
    return {
        top: makeBorder(),
        bottom: makeBorder(),
        left: makeBorder(),
        right: makeBorder(),
        insideHorizontal: makeBorder(),
        insideVertical: makeBorder()
    };
}

function createHeaderCell(text, width, center = false) {
    return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: CELL_MARGIN,
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: "D3D3D3" },
        children: [
            new Paragraph({
                alignment: center ? AlignmentType.CENTER : undefined,
                children: [
                    new TextRun({ text, bold: true, size: FONT_SIZE })
                ]
            })
        ]
    });
}

function createCell(text, width, center = false) {
    return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: CELL_MARGIN,
        verticalAlign: VerticalAlign.CENTER,
        children: [
            new Paragraph({
                alignment: center ? AlignmentType.CENTER : undefined,
                children: [
                    new TextRun({ text, size: FONT_SIZE })
                ]
            })
        ]
    });
}

// ================================================================
// CHECKLIST TABLE
// ================================================================
function buildChecklistTable(items) {
    const headerRow = new TableRow({
        children: [
            createHeaderCell("CL", 8),
            createHeaderCell("Generic Checks", 57),
            createHeaderCell("Status", 15, true),
            createHeaderCell("Remarks", 20, true)
        ]
    });

    const dataRows = items.map(item => {
        // Handle both data formats:
        // 1. Object format: status: { yes: boolean, notApplicable: boolean }
        // 2. String format: status: "YES" | "NOT_APPLICABLE" | "NO"
        let statusText = "☐ Yes";
        
        if (typeof item.status === 'object' && item.status !== null) {
            // Object format (from our schema)
            if (item.status.notApplicable) {
                statusText = "☐ Yes     ☑ Not applicable";
            } else if (item.status.yes) {
                statusText = "☑ Yes";
            }
        } else if (typeof item.status === 'string') {
            // String format (legacy format)
            if (item.status === "NOT_APPLICABLE") {
                statusText = "☐ Yes     ☑ Not applicable";
            } else if (item.status === "YES") {
                statusText = "☑ Yes";
            }
        }

        return new TableRow({
            children: [
                createCell(String(item.clNumber || ""), 8, true),
                createCell(item.description || "", 57),
                createCell(statusText, 15),
                createCell(item.remarks || "", 20)
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// NAME AND RANK FIELDS
// ================================================================
function buildNameRankFields(signature) {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: makeBorder(),
            bottom: makeBorder(),
            left: makeBorder(),
            right: makeBorder(),
            insideHorizontal: makeBorder(),
            insideVertical: makeBorder()
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "Name:", bold: true, size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { before: 100 },
                                children: [
                                    new TextRun({ text: signature.name || "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "Rank:", bold: true, size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { before: 100 },
                                children: [
                                    new TextRun({ text: signature.rank || "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

// ================================================================
// SIGNATURE SECTION
// ================================================================
function buildSignatureSection(signature) {
    const signatureImage = loadSignatureImage(signature.signature, "OPS-OFD-002");

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: makeBorder(),
            bottom: makeBorder(),
            left: makeBorder(),
            right: makeBorder(),
            insideHorizontal: makeBorder(),
            insideVertical: makeBorder()
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                spacing: { after: 100 },
                                children: [
                                    new TextRun({ text: "Signature:", size: FONT_SIZE })
                                ]
                            }),
                            signatureImage ? new Paragraph({
                                spacing: { after: 200 },
                                alignment: AlignmentType.LEFT,
                                children: [
                                    new ImageRun({
                                        data: signatureImage,
                                        transformation: { width: 200, height: 100 }
                                    })
                                ]
                            }) : new Paragraph({
                                spacing: { after: 200 },
                                children: [
                                    new TextRun({ text: "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                spacing: { after: 100 },
                                children: [
                                    new TextRun({ text: "Date:", size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { after: 200 },
                                children: [
                                    new TextRun({ text: signature.date ? formatDate(signature.date) : "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

// ================================================================
// FOOTER LINE
// ================================================================
function buildFooterLine(title) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
            new TextRun({
                text: title.toUpperCase(),
                italics: true,
                size: FONT_SIZE_SMALL
            })
        ]
    });
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================
function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
}

