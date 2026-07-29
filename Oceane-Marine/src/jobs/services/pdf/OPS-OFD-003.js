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
    ImageRun,
    BorderStyle,
    VerticalAlign
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

// ✅ FIX: Use makeBorder() to create unique objects (no shared reference)
const TABLE_BORDERS = {
    top: makeBorder(),
    bottom: makeBorder(),
    left: makeBorder(),
    right: makeBorder(),
    insideHorizontal: makeBorder(),
    insideVertical: makeBorder()
};

const FORM_TITLE = "CHECKLIST 3A &3B – BEFORE CARGO TRANSFER";

export async function generateOpsOfd003Doc(checklist, fullPath) {

    const transferInfo = checklist.transferInfo || {};
    const checklist3A = checklist.checklist3A || [];
    const checklist3B = checklist.checklist3B || [];
    const signature = checklist.signature || {};

    const totalPages = 2;

    // ========== PAGE 1 ==========
    const page1Children = [
        buildHeaderTable(checklist, 1, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        buildTransferDetailsTable(transferInfo),
        new Paragraph({ spacing: { before: 200 } }),
        buildChecklist3ATable(checklist3A.slice(0, 14)),
        // Spacer to push footer down to bottom like Image 2
        new Paragraph({ spacing: { before: 600 } }),
        buildFooterLine(FORM_TITLE)
    ];

    // ========== PAGE 2 ==========
    const page2Children = [
        buildHeaderTable(checklist, 2, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        buildChecklist3ATable(checklist3A.slice(14)),
        new Paragraph({ spacing: { before: 200 } }),
        buildChecklist3BSection(checklist3B),
        new Paragraph({ spacing: { before: 200 } }),
        buildSignatureBlock(signature),
        // Spacer to push footer down to bottom like Image 2
        new Paragraph({ spacing: { before: 600 } }),
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
// TRANSFER DETAILS TABLE
// ================================================================
function buildTransferDetailsTable(info) {
    const rows = [
        makeInfoRow("Constant Heading Ship:", info.constantHeadingShip),
        makeInfoRow("Maneuvering Ship:", info.manoeuvringShip),
        makeInfoRow("Name of Designated POAC:", info.designatedPOACName),
        makeInfoRow("Name of STS Superintendent if Different from POAC", info.stsSuperintendentName),
        makeInfoRow("Date of Transfer", info.transferDate ? formatDate(info.transferDate) : ""),
        makeInfoRow("Location of Transfer", info.transferLocation)
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
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
                            new TextRun({ text: label, size: FONT_SIZE })
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

// ================================================================
// CHECKLIST 3A TABLE
// ================================================================
function buildChecklist3ATable(items) {
    if (!items || items.length === 0) {
        return new Paragraph({ text: "" });
    }

    // Header row
    const headerRow = new TableRow({
        tableHeader: true,
        children: [
            makeHeaderCell("CL", 8, AlignmentType.LEFT),
            makeHeaderCell("Generic Checks", 57, AlignmentType.LEFT),
            makeHeaderCell("Status", 15, AlignmentType.CENTER),
            makeHeaderCell("Remarks", 20, AlignmentType.CENTER)
        ]
    });

    // Data rows
    const dataRows = items.map((item) => {
        const clNumber = item.clNumber || "";
        const description = item.description || "";
        const statusCheck = item.status === "YES" ? "☑" : "☐";
        const remarksText = item.remarks === "NOT_APPLICABLE" ? "☐ Not applicable" : "";

        return new TableRow({
            children: [
                // CL number
                new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: String(clNumber), size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                // Description
                new TableCell({
                    width: { size: 57, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: description, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                // Status (centered)
                new TableCell({
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: `${statusCheck} Yes`, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                // Remarks (centered)
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: remarksText || "", size: FONT_SIZE_SMALL })
                            ]
                        })
                    ]
                })
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: [headerRow, ...dataRows]
    });
}

function makeHeaderCell(text, widthPercent, alignment = AlignmentType.LEFT) {
    return new TableCell({
        width: { size: widthPercent, type: WidthType.PERCENTAGE },
        margins: CELL_MARGIN,
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: "D3D3D3" }, // Grey background like Transfer Details
        children: [
            new Paragraph({
                alignment: alignment,
                children: [
                    new TextRun({ text, bold: true, size: FONT_SIZE })
                ]
            })
        ]
    });
}

// ================================================================
// CHECKLIST 3B SECTION (header + table combined)
// ================================================================
function buildChecklist3BSection(items) {
    if (!items || items.length === 0) {
        return new Paragraph({ text: "" });
    }

    // 3B Header row (grey)
    const headerRow = new TableRow({
        tableHeader: true,
        children: [
            new TableCell({
                width: { size: 8, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                shading: { fill: "D9D9D9" },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: "CL 3B", bold: true, size: FONT_SIZE })
                        ]
                    })
                ]
            }),
            new TableCell({
                width: { size: 72, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                shading: { fill: "D9D9D9" },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: "Additional for LPG or LNG Transfer",
                                bold: true,
                                size: FONT_SIZE
                            })
                        ]
                    })
                ]
            }),
            new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                shading: { fill: "D9D9D9" },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "Status", bold: true, size: FONT_SIZE })
                        ]
                    })
                ]
            })
        ]
    });

    // 3B Data rows
    const dataRows = items.map((item) => {
        const clNumber = item.clNumber || "";
        const description = item.description || "";
        const statusCheck = item.status === "YES" ? "☑" : "☐";

        return new TableRow({
            children: [
                new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: String(clNumber), size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 72, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: description, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: `${statusCheck} Yes`, size: FONT_SIZE })
                            ]
                        })
                    ]
                })
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// SIGNATURE BLOCK
// ================================================================
function buildSignatureBlock(signature) {
    const signatureImage = loadSignatureImage(signature.signature, "OPS-OFD-003");

    // Signature block: create new border objects to avoid mutation
    const signatureBorders = {
        top: makeBorder(),
        bottom: makeBorder(),
        left: makeBorder(),
        right: makeBorder(),
        insideHorizontal: makeBorder(),
        insideVertical: makeBorder()
    };

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: signatureBorders,
        rows: [
            new TableRow({
                children: [
                    // Rank
                    new TableCell({
                        width: { size: 33, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        children: [
                            new Paragraph({
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({ text: "Rank:", bold: true, size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                children: [
                                    new TextRun({ text: signature.rank || "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    }),
                    // Signature
                    new TableCell({
                        width: { size: 34, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        children: [
                            new Paragraph({
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({ text: "Signature:", bold: true, size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                children: signatureImage
                                    ? [
                                        new ImageRun({
                                            data: signatureImage,
                                            transformation: { width: 180, height: 70 }
                                        })
                                    ]
                                    : [new TextRun({ text: "", size: FONT_SIZE })]
                            })
                        ]
                    }),
                    // Date
                    new TableCell({
                        width: { size: 33, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        children: [
                            new Paragraph({
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({ text: "Date:", bold: true, size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: signature.date ? formatDate(signature.date) : "",
                                        size: FONT_SIZE
                                    })
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
function buildFooterLine(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
        children: [
            new TextRun({
                text: text || "",
                bold: true,
                size: FONT_SIZE
            })
        ]
    });
}

// ================================================================
// UTILITIES
// ================================================================
function formatDate(date) {
    if (!date) return "";
    try {
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return "";
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
        return "";
    }
}
